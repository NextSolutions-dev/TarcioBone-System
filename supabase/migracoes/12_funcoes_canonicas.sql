-- =============================================================================
-- VarejoFlow — funções canônicas (estado final)
--
-- Por que este arquivo existe:
-- as migrações 07, 09, 10 e 11 descrevem cada incremento, mas o corpo das
-- funções tinha sido aplicado direto no banco e não estava versionado. Um banco
-- criado só pelas migrações ficava com uma `registrar_venda` que não aceitava
-- canal, avulso, desconto nem frete, e sem nenhuma função de faturamento.
--
-- `registrar_venda` evoluiu entre a 07 e a 09. Repetir o corpo final nas duas
-- deixaria duas cópias divergentes, então a definição final de TODAS as funções
-- mora aqui — este é o último arquivo da sequência e a fonte de verdade.
--
-- Rode 01 → 12 em ordem e o banco fica idêntico ao de produção.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Venda — uma transação só. Nasce inteira ou não nasce.
--
-- Idempotência em duas camadas:
--   1. `idempotency_key` (índice único parcial) — o mesmo envio devolve a mesma venda
--   2. assinatura de conteúdo em janela de 2 min sob advisory lock — pega o
--      duplo clique que gerou chave nova
--
-- ORDEM IMPORTA: o cabeçalho nasce com o dinheiro ZERADO e só recebe
-- subtotal/desconto/frete/total no fim. Gravar o desconto no insert quebra a
-- constraint `desconto_cabe_no_subtotal`, porque o subtotal ainda é zero — foi
-- exatamente assim que o defeito apareceu em 2026-08-30.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_venda(
  _itens jsonb,
  _forma_pagamento text,
  _cliente_nome text default null,
  _observacao text default null,
  _origem text default 'sistema',
  _idempotency_key uuid default null,
  _cliente_id uuid default null,
  _canal text default 'varejo',
  _desconto_centavos integer default 0,
  _desconto_motivo text default null,
  _frete_centavos integer default 0
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_perfil_id   uuid;
  v_venda_id    uuid;
  v_item        jsonb;
  v_produto     public.produtos%rowtype;
  v_qtd         int;
  v_preco       int;
  v_subtotal    int := 0;
  v_assinatura  text;
  v_catalogo    jsonb;
  v_avulsos     jsonb;
  v_nome        text;
  v_desc        text;
begin
  select id into v_perfil_id from public.perfis
   where id = (select auth.uid()) and ativo;

  if v_perfil_id is null then
    raise exception 'Usuário sem perfil ativo no sistema.' using errcode = '42501';
  end if;

  if _canal not in ('varejo', 'atacado') then
    raise exception 'Canal inválido.';
  end if;

  if _itens is null or jsonb_array_length(_itens) = 0 then
    raise exception 'A venda precisa de pelo menos um item.';
  end if;

  if coalesce(_desconto_centavos, 0) < 0 or coalesce(_frete_centavos, 0) < 0 then
    raise exception 'Desconto e frete não podem ser negativos.';
  end if;

  if _cliente_id is not null then
    select nome into v_nome from public.clientes where id = _cliente_id and ativo;
    if v_nome is null then
      raise exception 'Cliente não encontrado ou inativo.';
    end if;
  else
    v_nome := nullif(btrim(coalesce(_cliente_nome, '')), '');
  end if;

  -- Itens de catálogo, agregados por produto e ordenados: a assinatura precisa
  -- ser estável, senão a mesma venda gera hashes diferentes.
  select jsonb_agg(x order by x ->> 'produto_id')
    into v_catalogo
    from (
      select jsonb_build_object(
               'produto_id', e ->> 'produto_id',
               'quantidade', sum((e ->> 'quantidade')::int)
             ) as x
        from jsonb_array_elements(_itens) e
       where e ->> 'produto_id' is not null
       group by e ->> 'produto_id'
    ) s;

  select jsonb_agg(e order by e ->> 'descricao')
    into v_avulsos
    from jsonb_array_elements(_itens) e
   where e ->> 'produto_id' is null;

  v_assinatura := md5(
    coalesce(v_catalogo::text, '') || coalesce(v_avulsos::text, '') ||
    coalesce(v_nome, '') || _forma_pagamento || _canal ||
    coalesce(_desconto_centavos, 0)::text || coalesce(_frete_centavos, 0)::text
  );

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

  -- Cabeçalho nasce ZERADO no dinheiro: o subtotal só existe depois dos itens.
  insert into public.vendas (
    vendedor_id, cliente_id, cliente_nome, forma_pagamento, origem, canal,
    observacao, idempotency_key, assinatura, desconto_motivo
  ) values (
    v_perfil_id, _cliente_id, v_nome, _forma_pagamento, _origem, _canal,
    nullif(btrim(coalesce(_observacao, '')), ''), _idempotency_key, v_assinatura,
    nullif(btrim(coalesce(_desconto_motivo, '')), '')
  )
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning id into v_venda_id;

  if v_venda_id is null then
    select id into v_venda_id from public.vendas where idempotency_key = _idempotency_key;
    return v_venda_id;
  end if;

  -- Itens de catálogo: movem estoque e respeitam o preço do canal.
  for v_item in select * from jsonb_array_elements(coalesce(v_catalogo, '[]'::jsonb))
  loop
    v_qtd := (v_item ->> 'quantidade')::int;
    if v_qtd <= 0 then
      raise exception 'Quantidade inválida na venda.';
    end if;

    -- FOR UPDATE: é isto que impede dois celulares de venderem a última peça.
    select * into v_produto from public.produtos
     where id = (v_item ->> 'produto_id')::uuid for update;

    if v_produto.id is null then
      raise exception 'Produto não encontrado.';
    end if;
    if not v_produto.ativo then
      raise exception 'O produto % (%) está inativo e não pode ser vendido.',
        v_produto.modelo, v_produto.cor;
    end if;

    -- Quem escolhe o preço é o banco, nunca a tela.
    if _canal = 'atacado' then
      v_preco := v_produto.preco_atacado_centavos;
      if v_preco is null then
        raise exception 'O produto % (%) não tem preço de atacado cadastrado.',
          v_produto.modelo, v_produto.cor;
      end if;
    else
      v_preco := v_produto.preco_centavos;
    end if;

    if v_produto.estoque_atual < v_qtd then
      raise exception 'Estoque insuficiente de % (%): resta(m) % peça(s) e a venda pede %.',
        v_produto.modelo, v_produto.cor, v_produto.estoque_atual, v_qtd;
    end if;

    insert into public.venda_itens (venda_id, produto_id, quantidade, preco_unitario_centavos)
    values (v_venda_id, v_produto.id, v_qtd, v_preco);

    insert into public.estoque_movimentos (produto_id, tipo, quantidade, motivo, venda_id, criado_por)
    values (v_produto.id, 'saida', -v_qtd, 'Venda', v_venda_id, v_perfil_id);

    v_subtotal := v_subtotal + (v_qtd * v_preco);
  end loop;

  -- Avulsos: NÃO geram movimento de estoque. É coisa fora do cadastro, não há
  -- saldo para baixar; inventar produto fantasma sujaria catálogo e ranking.
  for v_item in select * from jsonb_array_elements(coalesce(v_avulsos, '[]'::jsonb))
  loop
    v_qtd   := (v_item ->> 'quantidade')::int;
    v_desc  := nullif(btrim(coalesce(v_item ->> 'descricao', '')), '');
    v_preco := (v_item ->> 'preco_centavos')::int;

    if v_desc is null then
      raise exception 'Item avulso precisa de descrição.';
    end if;
    if v_qtd <= 0 then
      raise exception 'Quantidade inválida no item avulso "%".', v_desc;
    end if;
    if v_preco is null or v_preco < 0 then
      raise exception 'Valor inválido no item avulso "%".', v_desc;
    end if;

    insert into public.venda_itens (venda_id, produto_id, descricao, quantidade, preco_unitario_centavos)
    values (v_venda_id, null, v_desc, v_qtd, v_preco);

    v_subtotal := v_subtotal + (v_qtd * v_preco);
  end loop;

  if coalesce(_desconto_centavos, 0) > v_subtotal then
    raise exception 'O desconto (R$ %) é maior que o valor dos itens (R$ %).',
      private.reais(coalesce(_desconto_centavos, 0)),
      private.reais(v_subtotal);
  end if;

  -- Todo o dinheiro gravado de uma vez, com o subtotal já conhecido.
  update public.vendas
     set subtotal_centavos = v_subtotal,
         desconto_centavos = coalesce(_desconto_centavos, 0),
         frete_centavos    = coalesce(_frete_centavos, 0),
         total_centavos    = v_subtotal - coalesce(_desconto_centavos, 0)
                             + coalesce(_frete_centavos, 0)
   where id = v_venda_id;

  return v_venda_id;
end; $function$;

-- -----------------------------------------------------------------------------
-- Entrada de estoque — só o dono. Estoque nunca é digitado: o saldo é espelho
-- mantido por trigger sobre estoque_movimentos.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_entrada_estoque(
  _produto_id uuid,
  _quantidade integer,
  _motivo text default 'Entrada de mercadoria'
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
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
    _quantidade, _motivo, v_perfil_id
  )
  returning id into v_id;

  return v_id;
end; $function$;

-- =============================================================================
-- Relatórios
--
-- Todos SECURITY INVOKER de propósito: a RLS do chamador é que decide o que ele
-- enxerga. É isso que faz a vendedora ver só as vendas dela sem nenhum filtro
-- na tela — e é o motivo de não existir `security definer` aqui.
--
-- A ponte que o dono lê:
--   bruto − desconto = receita de produto ; + frete = o que entrou
-- Frete NÃO é receita de produto. Somado junto, infla o faturamento.
-- =============================================================================

create or replace function public.resumo_faturamento(_de date, _ate date)
returns table(bruto_centavos bigint, desconto_centavos bigint, produto_centavos bigint,
              frete_centavos bigint, total_centavos bigint, vendas bigint,
              pecas bigint, ticket_centavos bigint)
language sql
stable
set search_path to ''
as $function$
  with periodo as (
    select v.*
      from public.vendas v
     where (v.criada_em at time zone 'America/Sao_Paulo')::date between _de and _ate
  )
  select coalesce(sum(p.subtotal_centavos), 0)::bigint,
         coalesce(sum(p.desconto_centavos), 0)::bigint,
         coalesce(sum(p.subtotal_centavos - p.desconto_centavos), 0)::bigint,
         coalesce(sum(p.frete_centavos), 0)::bigint,
         coalesce(sum(p.total_centavos), 0)::bigint,
         count(*)::bigint,
         coalesce((select sum(i.quantidade) from public.venda_itens i
                    where i.venda_id in (select id from periodo)), 0)::bigint,
         case when count(*) = 0 then 0
              else (coalesce(sum(p.total_centavos), 0) / count(*))::bigint end
    from periodo p;
$function$;

-- Por produto o valor é BRUTO. Não rateio o desconto entre produtos: seria mais
-- "correto" na contabilidade e menos explicável para quem lê sozinho.
-- Avulso aparece pelo nome, na categoria "Avulso" — o detalhamento não mente
-- sobre o que foi vendido.
create or replace function public.faturamento_por_produto(_de date, _ate date)
returns table(produto_id uuid, sku text, modelo text, cor text, categoria text,
              quantidade bigint, total_centavos bigint, participacao numeric)
language sql
stable
set search_path to ''
as $function$
  with linhas as (
    select i.produto_id,
           coalesce(p.sku, '—')                                  as sku,
           coalesce(p.modelo, i.descricao, 'Item avulso')        as modelo,
           coalesce(p.cor, '')                                   as cor,
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
    select produto_id, sku, modelo, cor, categoria,
           sum(quantidade)::bigint        as qtd,
           sum(subtotal_centavos)::bigint as total
      from linhas
     group by produto_id, sku, modelo, cor, categoria
  ),
  geral as (select nullif(sum(total), 0) as total_geral from agrupado)
  select a.produto_id, a.sku, a.modelo, a.cor, a.categoria, a.qtd, a.total,
         round(a.total * 100.0 / g.total_geral, 1)
    from agrupado a cross join geral g
   order by a.total desc;
$function$;

-- Faturamento diário — pedido literal do cliente.
create or replace function public.faturamento_por_dia(_de date, _ate date)
returns table(dia date, vendas bigint, pecas bigint, bruto_centavos bigint,
              desconto_centavos bigint, frete_centavos bigint, total_centavos bigint)
language sql
stable
set search_path to ''
as $function$
  select (v.criada_em at time zone 'America/Sao_Paulo')::date as dia,
         count(*)::bigint,
         coalesce(sum((select sum(i.quantidade) from public.venda_itens i
                        where i.venda_id = v.id)), 0)::bigint,
         coalesce(sum(v.subtotal_centavos), 0)::bigint,
         coalesce(sum(v.desconto_centavos), 0)::bigint,
         coalesce(sum(v.frete_centavos), 0)::bigint,
         coalesce(sum(v.total_centavos), 0)::bigint
    from public.vendas v
   where (v.criada_em at time zone 'America/Sao_Paulo')::date between _de and _ate
   group by 1
   order by 1 desc;
$function$;

-- Atacado × varejo. Ele vende nos dois; somados num número só não dá para saber
-- qual das duas pernas sustenta a loja.
create or replace function public.faturamento_por_canal(_de date, _ate date)
returns table(canal text, vendas bigint, pecas bigint, bruto_centavos bigint,
              desconto_centavos bigint, frete_centavos bigint, total_centavos bigint,
              participacao numeric)
language sql
stable
set search_path to ''
as $function$
  with periodo as (
    select v.*
      from public.vendas v
     where (v.criada_em at time zone 'America/Sao_Paulo')::date between _de and _ate
  ),
  por_canal as (
    select p.canal,
           count(*)::bigint                                    as vendas,
           coalesce((select sum(i.quantidade) from public.venda_itens i
                      where i.venda_id in (select id from periodo p2 where p2.canal = p.canal)
                    ), 0)::bigint                              as pecas,
           coalesce(sum(p.subtotal_centavos), 0)::bigint       as bruto,
           coalesce(sum(p.desconto_centavos), 0)::bigint       as desconto,
           coalesce(sum(p.frete_centavos), 0)::bigint          as frete,
           coalesce(sum(p.total_centavos), 0)::bigint          as total
      from periodo p
     group by p.canal
  ),
  geral as (select nullif(sum(total), 0) as total_geral from por_canal)
  select c.canal, c.vendas, c.pecas, c.bruto, c.desconto, c.frete, c.total,
         round(c.total * 100.0 / g.total_geral, 1)
    from por_canal c cross join geral g
   order by c.total desc;
$function$;

-- -----------------------------------------------------------------------------
-- Permissões de execução
--
-- `grant execute … to authenticated` é obrigatório: sem ele a RPC existe e
-- responde "function not found" pelo PostgREST.
--
-- E o visitante não executa relatório nenhum. O grant a `anon` existia por
-- descuido (copiar `to anon, authenticated` do catálogo). Não vazava — o
-- `revoke all on vendas from anon` da 03 fazia a função morrer em
-- "permission denied for table vendas" — mas grant que não deveria existir sai.
-- -----------------------------------------------------------------------------
revoke execute on function public.resumo_faturamento(date, date)      from anon;
revoke execute on function public.faturamento_por_produto(date, date) from anon;
revoke execute on function public.faturamento_por_dia(date, date)     from anon;
revoke execute on function public.faturamento_por_canal(date, date)   from anon;

grant execute on function public.registrar_venda(
        jsonb, text, text, text, text, uuid, uuid, text, integer, text, integer
      ) to authenticated;
grant execute on function public.registrar_entrada_estoque(uuid, integer, text) to authenticated;
grant execute on function public.resumo_faturamento(date, date)      to authenticated;
grant execute on function public.faturamento_por_produto(date, date) to authenticated;
grant execute on function public.faturamento_por_dia(date, date)     to authenticated;
grant execute on function public.faturamento_por_canal(date, date)   to authenticated;
