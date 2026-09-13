-- =============================================================================
-- Troca manual no estoque — decisão do time em 2026-09-13
--
-- O que mudou e por quê:
-- a Fase 8 fazia a troca registrada na venda mexer no estoque sozinha, com a
-- peça devolvida voltando ao saldo por padrão. No primeiro uso real a troca teve
-- motivo "Aba torta" e a opção ficou marcada: 4 bonés com defeito voltaram ao
-- estoque vendável. O padrão automático decidiu por quem não estava olhando.
--
-- A regra agora é que **estoque só se move por ação manual do dono**:
--   - devolução com defeito e reembolso -> "Lançar entrada" na tela Estoque
--     (já existia; o dono decide se a peça volta ou não)
--   - troca de uma peça por outra        -> "Registrar troca" na tela Estoque,
--     que diz qual peça entra e qual sai
--
-- A troca na tela de Vendas continua existindo como REGISTRO — foi o que o
-- cliente pediu em 06/09 (a venda no histórico, os dias decorridos, a peça e o
-- motivo) —, mas deixa de mover estoque. Se as duas movessem, a mesma troca
-- baixaria o saldo duas vezes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Troca da venda: só registro
--
-- `volta_ao_estoque` vira anulável. NULL = regime novo, o estoque foi tratado à
-- mão na tela Estoque. true/false = registros anteriores a esta migração, que
-- ficam como estavam — reescrever histórico faria o registro mentir sobre o que
-- de fato aconteceu com o saldo naquele dia.
-- -----------------------------------------------------------------------------
alter table public.trocas alter column volta_ao_estoque drop not null;
alter table public.trocas alter column volta_ao_estoque drop default;

comment on column public.trocas.volta_ao_estoque is
  'NULL = estoque tratado à mão na tela Estoque (desde 2026-09-13). true/false = registros antigos.';

drop function if exists public.registrar_troca(uuid, int, text, boolean, uuid, int, uuid);

