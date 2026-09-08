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
--
-- É só ponto de partida: tudo isto é editável na tela Ajustes. O `on conflict
-- do nothing` existe para a migração poder rodar de novo sem sobrescrever o
-- que o dono já escreveu.

insert into public.loja_config (
  id, nome_loja, hero_eyebrow, hero_titulo, hero_destaque, hero_texto,
  rodape_texto, pedido_minimo_pecas
) values (
  true,
  'Minha Loja',
  'Atacado e varejo',
  'Preço de fábrica, direto com a gente.',
  'direto com a gente',
  'Monte seu pedido aqui e finalize no WhatsApp. Enviamos para todo o Brasil.',
  'Atendimento online e por vídeo chamada.',
  0
)
on conflict (id) do nothing;

insert into public.catalogo_blocos (tipo, ordem, rotulo, titulo, texto) values
  ('diferencial', 1, 'PREÇO DE FÁBRICA', 'Direto do distribuidor',
   'Sem intermediário encarecendo o caminho até a sua loja.'),
  ('diferencial', 2, 'ENVIO NACIONAL', 'Chega em todo o Brasil',
   'Combinamos frete e prazo na conversa, antes de fechar.'),
  ('diferencial', 3, 'ATENDIMENTO', 'Online e por vídeo chamada',
   'Dá para ver a peça de perto antes de decidir.'),
  ('passo', 1, '01', 'Monte o pedido',
   'Escolha os itens aqui na página. A sacola vai somando.'),
  ('passo', 2, '02', 'Mande no WhatsApp',
   'O pedido chega escrito, com cada item e o total — e um link com as fotos.'),
  ('passo', 3, '03', 'Combine na conversa',
   'Pagamento, frete e prazo a gente acerta ali mesmo.')
on conflict do nothing;
