-- =============================================================================
-- VarejoFlow — automatismos e RPCs
-- Por quê: tudo que precisa ser garantido de verdade mora aqui, não no front.
--   * O saldo de estoque se move sozinho quando entra um movimento.
--   * A venda nasce inteira ou não nasce (transação única).
--   * Duplo envio de 6 celulares não vira 6 vendas (idempotência + advisory lock).
--   * Dois celulares vendendo a última peça: um ganha, o outro recebe recusa
--     clara — garantido por FOR UPDATE + CHECK (estoque_atual >= 0).
-- =============================================================================

alter table public.vendas add column if not exists assinatura text;
comment on column public.vendas.assinatura is
  'Hash do conteúdo da venda. Usado para barrar repetição por F5 (chave nova, mesmo conteúdo).';

-- -----------------------------------------------------------------------------
-- Helpers de papel
-- -----------------------------------------------------------------------------
create or replace function private.eh_dono() returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.perfis
     where id = (select auth.uid()) and papel = 'dono' and ativo
  );
$$;

create or replace function private.perfil_ativo() returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.perfis where id = (select auth.uid()) and ativo
  );
$$;

-- ⚠️ Sem estes grants as policies falham silenciosamente (armadilha do JDFlow).
grant usage on schema private to authenticated;
grant execute on function private.eh_dono() to authenticated;
grant execute on function private.perfil_ativo() to authenticated;

-- -----------------------------------------------------------------------------
-- Espelho de estoque: movimento manda, produtos.estoque_atual obedece
-- -----------------------------------------------------------------------------
create or replace function private.fn_aplicar_movimento() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.produtos
       set estoque_atual = estoque_atual + new.quantidade
     where id = new.produto_id;
    return new;
  end if;

  -- Excluiu o movimento (ou a venda, em cascata): o saldo volta.
  update public.produtos
     set estoque_atual = estoque_atual - old.quantidade
   where id = old.produto_id;
  return old;
end; $$;

drop trigger if exists trg_aplicar_movimento on public.estoque_movimentos;
create trigger trg_aplicar_movimento
  after insert or delete on public.estoque_movimentos
  for each row execute function private.fn_aplicar_movimento();

-- Movimento é histórico: não se edita, só se cria ou se apaga.
create or replace function private.fn_movimento_imutavel() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Movimento de estoque não pode ser editado. Registre um ajuste.';
end; $$;

drop trigger if exists trg_movimento_imutavel on public.estoque_movimentos;
create trigger trg_movimento_imutavel
  before update on public.estoque_movimentos
  for each row execute function private.fn_movimento_imutavel();

