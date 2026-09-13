-- =============================================================================
-- Modelos, cores e tamanhos — 2026-09-13
--
-- Pedido: o catálogo e a tela de venda passam a funcionar como página de produto
-- de loja grande (referência: Shein) — um produto com várias cores, cada cor com
-- suas fotos e seus tamanhos, cada tamanho com seu estoque.
--
-- Até aqui, cada linha de `produtos` era "modelo + cor", sem tamanho e com uma
-- foto só. O desenho novo:
--
--   modelos        o produto que o cliente enxerga (nome, descrição, categoria)
--   produtos       vira a VARIAÇÃO: modelo + cor + tamanho. É ela que tem saldo,
--                  preço e código, e é ela que é vendida
--   modelo_fotos   fotos por (modelo, cor) — trocar a cor troca as fotos
--
-- POR QUE `produtos` VIRA A VARIAÇÃO em vez de criar uma tabela nova:
-- estoque espelhado por trigger, trava FOR UPDATE, venda atômica, troca,
-- troca de estoque e faturamento apontam todos para `produtos.id`. Mantendo a
-- variação nessa tabela, nada disso muda — nenhuma das garantias já verificadas
-- precisa ser reescrita nem retestada do zero.
--
-- MIGRAÇÃO SÓ ADITIVA, de propósito. Em 2026-09-13 uma migração que trocou a
-- assinatura de uma função quebrou a tela de troca em produção até o deploy.
-- Aqui nada que o código publicado usa é removido ou renomeado: a view
-- `catalogo_publico`, as colunas antigas e o cadastro por nome continuam
-- funcionando até o código novo subir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Modelos
-- -----------------------------------------------------------------------------
create table if not exists public.modelos (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(btrim(nome)) > 0),
  descricao       text,
  categoria_id    uuid references public.categorias(id) on delete set null,
  ativo           boolean not null default true,
  no_catalogo     boolean not null default true,
  idempotency_key uuid,
  criado_em       timestamptz not null default now()
);

comment on table public.modelos is
  'O produto que o cliente enxerga. Cor e tamanho vivem nas variações (produtos).';

create unique index if not exists modelos_idempotency
  on public.modelos (idempotency_key) where idempotency_key is not null;

-- -----------------------------------------------------------------------------
-- 2. `produtos` vira a variação
-- -----------------------------------------------------------------------------
alter table public.produtos
  add column if not exists modelo_id uuid references public.modelos(id) on delete restrict;

-- Boné costuma ser tamanho único; camisa tem P/M/G. Texto livre porque o que
-- vale é o que está escrito na etiqueta do Tarcio (P, M, 38, "Ajustável"...).
alter table public.produtos
  add column if not exists tamanho text not null default 'Único'
    check (length(btrim(tamanho)) > 0);

-- Um modelo por nome já cadastrado. Só há dados de teste neste ponto.
insert into public.modelos (nome, descricao, categoria_id, ativo, no_catalogo)
select distinct on (lower(btrim(p.modelo)))
       btrim(p.modelo), p.descricao, p.categoria_id, p.ativo, p.no_catalogo
  from public.produtos p
 where p.modelo_id is null
 order by lower(btrim(p.modelo)), p.criado_em;

update public.produtos p
   set modelo_id = m.id
  from public.modelos m
 where p.modelo_id is null
   and lower(btrim(m.nome)) = lower(btrim(p.modelo));

-- `produtos.modelo` (o nome) continua existindo porque venda, faturamento,
-- estoque e troca o exibem. Ele passa a ser ESPELHO de `modelos.nome`, mantido
-- por trigger — uma fonte de verdade só. E o trigger garante `modelo_id` para
-- quem ainda cadastra só pelo nome (o código publicado antes do deploy).
create or replace function private.fn_produto_modelo()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.modelo_id is null then
    select id into new.modelo_id
      from public.modelos
     where lower(btrim(nome)) = lower(btrim(new.modelo))
     limit 1;

    if new.modelo_id is null then
      insert into public.modelos (nome, descricao, categoria_id)
      values (btrim(new.modelo), new.descricao, new.categoria_id)
      returning id into new.modelo_id;
    end if;
  end if;

  select nome into new.modelo from public.modelos where id = new.modelo_id;
  return new;
