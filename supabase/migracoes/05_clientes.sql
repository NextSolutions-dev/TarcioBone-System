-- =============================================================================
-- Fase 1.1 — Clientes de verdade
--
-- Por quê: o Tácio pediu "opção no sistema pra enviar mensagem pro Cliente".
-- Hoje `vendas.cliente_nome` é texto livre solto — não há telefone, então não
-- há para quem mandar. Sem esta tabela, três requisitos ficam impossíveis:
-- mensagem ao cliente, troca (precisa saber de quem) e frete (quem paga).
--
-- Decisões conscientes:
--   * `cliente_id` é ANULÁVEL. Venda de balcão não pode exigir cadastro — seria
--     fricção no exato momento em que o cliente está esperando. `cliente_nome`
--     continua existindo como texto livre para esses casos.
--   * Telefone NÃO é único. Em família é comum dois clientes dividirem o mesmo
--     número; travar no banco quebraria caso legítimo. A defesa contra duplicata
--     é a busca na tela, que avisa "já existe cliente com esse telefone".
--   * Telefone guardado só em dígitos, com DDI, porque é isso que o link do
--     WhatsApp consome. A máscara é coisa de exibição.
-- =============================================================================

create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  telefone    text,
  cidade      text,
  observacao  text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  criado_por  uuid references public.perfis,

  constraint telefone_so_digitos check (telefone is null or telefone ~ '^[0-9]{10,15}$'),
  constraint nome_nao_vazio      check (length(btrim(nome)) > 0)
);

comment on table public.clientes is
  'Clientes da loja. Cadastro é opcional na venda de balcão — cliente_id em vendas é anulável.';
comment on column public.clientes.telefone is
  'Somente dígitos, com DDI (ex.: 5581999990000). É o formato que o link do WhatsApp consome.';

create index if not exists clientes_nome_idx     on public.clientes (lower(nome));
create index if not exists clientes_telefone_idx on public.clientes (telefone) where telefone is not null;

-- -----------------------------------------------------------------------------
-- Vínculo com a venda
-- -----------------------------------------------------------------------------
alter table public.vendas
  add column if not exists cliente_id uuid references public.clientes;

comment on column public.vendas.cliente_id is
  'Anulável de propósito: venda de balcão não exige cadastro. Quando nulo, vale cliente_nome.';

create index if not exists vendas_cliente_idx on public.vendas (cliente_id) where cliente_id is not null;

-- -----------------------------------------------------------------------------
-- RLS — quem está logado lê e cadastra; só o dono apaga
-- Vendedor precisa cadastrar cliente no balcão, então insert/update é de todos.
-- -----------------------------------------------------------------------------
alter table public.clientes enable row level security;

drop policy if exists clientes_leitura on public.clientes;
create policy clientes_leitura on public.clientes
  for select to authenticated
  using ((select private.perfil_ativo()));

drop policy if exists clientes_cadastro on public.clientes;
create policy clientes_cadastro on public.clientes
  for insert to authenticated
  with check ((select private.perfil_ativo()));

drop policy if exists clientes_edicao on public.clientes;
create policy clientes_edicao on public.clientes
  for update to authenticated
  using ((select private.perfil_ativo()))
  with check ((select private.perfil_ativo()));

drop policy if exists clientes_exclusao_dono on public.clientes;
create policy clientes_exclusao_dono on public.clientes
  for delete to authenticated
  using ((select private.eh_dono()));

-- O visitante do catálogo nunca enxerga a base de clientes.
revoke all on public.clientes from anon;

-- -----------------------------------------------------------------------------
-- A RPC de venda passa a aceitar o cliente
-- Assinatura muda ⇒ derruba a antiga, senão o PostgREST fica com duas
-- sobrecargas ambíguas (next-dev-integridade §1).
-- -----------------------------------------------------------------------------
drop function if exists public.registrar_venda(jsonb, text, text, text, text, uuid);

create or replace function public.registrar_venda(
  _itens            jsonb,
  _forma_pagamento  text,
  _cliente_nome     text default null,
  _observacao       text default null,
  _origem           text default 'sistema',
  _idempotency_key  uuid default null,
  _cliente_id       uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_perfil_id   uuid;
  v_venda_id    uuid;
  v_item        jsonb;
  v_produto     public.produtos%rowtype;
  v_qtd         int;
  v_total       int := 0;
  v_assinatura  text;
  v_normalizado jsonb;
  v_nome        text;
begin
  select id into v_perfil_id from public.perfis
   where id = (select auth.uid()) and ativo;

  if v_perfil_id is null then
    raise exception 'Usuário sem perfil ativo no sistema.' using errcode = '42501';
  end if;

  if _itens is null or jsonb_array_length(_itens) = 0 then
    raise exception 'A venda precisa de pelo menos um item.';
  end if;

  -- Cliente cadastrado manda no nome; texto livre só vale quando não há cadastro.
  if _cliente_id is not null then
    select nome into v_nome from public.clientes where id = _cliente_id and ativo;
    if v_nome is null then
      raise exception 'Cliente não encontrado ou inativo.';
    end if;
  else
    v_nome := nullif(btrim(coalesce(_cliente_nome, '')), '');
  end if;

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

  v_assinatura := md5(v_normalizado::text || coalesce(v_nome, '') || _forma_pagamento);

  if _idempotency_key is not null then
    select id into v_venda_id from public.vendas where idempotency_key = _idempotency_key;
    if v_venda_id is not null then
      return v_venda_id;
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_perfil_id::text, 0));

  select id into v_venda_id from public.vendas
   where vendedor_id = v_perfil_id
     and assinatura = v_assinatura
     and criada_em > now() - interval '2 minutes';

  if v_venda_id is not null then
    raise exception 'Esta venda já foi registrada há menos de 2 minutos. Atualize a tela antes de repetir.';
  end if;

  insert into public.vendas (
    vendedor_id, cliente_id, cliente_nome, forma_pagamento, origem,
    observacao, idempotency_key, assinatura
  ) values (
    v_perfil_id, _cliente_id, v_nome, _forma_pagamento, _origem,
    nullif(btrim(coalesce(_observacao, '')), ''), _idempotency_key, v_assinatura
  )
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning id into v_venda_id;

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

    select * into v_produto from public.produtos
     where id = (v_item ->> 'produto_id')::uuid
     for update;

    if v_produto.id is null then
      raise exception 'Produto não encontrado.';
    end if;

    if not v_produto.ativo then
      raise exception 'O produto % (%) está inativo e não pode ser vendido.', v_produto.modelo, v_produto.cor;
    end if;

    if v_produto.estoque_atual < v_qtd then
      raise exception 'Estoque insuficiente de % (%): resta(m) % peça(s) e a venda pede %.',
        v_produto.modelo, v_produto.cor, v_produto.estoque_atual, v_qtd;
    end if;

    insert into public.venda_itens (venda_id, produto_id, quantidade, preco_unitario_centavos)
    values (v_venda_id, v_produto.id, v_qtd, v_produto.preco_centavos);

    insert into public.estoque_movimentos (produto_id, tipo, quantidade, motivo, venda_id, criado_por)
    values (v_produto.id, 'saida', -v_qtd, 'Venda', v_venda_id, v_perfil_id);

    v_total := v_total + (v_qtd * v_produto.preco_centavos);
  end loop;

  update public.vendas set total_centavos = v_total where id = v_venda_id;

  return v_venda_id;
end; $fn$;

revoke all on function public.registrar_venda(jsonb, text, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.registrar_venda(jsonb, text, text, text, text, uuid, uuid) to authenticated;
