-- 19 — O vendedor enxerga só o que é dele.
-- Pedido do cliente (2026-09-18): no painel, nas vendas e nos clientes, o
-- vendedor vê apenas o próprio trabalho; faturamento é tela de dono.
--
-- Migração ADITIVA no sentido que importa: nenhuma tela quebra, elas passam a
-- receber menos linha. Vendas e itens de venda JÁ eram assim desde a fundação
-- (`vendas_leitura`, `venda_itens_leitura`), e os relatórios de faturamento são
-- `security invoker` — somam só o que a RLS deixa o chamador ver, então o
-- painel do vendedor já mostrava os números dele. O que faltava eram os
-- clientes, abertos para toda a equipe até aqui.
--
-- Estoque fica como está, de propósito: a loja é uma só, e vendedor precisa
-- saber o que tem para vender.

drop policy if exists clientes_leitura on public.clientes;
create policy clientes_leitura on public.clientes
  for select to authenticated
  using ((select private.eh_dono()) or criado_por = (select auth.uid()));

drop policy if exists clientes_edicao on public.clientes;
create policy clientes_edicao on public.clientes
  for update to authenticated
  using ((select private.eh_dono()) or criado_por = (select auth.uid()))
  with check ((select private.eh_dono()) or criado_por = (select auth.uid()));

-- Cadastrar continua livre para a equipe, mas em nome próprio: ninguém cria
-- cliente na carteira de outro vendedor.
drop policy if exists clientes_cadastro on public.clientes;
create policy clientes_cadastro on public.clientes
  for insert to authenticated
  with check (
    (select private.perfil_ativo())
    and ((select private.eh_dono()) or criado_por = (select auth.uid()))
  );

-- Cliente antigo sem autor ficaria invisível para o vendedor. Hoje não existe
-- nenhum (o banco foi zerado em 17/09); se a carga da planilha criar clientes
-- pelo dono, eles nascem na carteira dele — que é o esperado.