end; $function$;

drop trigger if exists trg_produto_modelo on public.produtos;
create trigger trg_produto_modelo
  before insert or update of modelo_id, modelo on public.produtos
  for each row execute function private.fn_produto_modelo();

create or replace function private.fn_modelo_renomeado()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.produtos set modelo = new.nome where modelo_id = new.id;
  return new;
end; $function$;

drop trigger if exists trg_modelo_renomeado on public.modelos;
create trigger trg_modelo_renomeado
  after update of nome on public.modelos
  for each row execute function private.fn_modelo_renomeado();

alter table public.produtos alter column modelo_id set not null;

-- A mesma cor no mesmo tamanho não pode existir duas vezes no mesmo modelo.
-- Comparação sem caixa e sem espaço: "Preto " e "preto" são a mesma cor.
create unique index if not exists produtos_variacao_unica
  on public.produtos (modelo_id, lower(btrim(cor)), lower(btrim(tamanho)));

-- -----------------------------------------------------------------------------
-- 3. Fotos por cor
-- -----------------------------------------------------------------------------
create table if not exists public.modelo_fotos (
  id        uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references public.modelos(id) on delete cascade,
  cor       text not null check (length(btrim(cor)) > 0),
  url       text not null,
  caminho   text not null,
  ordem     int  not null default 0,
  criado_em timestamptz not null default now()
);

comment on column public.modelo_fotos.caminho is
  'Caminho no bucket `produtos`. Guardado para apagar o arquivo junto com a linha.';

create index if not exists modelo_fotos_por_cor
  on public.modelo_fotos (modelo_id, lower(btrim(cor)), ordem);

-- Fotos já enviadas (uma por modelo+cor) passam para a tabela nova.
insert into public.modelo_fotos (modelo_id, cor, url, caminho, ordem)
select distinct on (p.modelo_id, lower(btrim(p.cor)))
       p.modelo_id, btrim(p.cor), p.foto_url,
       split_part(p.foto_url, '/object/public/produtos/', 2), 0
  from public.produtos p
 where p.foto_url is not null
   and not exists (
     select 1 from public.modelo_fotos f
      where f.modelo_id = p.modelo_id and lower(btrim(f.cor)) = lower(btrim(p.cor))
   )
 order by p.modelo_id, lower(btrim(p.cor)), p.criado_em;

-- -----------------------------------------------------------------------------
-- 4. Permissões
-- -----------------------------------------------------------------------------
alter table public.modelos      enable row level security;
alter table public.modelo_fotos enable row level security;

drop policy if exists modelos_leitura on public.modelos;
create policy modelos_leitura on public.modelos
  for select to authenticated using ((select private.perfil_ativo()));

drop policy if exists modelos_escrita_dono on public.modelos;
create policy modelos_escrita_dono on public.modelos
  for all to authenticated
  using ((select private.eh_dono())) with check ((select private.eh_dono()));

drop policy if exists modelos_catalogo_anon on public.modelos;
create policy modelos_catalogo_anon on public.modelos
  for select to anon using (ativo and no_catalogo);

drop policy if exists modelo_fotos_leitura on public.modelo_fotos;
create policy modelo_fotos_leitura on public.modelo_fotos
  for select to authenticated using ((select private.perfil_ativo()));

drop policy if exists modelo_fotos_escrita_dono on public.modelo_fotos;
create policy modelo_fotos_escrita_dono on public.modelo_fotos
  for all to authenticated
  using ((select private.eh_dono())) with check ((select private.eh_dono()));

