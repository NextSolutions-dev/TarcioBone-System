-- 17 — Limpeza da troca manual no estoque.
-- Decisão do cliente (2026-09-18): a devolução do sistema é a ligada ao número
-- da venda (`registrar_atendimento_pos_venda`, migração 16). A troca manual peça
-- por peça, feita para o pedido de 13/09, perdeu a tela e sai do banco.
--
-- ATENÇÃO — esta migração é DESTRUTIVA, o inverso da regra 13.
-- Aplicar SOMENTE DEPOIS do deploy que remove `registrarTrocaEstoque` de
-- `estoque/acoes.ts`. Antes disso o código publicado ainda declara a ação.
--
-- `public.trocas` NÃO cai aqui: `registrar_atendimento_pos_venda` soma
-- `trocas` + `atendimentos_pos_venda` antes de liberar quantidade. Dropar a
-- tabela quebraria a devolução em produção. Ela fica como legado vazio e
-- só-leitura, e a RPC que escrevia nela é que sai.

-- 1. A RPC da troca manual, sem chamador desde o deploy acima.
drop function if exists public.registrar_troca_estoque(uuid, integer, uuid, integer, text, uuid);

-- 2. O vínculo do movimento com a troca manual. Coluna sempre nula daqui em
--    diante; o vínculo vivo é `atendimento_id`, da migração 16.
alter table public.estoque_movimentos drop column if exists troca_estoque_id;

-- 3. O registro da troca manual em si.
drop table if exists public.trocas_estoque;

-- 4. A RPC que escrevia em `trocas` — a tela que a chamava foi removida em
--    13/09. A tabela permanece pelo motivo do cabeçalho.
drop function if exists public.registrar_troca(uuid, integer, text, uuid);

comment on table public.trocas is
  'Legado (13/09/2026). Sem escritor: a devolução passou para atendimentos_pos_venda. '
  'Lida por registrar_atendimento_pos_venda para contar o que já foi devolvido de cada item. '
  'Não dropar sem antes reescrever aquela RPC.';
