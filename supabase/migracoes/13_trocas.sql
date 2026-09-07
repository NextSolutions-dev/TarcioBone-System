-- =============================================================================
-- Fase 8 — Trocas
--
-- Pedido do cliente (2026-09-06): a venda fica no histórico com data e hora, e o
-- administrador decide caso a caso se aceita a troca — dentro ou fora do prazo.
-- Por isso o sistema **mostra os dias decorridos e não bloqueia nada**: quem
-- decide é gente, o sistema só não deixa a pessoa decidir no escuro.
--
-- Três decisões de desenho:
--
-- 1. A troca NÃO mexe no dinheiro da venda. O valor daquela venda foi recebido
--    de verdade; reescrever o faturamento retroativo faria o relatório mentir
--    sobre o que entrou no caixa naquele dia. Diferença de preço entre a peça
--    devolvida e a nova se registra como venda nova (item avulso).
--
-- 2. A peça devolvida volta ao estoque POR PADRÃO, mas dá para desmarcar.
--    Boné rasgado que voltou não é peça vendável, e somar ao saldo faria o
--    sistema oferecer no catálogo algo que não existe para vender.
--
-- 3. O movimento de troca carrega `venda_id`. Assim, se a venda for excluída,
--    a cascata desfaz a troca junto e o saldo fecha: a saída original volta
--    (+qtd) e a entrada da troca sai (−qtd).
-- =============================================================================

alter table public.loja_config
  add column if not exists troca_prazo_dias int not null default 15
    check (troca_prazo_dias between 0 and 365);

comment on column public.loja_config.troca_prazo_dias is
  'Prazo de referência exibido na tela. NÃO bloqueia troca — o dono decide.';

create table if not exists public.trocas (
  id               uuid primary key default gen_random_uuid(),
  venda_id         uuid not null references public.vendas(id)      on delete cascade,
  venda_item_id    uuid not null references public.venda_itens(id) on delete cascade,
  quantidade       int  not null check (quantidade > 0),
  volta_ao_estoque boolean not null default true,
  motivo           text not null check (length(btrim(motivo)) > 0),
  produto_novo_id  uuid references public.produtos(id),
  quantidade_nova  int check (quantidade_nova is null or quantidade_nova > 0),
  idempotency_key  uuid,
  criada_em        timestamptz not null default now(),
  criada_por       uuid references public.perfis(id),

  -- Ou a troca tem peça nova com quantidade, ou não tem nenhuma das duas.
  constraint peca_nova_coerente check (
    (produto_novo_id is null and quantidade_nova is null) or
    (produto_novo_id is not null and quantidade_nova is not null)
  )
);

comment on table public.trocas is
  'Troca de peça de uma venda. Não altera o dinheiro da venda de origem.';

create unique index if not exists trocas_idempotency
  on public.trocas (idempotency_key) where idempotency_key is not null;

create index if not exists trocas_por_venda on public.trocas (venda_id);

-- -----------------------------------------------------------------------------
-- Permissões: leitura para quem enxerga a venda; escrita só pela RPC.
-- -----------------------------------------------------------------------------
alter table public.trocas enable row level security;

drop policy if exists trocas_leitura on public.trocas;
create policy trocas_leitura on public.trocas
  for select to authenticated
  using (
    exists (
      select 1 from public.vendas v
       where v.id = venda_id
         and ((select private.eh_dono()) or v.vendedor_id = (select auth.uid()))
    )
  );

drop policy if exists trocas_exclusao_dono on public.trocas;
create policy trocas_exclusao_dono on public.trocas
  for delete to authenticated
  using ((select private.eh_dono()));

revoke all on public.trocas from anon;

