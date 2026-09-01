-- Fase 3 — editor de catálogo (requisito 9 do Tarcio).
-- "o administrador consegue ver o catálogo e consegue editar tudo, dos textos,
--  adicionar a foto do produto e o valor dele no atacado"
--
-- Texto fixo no código faz cada ajuste de vírgula virar chamado de suporte —
-- que na Next é hora cobrada — e deixa o cliente refém da nossa agenda.

alter table public.loja_config
  add column if not exists hero_eyebrow  text,
  add column if not exists hero_titulo   text,
  add column if not exists hero_destaque text,
  add column if not exists hero_texto    text,
  add column if not exists rodape_texto  text;

-- hero_destaque é o trecho pintado DENTRO do título; a ação valida que ele
-- existe lá, senão a cor não aparece e o dono não entende por quê.

create table if not exists public.catalogo_blocos (
  id      uuid primary key default gen_random_uuid(),
  tipo    text not null check (tipo in ('diferencial', 'passo')),
  ordem   int  not null default 0,
  rotulo  text,
  titulo  text not null,
  texto   text not null,
  ativo   boolean not null default true,
  constraint titulo_nao_vazio check (length(btrim(titulo)) > 0),
  constraint texto_nao_vazio  check (length(btrim(texto))  > 0)
);

create index if not exists catalogo_blocos_ordem_idx on public.catalogo_blocos (tipo, ordem);

alter table public.catalogo_blocos enable row level security;

drop policy if exists blocos_leitura on public.catalogo_blocos;
create policy blocos_leitura on public.catalogo_blocos
  for select to authenticated using ((select private.perfil_ativo()));

drop policy if exists blocos_escrita_dono on public.catalogo_blocos;
create policy blocos_escrita_dono on public.catalogo_blocos
  for all to authenticated
  using ((select private.eh_dono())) with check ((select private.eh_dono()));

drop policy if exists blocos_publicos on public.catalogo_blocos;
create policy blocos_publicos on public.catalogo_blocos
  for select to anon using (ativo);

revoke all on public.catalogo_blocos from anon;
grant select (id, tipo, ordem, rotulo, titulo, texto, ativo)
  on public.catalogo_blocos to anon;

grant select (hero_eyebrow, hero_titulo, hero_destaque, hero_texto,
              rodape_texto, pedido_minimo_pecas)
  on public.loja_config to anon;

-- Conteúdo inicial neutro, tirado do que o próprio Tarcio anuncia no perfil.
-- NÃO uso a copy de boné do protótipo: ele vende boné E moda masculina.
-- (bloco de seed aplicado via MCP; ver migração editor_de_catalogo)