create or replace function public.registrar_troca(
  _venda_item_id uuid,
  _quantidade int,
  _motivo text,
  _idempotency_key uuid default null
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_perfil_id  uuid;
  v_item       public.venda_itens%rowtype;
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

  select coalesce(sum(quantidade), 0) into v_ja_trocado
    from public.trocas where venda_item_id = _venda_item_id;

  if v_ja_trocado + _quantidade > v_item.quantidade then
    raise exception
      'A venda tem % peça(s) neste item e % já foram trocadas; sobra(m) %.',
      v_item.quantidade, v_ja_trocado, v_item.quantidade - v_ja_trocado;
  end if;

  -- Sem movimento de estoque: quem move o saldo é o dono, na tela Estoque.
  insert into public.trocas (
    venda_id, venda_item_id, quantidade, volta_ao_estoque, motivo,
    idempotency_key, criada_por
  ) values (
    v_item.venda_id, _venda_item_id, _quantidade, null, v_motivo,
    _idempotency_key, v_perfil_id
  )
  returning id into v_troca_id;

  return v_troca_id;
end; $function$;

-- O Postgres concede EXECUTE a PUBLIC em toda função nova: revogar ANTES do grant.
revoke execute on function public.registrar_troca(uuid, int, text, uuid) from public, anon;
grant  execute on function public.registrar_troca(uuid, int, text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Troca no estoque: a peça que entra pela peça que sai
-- -----------------------------------------------------------------------------
create table if not exists public.trocas_estoque (
  id               uuid primary key default gen_random_uuid(),
  produto_entra_id uuid not null references public.produtos(id),
  quantidade_entra int  not null check (quantidade_entra > 0),
  produto_sai_id   uuid not null references public.produtos(id),
  quantidade_sai   int  not null check (quantidade_sai > 0),
  motivo           text,
  idempotency_key  uuid,
  criada_em        timestamptz not null default now(),
  criada_por       uuid references public.perfis(id)
);

comment on table public.trocas_estoque is
  'Troca manual feita pelo dono: uma peça volta ao estoque e outra sai no lugar.';

create unique index if not exists trocas_estoque_idempotency
  on public.trocas_estoque (idempotency_key) where idempotency_key is not null;

-- Os dois movimentos apontam para a troca que os gerou. Mesmo desenho de
-- `venda_id`: excluir a troca apaga os movimentos, e o trigger do espelho
-- devolve o saldo — a entrada sai (−) e a saída volta (+).
alter table public.estoque_movimentos
  add column if not exists troca_estoque_id uuid
    references public.trocas_estoque(id) on delete cascade;

create index if not exists movimentos_por_troca_estoque
  on public.estoque_movimentos (troca_estoque_id) where troca_estoque_id is not null;

alter table public.trocas_estoque enable row level security;

drop policy if exists trocas_estoque_leitura on public.trocas_estoque;
create policy trocas_estoque_leitura on public.trocas_estoque
  for select to authenticated
  using ((select private.perfil_ativo()));

drop policy if exists trocas_estoque_exclusao_dono on public.trocas_estoque;
create policy trocas_estoque_exclusao_dono on public.trocas_estoque
  for delete to authenticated
  using ((select private.eh_dono()));

revoke all on public.trocas_estoque from anon;

create or replace function public.registrar_troca_estoque(
  _produto_entra_id uuid,
  _quantidade_entra int,
  _produto_sai_id uuid,
  _quantidade_sai int,
  _motivo text default null,
  _idempotency_key uuid default null
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_perfil_id uuid;
  v_entra     public.produtos%rowtype;
  v_sai       public.produtos%rowtype;
  v_troca_id  uuid;
  v_motivo    text;
  v_texto     text;
begin
  if not private.eh_dono() then
    raise exception 'Apenas o dono pode registrar troca no estoque.' using errcode = '42501';
  end if;

  if coalesce(_quantidade_entra, 0) <= 0 or coalesce(_quantidade_sai, 0) <= 0 then
    raise exception 'Informe as quantidades da peça que volta e da que sai.';
  end if;

  if _idempotency_key is not null then
    select id into v_troca_id from public.trocas_estoque where idempotency_key = _idempotency_key;
    if v_troca_id is not null then
      return v_troca_id;
    end if;
  end if;

  select id into v_perfil_id from public.perfis
   where id = (select auth.uid()) and ativo;

  -- Travar as duas linhas sempre na mesma ordem (por id) evita deadlock quando
  -- duas trocas cruzadas envolvem os mesmos produtos ao mesmo tempo.
  perform 1 from public.produtos
   where id in (_produto_entra_id, _produto_sai_id)
   order by id
   for update;

  select * into v_entra from public.produtos where id = _produto_entra_id;
  select * into v_sai   from public.produtos where id = _produto_sai_id;

  if v_entra.id is null then
    raise exception 'A peça que volta não foi encontrada.';
  end if;
  if v_sai.id is null then
    raise exception 'A peça que sai não foi encontrada.';
  end if;
  if not v_sai.ativo then
    raise exception 'O produto % (%) está inativo e não pode sair.', v_sai.modelo, v_sai.cor;
  end if;

  -- Mesma peça dos dois lados é aceita de propósito: é o caso de trocar um boné
  -- com defeito por outro igual. O saldo líquido fica igual e o fato fica registrado.
  if _produto_entra_id = _produto_sai_id then
    if v_sai.estoque_atual + _quantidade_entra < _quantidade_sai then
      raise exception 'Estoque insuficiente de % (%): resta(m) % peça(s).',
        v_sai.modelo, v_sai.cor, v_sai.estoque_atual;
    end if;
  elsif v_sai.estoque_atual < _quantidade_sai then
    raise exception 'Estoque insuficiente de % (%): resta(m) % peça(s).',
      v_sai.modelo, v_sai.cor, v_sai.estoque_atual;
  end if;

  v_motivo := nullif(btrim(coalesce(_motivo, '')), '');

  insert into public.trocas_estoque (
    produto_entra_id, quantidade_entra, produto_sai_id, quantidade_sai,
    motivo, idempotency_key, criada_por
  ) values (
    _produto_entra_id, _quantidade_entra, _produto_sai_id, _quantidade_sai,
    v_motivo, _idempotency_key, v_perfil_id
  )
  returning id into v_troca_id;

  -- O texto do movimento diz as duas pontas: quem lê o histórico do estoque
  -- entende a troca sem abrir outra tela.
  v_texto := format('Troca: volta %s (%s) ×%s, sai %s (%s) ×%s',
                    v_entra.modelo, v_entra.cor, _quantidade_entra,
                    v_sai.modelo, v_sai.cor, _quantidade_sai)
             || coalesce(' — ' || v_motivo, '');

  -- Entrada antes da saída: com a mesma peça dos dois lados, é o que impede o
  -- CHECK (estoque_atual >= 0) de recusar uma troca que fecha no zero.
  insert into public.estoque_movimentos
    (produto_id, tipo, quantidade, motivo, criado_por, troca_estoque_id)
  values
    (_produto_entra_id, 'entrada', _quantidade_entra, v_texto, v_perfil_id, v_troca_id);

  insert into public.estoque_movimentos
    (produto_id, tipo, quantidade, motivo, criado_por, troca_estoque_id)
  values
    (_produto_sai_id, 'saida', -_quantidade_sai, v_texto, v_perfil_id, v_troca_id);

  return v_troca_id;
end; $function$;

revoke execute on function public.registrar_troca_estoque(uuid, int, uuid, int, text, uuid)
  from public, anon;
grant  execute on function public.registrar_troca_estoque(uuid, int, uuid, int, text, uuid)
  to authenticated;
