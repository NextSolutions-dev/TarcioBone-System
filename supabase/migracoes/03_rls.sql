-- =============================================================================
-- VarejoFlow — permissões (RLS)
-- Por quê: esconder botão não é permissão. Quem manda é o banco.
--
-- Papéis:
--   dono     — retaguarda: produtos, estoque, faturamento total, todas as vendas
--   vendedor — celular: vê o catálogo e o estoque, registra venda, vê as SUAS vendas
--   anon     — visitante do site público: enxerga APENAS a view catalogo_publico
-- =============================================================================

alter table public.perfis             enable row level security;
alter table public.categorias         enable row level security;
alter table public.produtos           enable row level security;
alter table public.vendas             enable row level security;
alter table public.venda_itens        enable row level security;
alter table public.estoque_movimentos enable row level security;

-- -----------------------------------------------------------------------------
-- Perfis
-- -----------------------------------------------------------------------------
drop policy if exists perfis_leitura on public.perfis;
create policy perfis_leitura on public.perfis
  for select to authenticated
  using ((select private.perfil_ativo()));

drop policy if exists perfis_escrita_dono on public.perfis;
create policy perfis_escrita_dono on public.perfis
  for all to authenticated
  using ((select private.eh_dono()))
  with check ((select private.eh_dono()));

-- -----------------------------------------------------------------------------
-- Categorias e produtos — todo mundo logado lê, só o dono escreve
-- -----------------------------------------------------------------------------
drop policy if exists categorias_leitura on public.categorias;
create policy categorias_leitura on public.categorias
  for select to authenticated
  using ((select private.perfil_ativo()));

drop policy if exists categorias_escrita_dono on public.categorias;
create policy categorias_escrita_dono on public.categorias
  for all to authenticated
  using ((select private.eh_dono()))
  with check ((select private.eh_dono()));

drop policy if exists produtos_leitura on public.produtos;
create policy produtos_leitura on public.produtos
  for select to authenticated
  using ((select private.perfil_ativo()));

drop policy if exists produtos_escrita_dono on public.produtos;
create policy produtos_escrita_dono on public.produtos
  for all to authenticated
  using ((select private.eh_dono()))
  with check ((select private.eh_dono()));

-- -----------------------------------------------------------------------------
-- Vendas — dono vê tudo; vendedor vê o que ele vendeu
-- Não existe policy de INSERT: venda só nasce pela RPC registrar_venda.
-- -----------------------------------------------------------------------------
drop policy if exists vendas_leitura on public.vendas;
create policy vendas_leitura on public.vendas
  for select to authenticated
  using (
    (select private.eh_dono())
    or vendedor_id = (select auth.uid())
  );

drop policy if exists vendas_exclusao_dono on public.vendas;
create policy vendas_exclusao_dono on public.vendas
  for delete to authenticated
  using ((select private.eh_dono()));

drop policy if exists venda_itens_leitura on public.venda_itens;
create policy venda_itens_leitura on public.venda_itens
  for select to authenticated
  using (
    exists (
      select 1 from public.vendas v
       where v.id = venda_id
         and ((select private.eh_dono()) or v.vendedor_id = (select auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- Movimentos de estoque — leitura para quem está logado; escrita só por RPC
-- -----------------------------------------------------------------------------
drop policy if exists estoque_mov_leitura on public.estoque_movimentos;
create policy estoque_mov_leitura on public.estoque_movimentos
  for select to authenticated
  using ((select private.perfil_ativo()));

drop policy if exists estoque_mov_exclusao_dono on public.estoque_movimentos;
create policy estoque_mov_exclusao_dono on public.estoque_movimentos
  for delete to authenticated
  using ((select private.eh_dono()));

-- -----------------------------------------------------------------------------
-- Site público — o visitante NÃO enxerga a tabela produtos.
-- Ele recebe permissão real porém limitada: só as linhas do catálogo (RLS) e só
-- as colunas públicas (GRANT por coluna). O saldo vira a coluna gerada
-- `disponivel`, então o visitante sabe se tem, mas nunca quanto tem.
--
-- Desenho corrigido depois do advisor `security_definer_view`: a primeira versão
-- usava uma view com security_invoker = off, o que é um ERROR do linter. Esta
-- versão dispensa isso e é mais segura.

alter table public.produtos
  add column if not exists disponivel boolean
  generated always as (estoque_atual > 0) stored;

comment on column public.produtos.disponivel is
  'Derivada de estoque_atual. É o que o site público enxerga — o saldo real nunca sai.';

drop policy if exists produtos_catalogo_anon on public.produtos;
create policy produtos_catalogo_anon on public.produtos
  for select to anon
  using (ativo and no_catalogo);

drop policy if exists categorias_catalogo_anon on public.categorias;
create policy categorias_catalogo_anon on public.categorias
  for select to anon
  using (true);

grant select (id, sku, modelo, cor, categoria_id, preco_centavos,
              descricao, foto_url, disponivel, ativo, no_catalogo)
  on public.produtos to anon;

grant select (id, nome, ordem) on public.categorias to anon;

drop view if exists public.catalogo_publico;
create view public.catalogo_publico
with (security_invoker = on) as
  select p.id, p.sku, p.modelo, p.cor,
         coalesce(c.nome, 'Sem categoria') as categoria,
         p.preco_centavos, p.descricao, p.foto_url,
         p.disponivel
    from public.produtos p
    left join public.categorias c on c.id = p.categoria_id
   where p.ativo and p.no_catalogo;

grant select on public.catalogo_publico to anon, authenticated;

-- O visitante nunca fala com as tabelas de negócio direto.
revoke all on public.vendas, public.venda_itens,
              public.estoque_movimentos, public.perfis
  from anon;