-- -----------------------------------------------------------------------------
-- registrar_troca — uma transação só, como a venda.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_troca(
  _venda_item_id uuid,
  _quantidade int,
  _motivo text,
  _volta_ao_estoque boolean default true,
  _produto_novo_id uuid default null,
  _quantidade_nova int default null,
  _idempotency_key uuid default null
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_perfil_id  uuid;
  v_item       public.venda_itens%rowtype;
  v_novo       public.produtos%rowtype;
  v_ja_trocado int;
  v_troca_id   uuid;
  v_motivo     text;
begin
  if not private.eh_dono() then
    raise exception 'Apenas o dono pode registrar troca.' using errcode = '42501';
  end if;

  select id into v_perfil_id from public.perfis
   where id = (select auth.uid()) and ativo;

  v_motivo := nullif(btrim(coalesce(_motivo, '')), '');
  if v_motivo is null then
    raise exception 'Descreva o motivo da troca.';
  end if;

  if _quantidade is null or _quantidade <= 0 then
    raise exception 'Informe quantas peças estão sendo trocadas.';
  end if;

  -- Mesma trava da venda: o duplo envio não vira duas trocas.
  if _idempotency_key is not null then
    select id into v_troca_id from public.trocas where idempotency_key = _idempotency_key;
    if v_troca_id is not null then
      return v_troca_id;
    end if;
  end if;

  select * into v_item from public.venda_itens where id = _venda_item_id for update;
  if v_item.id is null then
    raise exception 'Item da venda não encontrado.';
  end if;

  -- Não dá para trocar mais peças do que saíram naquele item.
  select coalesce(sum(quantidade), 0) into v_ja_trocado
    from public.trocas where venda_item_id = _venda_item_id;

  if v_ja_trocado + _quantidade > v_item.quantidade then
    raise exception
      'A venda tem % peça(s) neste item e % já foram trocadas; sobra(m) %.',
      v_item.quantidade, v_ja_trocado, v_item.quantidade - v_ja_trocado;
  end if;

  if _produto_novo_id is not null then
    if _quantidade_nova is null or _quantidade_nova <= 0 then
      raise exception 'Informe a quantidade da peça nova.';
    end if;

    select * into v_novo from public.produtos where id = _produto_novo_id for update;
    if v_novo.id is null then
      raise exception 'Produto da troca não encontrado.';
    end if;
    if not v_novo.ativo then
      raise exception 'O produto % (%) está inativo.', v_novo.modelo, v_novo.cor;
    end if;
    if v_novo.estoque_atual < _quantidade_nova then
      raise exception 'Estoque insuficiente de % (%): resta(m) % peça(s).',
        v_novo.modelo, v_novo.cor, v_novo.estoque_atual;
    end if;
  end if;

  insert into public.trocas (
    venda_id, venda_item_id, quantidade, volta_ao_estoque, motivo,
    produto_novo_id, quantidade_nova, idempotency_key, criada_por
  ) values (
    v_item.venda_id, _venda_item_id, _quantidade,
    coalesce(_volta_ao_estoque, true), v_motivo,
    _produto_novo_id, _quantidade_nova, _idempotency_key, v_perfil_id
  )
  returning id into v_troca_id;

  -- Peça devolvida volta ao saldo. Item avulso não tem produto, então não há
  -- saldo para devolver — a troca fica registrada, sem movimento.
  if coalesce(_volta_ao_estoque, true) and v_item.produto_id is not null then
    insert into public.estoque_movimentos
      (produto_id, tipo, quantidade, motivo, venda_id, criado_por)
    values
      (v_item.produto_id, 'entrada', _quantidade,
       'Troca: ' || v_motivo, v_item.venda_id, v_perfil_id);
  end if;

  -- Peça nova sai do saldo.
  if _produto_novo_id is not null then
    insert into public.estoque_movimentos
      (produto_id, tipo, quantidade, motivo, venda_id, criado_por)
    values
      (_produto_novo_id, 'saida', -_quantidade_nova,
       'Troca: ' || v_motivo, v_item.venda_id, v_perfil_id);
  end if;

  return v_troca_id;
end; $function$;

grant execute on function public.registrar_troca(uuid, int, text, boolean, uuid, int, uuid)
  to authenticated;
