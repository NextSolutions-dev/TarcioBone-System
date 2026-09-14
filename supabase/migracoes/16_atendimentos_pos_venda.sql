-- 16 — Devolução com reembolso ou troca, vinculada ao item vendido.
-- Migração ADITIVA: as RPCs e relatórios antigos continuam disponíveis enquanto
-- o código publicado ainda os usa. Aplicar no banco ANTES do novo deploy.
-- NÃO reescreve vendas antigas nem reaproveita trocas_estoque sem vínculo.

create table public.atendimentos_pos_venda (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  venda_item_id uuid not null references public.venda_itens(id) on delete cascade,
  tipo text not null check (tipo in ('reembolso', 'troca')),
  quantidade integer not null check (quantidade > 0),
  produto_novo_id uuid references public.produtos(id),
  reposto_estoque boolean not null default false,
  reembolso_produto_centavos integer not null default 0 check (reembolso_produto_centavos >= 0),
  reembolso_frete_centavos integer not null default 0 check (reembolso_frete_centavos >= 0),
  reembolso_centavos integer generated always as
    (reembolso_produto_centavos + reembolso_frete_centavos) stored,
  motivo text not null check (length(btrim(motivo)) > 0),
  idempotency_key uuid not null unique,
  criada_em timestamptz not null default now(),
  criada_por uuid not null references public.perfis(id),
  constraint atendimento_tipo_coerente check (
    (tipo = 'troca' and produto_novo_id is not null
      and reembolso_produto_centavos = 0 and reembolso_frete_centavos = 0)
    or (tipo = 'reembolso' and produto_novo_id is null)
  )
);

create index atendimentos_por_venda_item
  on public.atendimentos_pos_venda(venda_item_id);
create index atendimentos_por_data
  on public.atendimentos_pos_venda(criada_em desc);

alter table public.estoque_movimentos
  add column atendimento_id uuid
    references public.atendimentos_pos_venda(id) on delete cascade;
create index movimentos_por_atendimento
  on public.estoque_movimentos(atendimento_id)
  where atendimento_id is not null;

alter table public.atendimentos_pos_venda enable row level security;
create policy atendimentos_leitura on public.atendimentos_pos_venda
  for select to authenticated
  using (
    exists (
      select 1 from public.vendas v
       where v.id = venda_id
         and ((select private.eh_dono()) or v.vendedor_id = (select auth.uid()))
    )
  );
-- Escrita exclusivamente pela RPC, que reconfere o dono.
revoke all on public.atendimentos_pos_venda from public, anon;
grant select on public.atendimentos_pos_venda to authenticated;

create function public.registrar_atendimento_pos_venda(
  _venda_item_id uuid,
  _tipo text,
  _quantidade integer,
  _motivo text,
  _produto_novo_id uuid default null,
  _repor_estoque boolean default false,
  _idempotency_key uuid default null,
  _reembolso_esperado_centavos integer default null
) returns uuid
language plpgsql security definer set search_path to ''
as $function$
declare
  v_item public.venda_itens%rowtype;
  v_venda public.vendas%rowtype;
  v_novo public.produtos%rowtype;
  v_id uuid;
  v_operador uuid;
  v_ja_atendido bigint;
  v_bruto_antes bigint;
  v_bruto_depois bigint;
  v_desconto_antes bigint;
  v_desconto_depois bigint;
  v_qtd_reembolsada bigint;
  v_qtd_vendida bigint;
  v_reembolso_produto bigint := 0;
  v_reembolso_frete bigint := 0;
  v_reembolsado_antes bigint;
  v_saldo_novo integer;
