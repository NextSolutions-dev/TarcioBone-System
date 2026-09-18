-- 18 — Quem pode entrar no sistema: as regras dos acessos, no banco.
-- Migração ADITIVA: só acrescenta guardas. Nenhuma tela publicada mexe em
-- `perfis` hoje, então aplicar antes do deploy não quebra nada.
--
-- Pedido do cliente (2026-09-18): o dono cria os acessos da equipe, pode
-- promover outro dono e remover um. Duas regras nascem daí, e elas são de
-- banco — a tela pode ser burlada, o banco não:
--   1. no máximo 3 donos ativos;
--   2. a loja nunca fica sem nenhum dono ativo.

create or replace function private.fn_guarda_donos() returns trigger
language plpgsql security definer set search_path to ''
as $function$
declare
  v_donos integer;
begin
  -- Dois donos sendo criados ao mesmo tempo passariam os dois pela contagem.
  -- A trava serializa quem mexe na lista de acessos.
  perform pg_advisory_xact_lock(hashtextextended('perfis_donos_ativos', 0));

  select count(*) into v_donos
    from public.perfis
   where papel = 'dono' and ativo;

  if v_donos > 3 then
    raise exception 'A loja pode ter no máximo 3 donos ativos.'
      using errcode = '23514';
  end if;

  if v_donos = 0 then
    raise exception 'A loja precisa de pelo menos um dono ativo.'
      using errcode = '23514';
  end if;

  return null;
end;
$function$;

-- `constraint trigger` para poder ser adiada numa operação em lote
-- (`set constraints perfis_guarda_donos deferred`), quando um dia for preciso
-- trocar a lista inteira de acessos de uma vez.
drop trigger if exists perfis_guarda_donos on public.perfis;
create constraint trigger perfis_guarda_donos
  after insert or update or delete on public.perfis
  deferrable initially immediate
  for each row execute function private.fn_guarda_donos();

-- O sistema não apaga quem já tem movimento — o histórico de vendas perderia o
-- autor. Esta função diz à tela qual dos dois caminhos vale: remover de vez ou
-- apenas desativar.
create or replace function public.perfil_tem_movimento(_id uuid) returns boolean
language plpgsql security definer set search_path to '' stable
as $function$
begin
  -- `security definer` conta em tabelas que a RLS de cada uma esconderia, então
  -- o papel é conferido aqui dentro: quem não é dono não pergunta.
  if not private.eh_dono() then
    raise exception 'Apenas o dono pode consultar os acessos.' using errcode = '42501';
  end if;

  return exists (select 1 from public.vendas where vendedor_id = _id)
      or exists (select 1 from public.estoque_movimentos where criado_por = _id)
      or exists (select 1 from public.clientes where criado_por = _id)
      or exists (select 1 from public.atendimentos_pos_venda where criada_por = _id)
      or exists (select 1 from public.trocas where criada_por = _id)
      or exists (select 1 from public.loja_config where atualizado_por = _id);
end;
$function$;

revoke execute on function public.perfil_tem_movimento(uuid) from public, anon;
grant execute on function public.perfil_tem_movimento(uuid) to authenticated;