-- -----------------------------------------------------------------------------
-- RPC: registrar venda (o coração do sistema)
-- -----------------------------------------------------------------------------
create or replace function public.registrar_venda(
  _itens            jsonb,                    -- [{ "produto_id": uuid, "quantidade": int }]
  _forma_pagamento  text,
  _cliente_nome     text default null,
  _observacao       text default null,
  _origem           text default 'sistema',
  _idempotency_key  uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_perfil_id   uuid;
  v_venda_id    uuid;
  v_item        jsonb;
  v_produto     public.produtos%rowtype;
  v_qtd         int;
  v_total       int := 0;
  v_assinatura  text;
  v_normalizado jsonb;
begin
  select id into v_perfil_id
    from public.perfis
   where id = (select auth.uid()) and ativo;

  if v_perfil_id is null then
    raise exception 'Usuário sem perfil ativo no sistema.' using errcode = '42501';
  end if;

  if _itens is null or jsonb_array_length(_itens) = 0 then
    raise exception 'A venda precisa de pelo menos um item.';
  end if;

  -- Soma itens repetidos e ordena por produto: ordem estável evita travamento
  -- cruzado quando dois celulares vendem os mesmos produtos ao mesmo tempo.
  select jsonb_agg(x order by x ->> 'produto_id')
    into v_normalizado
    from (
      select jsonb_build_object(
               'produto_id', e ->> 'produto_id',
               'quantidade', sum((e ->> 'quantidade')::int)
             ) as x
        from jsonb_array_elements(_itens) e
       group by e ->> 'produto_id'
    ) s;

  v_assinatura := md5(v_normalizado::text || coalesce(_cliente_nome, '') || _forma_pagamento);

  -- CAMADA 1 — a mesma tentativa chegou duas vezes: devolve o que já existe.
  if _idempotency_key is not null then
    select id into v_venda_id from public.vendas where idempotency_key = _idempotency_key;
    if v_venda_id is not null then
      return v_venda_id;
    end if;
  end if;

  -- CAMADA 2 — F5 gera chave nova. Serializa o vendedor para que a checagem
  -- enxergue a venda irmã ainda não commitada.
  perform pg_advisory_xact_lock(hashtextextended(v_perfil_id::text, 0));

  select id into v_venda_id
    from public.vendas
   where vendedor_id = v_perfil_id
     and assinatura = v_assinatura
     and criada_em > now() - interval '2 minutes';

  if v_venda_id is not null then
    raise exception 'Esta venda já foi registrada há menos de 2 minutos. Atualize a tela antes de repetir.';
  end if;

  insert into public.vendas (
    vendedor_id, cliente_nome, forma_pagamento, origem,
    observacao, idempotency_key, assinatura
  ) values (
    v_perfil_id, nullif(trim(coalesce(_cliente_nome, '')), ''), _forma_pagamento, _origem,
    nullif(trim(coalesce(_observacao, '')), ''), _idempotency_key, v_assinatura
  )
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning id into v_venda_id;

  -- Corrida entre o select e o insert: a irmã ganhou, devolve a dela.
  if v_venda_id is null then
    select id into v_venda_id from public.vendas where idempotency_key = _idempotency_key;
    return v_venda_id;
  end if;

  for v_item in select * from jsonb_array_elements(v_normalizado)
  loop
    v_qtd := (v_item ->> 'quantidade')::int;

    if v_qtd <= 0 then
      raise exception 'Quantidade inválida na venda.';
    end if;

    -- FOR UPDATE: o segundo celular espera aqui em vez de ler saldo velho.
    select * into v_produto
      from public.produtos
     where id = (v_item ->> 'produto_id')::uuid
     for update;

    if v_produto.id is null then
      raise exception 'Produto não encontrado.';
    end if;

    if not v_produto.ativo then
      raise exception 'O produto % (%) está inativo e não pode ser vendido.',
        v_produto.modelo, v_produto.cor;
    end if;

    if v_produto.estoque_atual < v_qtd then
      raise exception 'Estoque insuficiente de % (%): resta(m) % peça(s) e a venda pede %.',
        v_produto.modelo, v_produto.cor, v_produto.estoque_atual, v_qtd;
    end if;

    insert into public.venda_itens (venda_id, produto_id, quantidade, preco_unitario_centavos)
    values (v_venda_id, v_produto.id, v_qtd, v_produto.preco_centavos);

    -- Um fato, um lançamento: a venda move o estoque sozinha.
    insert into public.estoque_movimentos (produto_id, tipo, quantidade, motivo, venda_id, criado_por)
    values (v_produto.id, 'saida', -v_qtd, 'Venda', v_venda_id, v_perfil_id);

    v_total := v_total + (v_qtd * v_produto.preco_centavos);
  end loop;

  update public.vendas set total_centavos = v_total where id = v_venda_id;

  return v_venda_id;
end; $$;

revoke all on function public.registrar_venda(jsonb, text, text, text, text, uuid) from public, anon;
grant execute on function public.registrar_venda(jsonb, text, text, text, text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: entrada de mercadoria (só o dono)
-- -----------------------------------------------------------------------------
create or replace function public.registrar_entrada_estoque(
  _produto_id  uuid,
  _quantidade  int,
  _motivo      text default 'Entrada de mercadoria'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_perfil_id uuid;
  v_id        uuid;
begin
  if not private.eh_dono() then
    raise exception 'Apenas o dono pode dar entrada em estoque.' using errcode = '42501';
  end if;

  if _quantidade = 0 then
    raise exception 'Informe uma quantidade diferente de zero.';
  end if;

  select id into v_perfil_id from public.perfis where id = (select auth.uid());

  insert into public.estoque_movimentos (produto_id, tipo, quantidade, motivo, criado_por)
  values (
    _produto_id,
    case when _quantidade > 0 then 'entrada' else 'ajuste' end,
    _quantidade,
    _motivo,
    v_perfil_id
  )
  returning id into v_id;

  return v_id;
end; $$;

revoke all on function public.registrar_entrada_estoque(uuid, int, text) from public, anon;
grant execute on function public.registrar_entrada_estoque(uuid, int, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Faturamento — sempre derivado das vendas, nunca lançado
-- security invoker de propósito: a RLS decide o alcance (dono vê tudo,
-- vendedor vê o que ele mesmo vendeu).
-- -----------------------------------------------------------------------------
create or replace function public.faturamento_por_produto(_de date, _ate date)
returns table (
  produto_id    uuid,
  sku           text,
  modelo        text,
  cor           text,
  categoria     text,
  quantidade    bigint,
  total_centavos bigint,
  participacao  numeric
)
language sql stable set search_path = '' as $$
  with periodo as (
    select vi.produto_id,
           sum(vi.quantidade)::bigint        as qtd,
           sum(vi.subtotal_centavos)::bigint as total
      from public.venda_itens vi
      join public.vendas v on v.id = vi.venda_id
     where (v.criada_em at time zone 'America/Sao_Paulo')::date between _de and _ate
     group by vi.produto_id
  ),
  geral as (select nullif(sum(total), 0) as total_geral from periodo)
  select p.id,
         p.sku,
         p.modelo,
         p.cor,
         coalesce(c.nome, 'Sem categoria'),
         pe.qtd,
         pe.total,
         round(pe.total * 100.0 / g.total_geral, 1)
    from periodo pe
    join public.produtos p on p.id = pe.produto_id
    left join public.categorias c on c.id = p.categoria_id
   cross join geral g
   order by pe.total desc;
$$;

create or replace function public.resumo_faturamento(_de date, _ate date)
returns table (
  total_centavos  bigint,
  vendas          bigint,
  pecas           bigint,
  ticket_centavos bigint
)
language sql stable set search_path = '' as $$
  select coalesce(sum(v.total_centavos), 0)::bigint,
         count(*)::bigint,
         coalesce((
           select sum(vi.quantidade)
             from public.venda_itens vi
             join public.vendas v2 on v2.id = vi.venda_id
            where (v2.criada_em at time zone 'America/Sao_Paulo')::date between _de and _ate
         ), 0)::bigint,
         case when count(*) = 0 then 0
              else (coalesce(sum(v.total_centavos), 0) / count(*))::bigint end
    from public.vendas v
   where (v.criada_em at time zone 'America/Sao_Paulo')::date between _de and _ate;
$$;

grant execute on function public.faturamento_por_produto(date, date) to authenticated;
grant execute on function public.resumo_faturamento(date, date) to authenticated;