begin
  if not private.eh_dono() then
    raise exception 'Apenas o dono pode realizar troca ou reembolso.'
      using errcode = '42501';
  end if;
  if _idempotency_key is null then
    raise exception 'Chave de envio obrigatória.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(_idempotency_key::text, 0));
  if _repor_estoque is null then
    raise exception 'Informe se a peça pode voltar ao estoque.';
  end if;
  select id into v_id from public.atendimentos_pos_venda
   where idempotency_key = _idempotency_key;
  if v_id is not null then return v_id; end if;
  if _tipo not in ('troca', 'reembolso') or _tipo is null then
    raise exception 'Escolha troca ou reembolso.';
  end if;
  if coalesce(_quantidade, 0) <= 0 then
    raise exception 'Informe a quantidade devolvida.';
  end if;
  if nullif(btrim(coalesce(_motivo, '')), '') is null then
    raise exception 'Descreva o motivo.';
  end if;

  -- A venda serializa devoluções simultâneas, inclusive de itens diferentes.
  select * into v_item from public.venda_itens where id = _venda_item_id;
  if v_item.id is null then raise exception 'Item da venda não encontrado.'; end if;
  select * into v_venda from public.vendas where id = v_item.venda_id for update;
  if v_venda.id is null then raise exception 'Venda não encontrada.'; end if;
  select * into v_item from public.venda_itens where id = _venda_item_id for update;
  if v_item.id is null or v_item.venda_id <> v_venda.id then
    raise exception 'Item da venda não encontrado.';
  end if;
  select id into v_id from public.atendimentos_pos_venda
   where idempotency_key = _idempotency_key;
  if v_id is not null then return v_id; end if;

  select
    coalesce((select sum(t.quantidade) from public.trocas t
               where t.venda_item_id = v_item.id), 0) +
    coalesce((select sum(a.quantidade) from public.atendimentos_pos_venda a
               where a.venda_item_id = v_item.id), 0)
    into v_ja_atendido;
  if v_ja_atendido + _quantidade > v_item.quantidade then
    raise exception 'Só restam % peça(s) desse item para devolver.',
      v_item.quantidade - v_ja_atendido;
  end if;
  if _tipo = 'troca' and (v_item.produto_id is null or _produto_novo_id is null) then
    raise exception 'Troca por outra peça exige item cadastrado e peça de saída.';
  end if;
  if _tipo = 'reembolso' and _produto_novo_id is not null then
    raise exception 'Reembolso não entrega outra peça.';
  end if;
  if v_item.produto_id is null and _repor_estoque then
    raise exception 'Item avulso nunca entra no estoque.';
  end if;

  select id into v_operador from public.perfis
   where id = (select auth.uid()) and ativo;
  -- Sempre bloquear produtos na mesma ordem, evitando deadlock em trocas cruzadas.
  perform 1 from public.produtos
   where id in (v_item.produto_id, _produto_novo_id)
   order by id for update;
  if _tipo = 'troca' then
    select * into v_novo from public.produtos where id = _produto_novo_id;
    if v_novo.id is null or not v_novo.ativo then
      raise exception 'Peça de saída não encontrada ou inativa.';
    end if;
    v_saldo_novo := v_novo.estoque_atual;
    if _repor_estoque and v_item.produto_id = _produto_novo_id then
      v_saldo_novo := v_saldo_novo + _quantidade;
    end if;
    if v_saldo_novo < _quantidade then
      raise exception 'Estoque insuficiente da peça de saída.';
    end if;
  end if;

  if _tipo = 'reembolso' then
    -- O desconto é rateado sobre o bruto ACUMULADO reembolsado da venda.
    -- A diferença de dois arredondamentos evita perder/ganhar centavos por ordem
    -- de devolução e garante o desconto inteiro quando toda a venda é devolvida.
    select coalesce(sum(a.quantidade::bigint * i.preco_unitario_centavos), 0),
           coalesce(sum(a.quantidade), 0),
           coalesce(sum(a.reembolso_centavos), 0)
      into v_bruto_antes, v_qtd_reembolsada, v_reembolsado_antes
      from public.atendimentos_pos_venda a
      join public.venda_itens i on i.id = a.venda_item_id
     where a.venda_id = v_venda.id and a.tipo = 'reembolso';
    v_bruto_depois := v_bruto_antes +
      _quantidade::bigint * v_item.preco_unitario_centavos;
    if v_venda.subtotal_centavos > 0 then
      v_desconto_antes := round(v_venda.desconto_centavos::numeric *
        v_bruto_antes / v_venda.subtotal_centavos)::bigint;
      v_desconto_depois := round(v_venda.desconto_centavos::numeric *
        v_bruto_depois / v_venda.subtotal_centavos)::bigint;
    else
      v_desconto_antes := 0;
      v_desconto_depois := 0;
    end if;
    v_reembolso_produto := v_bruto_depois - v_bruto_antes -
      (v_desconto_depois - v_desconto_antes);
    select coalesce(sum(i.quantidade), 0) into v_qtd_vendida
      from public.venda_itens i where i.venda_id = v_venda.id;
    if v_qtd_reembolsada + _quantidade = v_qtd_vendida then
      v_reembolso_frete := v_venda.frete_centavos;
    end if;
    if v_reembolso_produto < 0 or
       v_reembolsado_antes + v_reembolso_produto + v_reembolso_frete >
       v_venda.total_centavos then
      raise exception 'Reembolso excede o valor recebido na venda.';
    end if;
    if _reembolso_esperado_centavos is null or
       _reembolso_esperado_centavos <> v_reembolso_produto + v_reembolso_frete then
      raise exception 'O valor do reembolso mudou. Consulte a venda novamente antes de confirmar.';
    end if;
  end if;

  insert into public.atendimentos_pos_venda (
    venda_id, venda_item_id, tipo, quantidade, produto_novo_id,
    reposto_estoque, reembolso_produto_centavos, reembolso_frete_centavos,
    motivo, idempotency_key, criada_por
  ) values (
    v_venda.id, v_item.id, _tipo, _quantidade, _produto_novo_id,
    _repor_estoque, v_reembolso_produto::integer, v_reembolso_frete::integer,
    btrim(_motivo), _idempotency_key, v_operador
  ) returning id into v_id;

  if _repor_estoque then
    insert into public.estoque_movimentos
      (produto_id, tipo, quantidade, motivo, criado_por, atendimento_id)
    values (v_item.produto_id, 'entrada', _quantidade,
      'Devolução da venda nº ' || v_venda.numero, v_operador, v_id);
  end if;
  if _tipo = 'troca' then
    insert into public.estoque_movimentos
      (produto_id, tipo, quantidade, motivo, criado_por, atendimento_id)
    values (_produto_novo_id, 'saida', -_quantidade,
      'Troca da venda nº ' || v_venda.numero, v_operador, v_id);
  end if;
  return v_id;
