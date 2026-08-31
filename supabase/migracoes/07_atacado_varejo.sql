-- Fase 1.3 — atacado × varejo.
-- "Catálogo só atacado, sistema fica responsável pela venda varejo" (Tarcio).
--
-- `preco_centavos` continua sendo o preço de VAREJO — não renomeei para não
-- mexer em RPC, view e telas de um sistema que já roda; o comentário carrega o
-- significado. O de atacado é coluna nova e ANULÁVEL.
--
-- Regra do catálogo: só aparece produto COM preço de atacado. Cair no preço de
-- varejo por falta do outro seria mostrar ao lojista o preço do consumidor final.
--
-- O canal fica na venda porque ele vende atacado na feira também, não só pelo site.

comment on column public.produtos.preco_centavos is
  'Preço de VAREJO (venda pelo sistema). O de atacado é preco_atacado_centavos.';

alter table public.produtos
  add column if not exists preco_atacado_centavos int
  check (preco_atacado_centavos is null or preco_atacado_centavos >= 0);

alter table public.vendas
  add column if not exists canal text not null default 'varejo'
  check (canal in ('varejo', 'atacado'));

create index if not exists vendas_canal_idx on public.vendas (canal, criada_em desc);

alter table public.loja_config
  add column if not exists pedido_minimo_pecas int not null default 0
  check (pedido_minimo_pecas >= 0);

drop view if exists public.catalogo_publico;
create view public.catalogo_publico
with (security_invoker = on) as
  select p.id, p.sku, p.modelo, p.cor,
         coalesce(c.nome, 'Sem categoria')  as categoria,
         p.preco_atacado_centavos           as preco_centavos,
         p.descricao, p.foto_url, p.disponivel
    from public.produtos p
    left join public.categorias c on c.id = p.categoria_id
   where p.ativo and p.no_catalogo and p.preco_atacado_centavos is not null;

grant select on public.catalogo_publico to anon, authenticated;
grant select (preco_atacado_centavos) on public.produtos to anon;

-- A RPC ganha _canal e passa a escolher o preço no servidor.
-- Corpo completo aplicado via MCP em 2026-08-30 (migração atacado_varejo_e_canal);
-- o trecho decisivo é este:
--
--   if _canal = 'atacado' then
--     v_preco := v_produto.preco_atacado_centavos;
--     if v_preco is null then
--       raise exception 'O produto % (%) não tem preço de atacado cadastrado.', ...;
--     end if;
--   else
--     v_preco := v_produto.preco_centavos;
--   end if;