drop policy if exists modelo_fotos_catalogo_anon on public.modelo_fotos;
create policy modelo_fotos_catalogo_anon on public.modelo_fotos
  for select to anon
  using (exists (select 1 from public.modelos m
                  where m.id = modelo_id and m.ativo and m.no_catalogo));

-- O Supabase concede tudo a anon em tabela nova do schema public. Aqui o
-- visitante recebe só leitura, e só das colunas que o catálogo precisa.
revoke all on public.modelos, public.modelo_fotos from anon;
grant select (id, nome, descricao, categoria_id, ativo, no_catalogo) on public.modelos to anon;
grant select (id, modelo_id, cor, url, ordem) on public.modelo_fotos to anon;

-- Colunas novas da variação que o catálogo lê. `estoque_atual` segue de fora:
-- o visitante sabe se tem (`disponivel`), nunca quanto tem.
grant select (modelo_id, tamanho) on public.produtos to anon;

-- -----------------------------------------------------------------------------
-- 5. Catálogo por variação
--
-- `catalogo_publico` fica como está: é o que o site publicado lê até o deploy.
-- -----------------------------------------------------------------------------
create or replace view public.catalogo_variacoes
with (security_invoker = on) as
select p.id,
       p.sku,
       m.id                                  as modelo_id,
       m.nome                                as modelo,
       m.descricao,
       coalesce(c.nome, 'Sem categoria')     as categoria,
       p.cor,
       p.tamanho,
       p.preco_atacado_centavos              as preco_centavos,
       p.disponivel
  from public.produtos p
  join public.modelos m on m.id = p.modelo_id
  left join public.categorias c on c.id = m.categoria_id
 where p.ativo and p.no_catalogo
   and m.ativo and m.no_catalogo
   and p.preco_atacado_centavos is not null;

grant select on public.catalogo_variacoes to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Código da variação
--
-- Gerado quando o dono não informa: MODELO-COR-TAMANHO, legível no balcão.
-- Sem a extensão unaccent: o translate cobre os acentos do português.
-- -----------------------------------------------------------------------------
create or replace function private.gerar_sku(_modelo text, _cor text, _tamanho text)
returns text
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_limpa text := 'áàâãäéèêëíìîïóòôõöúùûüçñ';
  v_troca text := 'aaaaaeeeeiiiiooooouuuucn';
  v_base  text;
  v_sku   text;
  v_n     int := 1;
begin
  v_base := upper(
    left(regexp_replace(translate(lower(_modelo), v_limpa, v_troca), '[^a-z0-9]', '', 'g'), 5)
    || '-' ||
    left(regexp_replace(translate(lower(_cor), v_limpa, v_troca), '[^a-z0-9]', '', 'g'), 3)
    || '-' ||
    left(regexp_replace(translate(lower(_tamanho), v_limpa, v_troca), '[^a-z0-9]', '', 'g'), 4)
  );
  v_sku := v_base;

  while exists (select 1 from public.produtos where sku = v_sku) loop
    v_n := v_n + 1;
    v_sku := v_base || '-' || v_n;
  end loop;

  return v_sku;
end; $function$;