end; $function$;

revoke execute on function public.registrar_atendimento_pos_venda(
  uuid, text, integer, text, uuid, boolean, uuid, integer) from public, anon;
grant execute on function public.registrar_atendimento_pos_venda(
  uuid, text, integer, text, uuid, boolean, uuid, integer) to authenticated;

-- Relatórios ADITIVOS: os quatro relatórios antigos preservam assinatura e
-- resultado para o deploy anterior. RLS de vendas/atendimentos decide o alcance.
create function public.resumo_reembolsos(_de date, _ate date)
returns table(produto_centavos bigint, frete_centavos bigint, total_centavos bigint)
language sql stable set search_path to ''
as $function$
  select coalesce(sum(a.reembolso_produto_centavos), 0)::bigint,
         coalesce(sum(a.reembolso_frete_centavos), 0)::bigint,
         coalesce(sum(a.reembolso_centavos), 0)::bigint
    from public.atendimentos_pos_venda a
   where a.tipo = 'reembolso'
     and (a.criada_em at time zone 'America/Sao_Paulo')::date between _de and _ate;
$function$;

create function public.reembolsos_por_dia(_de date, _ate date)
returns table(dia date, produto_centavos bigint, frete_centavos bigint,
              total_centavos bigint)
language sql stable set search_path to ''
as $function$
  select (a.criada_em at time zone 'America/Sao_Paulo')::date,
         sum(a.reembolso_produto_centavos)::bigint,
         sum(a.reembolso_frete_centavos)::bigint,
         sum(a.reembolso_centavos)::bigint
    from public.atendimentos_pos_venda a
   where a.tipo = 'reembolso'
     and (a.criada_em at time zone 'America/Sao_Paulo')::date between _de and _ate
   group by 1 order by 1 desc;
$function$;

create function public.reembolsos_por_canal(_de date, _ate date)
returns table(canal text, produto_centavos bigint, frete_centavos bigint,
              total_centavos bigint)
language sql stable set search_path to ''
as $function$
  select v.canal, sum(a.reembolso_produto_centavos)::bigint,
         sum(a.reembolso_frete_centavos)::bigint,
         sum(a.reembolso_centavos)::bigint
    from public.atendimentos_pos_venda a
    join public.vendas v on v.id = a.venda_id
   where a.tipo = 'reembolso'
     and (a.criada_em at time zone 'America/Sao_Paulo')::date between _de and _ate
   group by v.canal;
$function$;

revoke execute on function public.resumo_reembolsos(date, date) from public, anon;
revoke execute on function public.reembolsos_por_dia(date, date) from public, anon;
revoke execute on function public.reembolsos_por_canal(date, date) from public, anon;
grant execute on function public.resumo_reembolsos(date, date) to authenticated;
grant execute on function public.reembolsos_por_dia(date, date) to authenticated;
grant execute on function public.reembolsos_por_canal(date, date) to authenticated;
