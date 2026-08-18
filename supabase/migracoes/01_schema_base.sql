-- =============================================================================
-- VarejoFlow — schema base
-- Por quê: sistema de venda + estoque + faturamento para operação de varejo
-- com vários vendedores no celular. Demo/vitrine da Next Solutions.
--
-- Princípios aplicados (next-arquitetura / next-dev-integridade):
--   * Estoque nunca é digitado: `produtos.estoque_atual` é espelho mantido por
--     trigger a partir de `estoque_movimentos` (a verdade auditável).
--   * CHECK (estoque_atual >= 0) é a trava real contra 6 celulares vendendo
--     o último item ao mesmo tempo — disciplina de usuário não resolve isso.
--   * Preço do item é SNAPSHOT: mudar o preço do produto não reescreve o
--     histórico de faturamento.
--   * Faturamento é derivado das vendas, nunca lançado à mão.
-- =============================================================================

create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Perfis (espelho de auth.users com papel)
-- -----------------------------------------------------------------------------
create table if not exists public.perfis (
  id         uuid primary key references auth.users on delete cascade,
  nome       text not null,
  papel      text not null check (papel in ('dono', 'vendedor')),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

comment on table public.perfis is 'Usuários do sistema. dono = retaguarda (notebook); vendedor = balcão/rua (celular).';

-- -----------------------------------------------------------------------------
-- Catálogo
-- -----------------------------------------------------------------------------
create table if not exists public.categorias (
  id     uuid primary key default gen_random_uuid(),
  nome   text not null unique,
  ordem  int  not null default 0
);

create table if not exists public.produtos (
  id              uuid primary key default gen_random_uuid(),
  sku             text not null unique,
  modelo          text not null,
  cor             text not null,
  categoria_id    uuid references public.categorias on delete set null,
  preco_centavos  int  not null check (preco_centavos >= 0),
  estoque_atual   int  not null default 0 check (estoque_atual >= 0),
  estoque_minimo  int  not null default 3 check (estoque_minimo >= 0),
  descricao       text,
  foto_url        text,
  ativo           boolean not null default true,
  no_catalogo     boolean not null default true,
  criado_em       timestamptz not null default now()
);

comment on column public.produtos.estoque_atual is
  'ESPELHO mantido por trigger a partir de estoque_movimentos. Nunca escrever direto.';
comment on column public.produtos.no_catalogo is
  'Se aparece no site público. Produto pode existir no sistema sem estar na vitrine.';

create index if not exists produtos_categoria_idx on public.produtos (categoria_id);
create index if not exists produtos_catalogo_idx  on public.produtos (ativo, no_catalogo);

-- -----------------------------------------------------------------------------
-- Vendas
-- -----------------------------------------------------------------------------
create table if not exists public.vendas (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity,
  vendedor_id      uuid not null references public.perfis,
  cliente_nome     text,
  forma_pagamento  text not null check (forma_pagamento in ('dinheiro', 'pix', 'debito', 'credito')),
  origem           text not null default 'sistema' check (origem in ('sistema', 'catalogo')),
  total_centavos   int  not null default 0 check (total_centavos >= 0),
  observacao       text,
  idempotency_key  uuid,
  criada_em        timestamptz not null default now()
);

comment on column public.vendas.total_centavos is
  'Derivado da soma dos itens dentro da RPC registrar_venda. Nunca digitado.';

-- Trava de duplo envio (next-dev-integridade §1): mesma tentativa = mesma venda.
create unique index if not exists vendas_idempotency_key_uidx
  on public.vendas (idempotency_key) where idempotency_key is not null;

create index if not exists vendas_criada_em_idx  on public.vendas (criada_em desc);
create index if not exists vendas_vendedor_idx   on public.vendas (vendedor_id);

create table if not exists public.venda_itens (
  id                       uuid primary key default gen_random_uuid(),
  venda_id                 uuid not null references public.vendas on delete cascade,
  produto_id               uuid not null references public.produtos,
  quantidade               int  not null check (quantidade > 0),
  preco_unitario_centavos  int  not null check (preco_unitario_centavos >= 0),
  subtotal_centavos        int  generated always as (quantidade * preco_unitario_centavos) stored
);

comment on column public.venda_itens.preco_unitario_centavos is
  'SNAPSHOT do preço no momento da venda. Reajuste de tabela não reescreve histórico.';

create index if not exists venda_itens_venda_idx   on public.venda_itens (venda_id);
create index if not exists venda_itens_produto_idx on public.venda_itens (produto_id);

-- -----------------------------------------------------------------------------
-- Movimentos de estoque — a verdade; estoque_atual é só o espelho
-- -----------------------------------------------------------------------------
create table if not exists public.estoque_movimentos (
  id           uuid primary key default gen_random_uuid(),
  produto_id   uuid not null references public.produtos on delete cascade,
  tipo         text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade   int  not null,          -- delta com sinal: +10 entra, -3 sai
  motivo       text,
  venda_id     uuid references public.vendas on delete cascade,
  criado_por   uuid references public.perfis,
  criado_em    timestamptz not null default now(),

  constraint movimento_sinal_coerente check (
    (tipo = 'entrada' and quantidade > 0) or
    (tipo = 'saida'   and quantidade < 0) or
    (tipo = 'ajuste'  and quantidade <> 0)
  )
);

comment on table public.estoque_movimentos is
  'Fonte de verdade do estoque. Excluir a venda apaga os movimentos em cascata e o '
  'trigger devolve as peças ao saldo — espelho não vira fantasma (integridade §6).';

create index if not exists estoque_mov_produto_idx on public.estoque_movimentos (produto_id, criado_em desc);