-- -----------------------------------------------------------------------------
-- 7. Cadastro: modelo e variações nascem juntos
--
-- next-dev-integridade §2 — nada de cabeçalho vazio: o modelo só existe se
-- nascer com pelo menos uma variação, na mesma transação.
-- -----------------------------------------------------------------------------
create or replace function public.criar_modelo(
  _nome text,
  _preco_centavos int,
  _variacoes jsonb,
  _preco_atacado_centavos int default null,
  _descricao text default null,
  _categoria_id uuid default null,
  _estoque_minimo int default 3,
  _no_catalogo boolean default true,
  _idempotency_key uuid default null
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_modelo_id uuid;
  v_nome      text;
begin
  if not private.eh_dono() then
    raise exception 'Apenas o dono pode cadastrar produtos.' using errcode = '42501';
  end if;

  v_nome := nullif(btrim(coalesce(_nome, '')), '');
  if v_nome is null then
    raise exception 'Informe o nome do produto.';
  end if;
  if _preco_centavos is null or _preco_centavos < 0 then
    raise exception 'Informe o preço de varejo.';
  end if;
  if _preco_atacado_centavos is not null and _preco_atacado_centavos < 0 then
    raise exception 'Preço de atacado inválido.';
  end if;
  if _variacoes is null or jsonb_array_length(_variacoes) = 0 then
    raise exception 'Informe pelo menos uma cor e um tamanho.';
  end if;

  if _idempotency_key is not null then
    select id into v_modelo_id from public.modelos where idempotency_key = _idempotency_key;
    if v_modelo_id is not null then
      return v_modelo_id;
    end if;
  end if;

  insert into public.modelos (nome, descricao, categoria_id, no_catalogo, idempotency_key)
  values (v_nome, nullif(btrim(coalesce(_descricao, '')), ''), _categoria_id,
          coalesce(_no_catalogo, true), _idempotency_key)
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning id into v_modelo_id;

  if v_modelo_id is null then
    select id into v_modelo_id from public.modelos where idempotency_key = _idempotency_key;
    return v_modelo_id;
  end if;

  perform public.adicionar_variacoes(v_modelo_id, _variacoes,
                                     _preco_centavos, _preco_atacado_centavos,
                                     _estoque_minimo);
  return v_modelo_id;
end; $function$;

-- Nova cor ou tamanho chegou num modelo que já existe. Repetir a mesma
-- variação não dá erro nem duplica: o índice único a ignora. Isso torna a
-- função naturalmente segura contra duplo envio, sem chave.
create or replace function public.adicionar_variacoes(
  _modelo_id uuid,
  _variacoes jsonb,
  _preco_centavos int default null,
  _preco_atacado_centavos int default null,
  _estoque_minimo int default null
) returns int
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_modelo   public.modelos%rowtype;
  v_ref      public.produtos%rowtype;
  v_item     jsonb;
  v_cor      text;
  v_tamanho  text;
  v_sku      text;
  v_preco    int;
  v_atacado  int;
  v_minimo   int;
  v_criadas  int := 0;
  v_id       uuid;
begin
  if not private.eh_dono() then
    raise exception 'Apenas o dono pode cadastrar produtos.' using errcode = '42501';
  end if;

  select * into v_modelo from public.modelos where id = _modelo_id;
  if v_modelo.id is null then
    raise exception 'Produto não encontrado.';
  end if;

  -- Sem preço informado, a variação nova herda o de uma irmã: é o caso comum de
  -- chegar uma cor nova do mesmo boné, pelo mesmo preço.
  select * into v_ref from public.produtos where modelo_id = _modelo_id
   order by criado_em limit 1;

  v_preco   := coalesce(_preco_centavos, v_ref.preco_centavos);
  v_atacado := coalesce(_preco_atacado_centavos, v_ref.preco_atacado_centavos);
  v_minimo  := coalesce(_estoque_minimo, v_ref.estoque_minimo, 3);

  if v_preco is null then
    raise exception 'Informe o preço de varejo.';
  end if;

  if _variacoes is null or jsonb_array_length(_variacoes) = 0 then
    raise exception 'Informe pelo menos uma cor e um tamanho.';
  end if;

  for v_item in select * from jsonb_array_elements(_variacoes)
  loop
    v_cor     := nullif(btrim(coalesce(v_item ->> 'cor', '')), '');
    v_tamanho := coalesce(nullif(btrim(coalesce(v_item ->> 'tamanho', '')), ''), 'Único');

    if v_cor is null then
      raise exception 'Toda variação precisa de cor.';
    end if;

    v_sku := nullif(upper(btrim(coalesce(v_item ->> 'sku', ''))), '');
    if v_sku is null then
      v_sku := private.gerar_sku(v_modelo.nome, v_cor, v_tamanho);
    end if;

    insert into public.produtos (
      modelo_id, modelo, cor, tamanho, sku, preco_centavos, preco_atacado_centavos,
      estoque_minimo, descricao, categoria_id, no_catalogo
    ) values (
      _modelo_id, v_modelo.nome, v_cor, v_tamanho, v_sku, v_preco, v_atacado,
      v_minimo, v_modelo.descricao, v_modelo.categoria_id, true
    )
    on conflict (modelo_id, lower(btrim(cor)), lower(btrim(tamanho))) do nothing
    returning id into v_id;

    if v_id is not null then
      v_criadas := v_criadas + 1;
    end if;
    v_id := null;
  end loop;

  return v_criadas;
exception
  when unique_violation then
    raise exception 'Esse código de produto já existe. Deixe o código em branco para o sistema gerar.';
end; $function$;

-- -----------------------------------------------------------------------------
-- 8. Faturamento por produto mostra o tamanho
--
-- Sem isso, "Camisa · Preta · P" e "Camisa · Preta · G" viram duas linhas com o
-- mesmo rótulo. Coluna nova no fim: o código publicado lê as antigas e ignora.
-- -----------------------------------------------------------------------------
drop function if exists public.faturamento_por_produto(date, date);

create function public.faturamento_por_produto(_de date, _ate date)
returns table(produto_id uuid, sku text, modelo text, cor text, categoria text,
              quantidade bigint, total_centavos bigint, participacao numeric,
              tamanho text)
language sql
stable
set search_path to ''
as $function$
  with linhas as (
    select i.produto_id,
           coalesce(p.sku, '—')                                  as sku,
           coalesce(p.modelo, i.descricao, 'Item avulso')        as modelo,
           coalesce(p.cor, '')                                   as cor,
           coalesce(p.tamanho, '')                               as tamanho,
           case when i.produto_id is null then 'Avulso'
                else coalesce(c.nome, 'Sem categoria') end       as categoria,
           i.quantidade,
           i.subtotal_centavos
      from public.venda_itens i
      join public.vendas v on v.id = i.venda_id
      left join public.produtos p on p.id = i.produto_id
      left join public.categorias c on c.id = p.categoria_id
     where (v.criada_em at time zone 'America/Sao_Paulo')::date between _de and _ate
  ),
  agrupado as (
    select produto_id, sku, modelo, cor, tamanho, categoria,
           sum(quantidade)::bigint        as qtd,
           sum(subtotal_centavos)::bigint as total
      from linhas
     group by produto_id, sku, modelo, cor, tamanho, categoria
  ),
  geral as (select nullif(sum(total), 0) as total_geral from agrupado)
  select a.produto_id, a.sku, a.modelo, a.cor, a.categoria, a.qtd, a.total,
         round(a.total * 100.0 / g.total_geral, 1), a.tamanho
    from agrupado a cross join geral g
   order by a.total desc;
$function$;

-- -----------------------------------------------------------------------------
-- 9. Permissões de execução — revogar de PUBLIC antes de conceder
-- -----------------------------------------------------------------------------
revoke execute on function public.faturamento_por_produto(date, date) from public, anon;
grant  execute on function public.faturamento_por_produto(date, date) to authenticated;

revoke execute on function public.criar_modelo(text, int, jsonb, int, text, uuid, int, boolean, uuid)
  from public, anon;
grant  execute on function public.criar_modelo(text, int, jsonb, int, text, uuid, int, boolean, uuid)
  to authenticated;

revoke execute on function public.adicionar_variacoes(uuid, jsonb, int, int, int) from public, anon;
grant  execute on function public.adicionar_variacoes(uuid, jsonb, int, int, int) to authenticated;

revoke execute on function private.gerar_sku(text, text, text) from public, anon;
