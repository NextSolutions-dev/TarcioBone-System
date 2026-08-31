-- Fase 2 — o dinheiro do pedido.
-- Pedidos do Tarcio: "colocar avulsos", "desconto manual no final do pedido",
-- "frete, quanto foi o frete", "faturamento diário".
--
-- O total deixa de ser a soma dos itens:   total = subtotal − desconto + frete
--
-- Cada parcela em coluna própria porque o faturamento precisa separá-las: frete
-- é dinheiro que entra mas NÃO é receita de produto — somado junto, infla o
-- faturamento e distorce o ranking de mais vendidos.

-- Item avulso: linha sem produto cadastrado, digitada na hora.
alter table public.venda_itens alter column produto_id drop not null;
alter table public.venda_itens add column if not exists descricao text;

alter table public.venda_itens drop constraint if exists item_tem_identidade;
alter table public.venda_itens add constraint item_tem_identidade check (
  produto_id is not null
  or (descricao is not null and length(btrim(descricao)) > 0)
);

alter table public.vendas
  add column if not exists subtotal_centavos int not null default 0 check (subtotal_centavos >= 0),
  add column if not exists desconto_centavos int not null default 0 check (desconto_centavos >= 0),
  add column if not exists desconto_motivo text,
  add column if not exists frete_centavos int not null default 0 check (frete_centavos >= 0);

alter table public.vendas drop constraint if exists desconto_cabe_no_subtotal;
alter table public.vendas add constraint desconto_cabe_no_subtotal
  check (desconto_centavos <= subtotal_centavos);

update public.vendas set subtotal_centavos = total_centavos
 where subtotal_centavos = 0 and total_centavos > 0;

-- ⚠️ ORDEM IMPORTA na RPC: o cabeçalho da venda nasce com o dinheiro ZERADO e
-- só recebe subtotal/desconto/frete/total no fim, quando os itens já foram
-- percorridos. Gravar o desconto no insert quebra `desconto_cabe_no_subtotal`,
-- porque o subtotal ainda é zero — foi assim que o defeito apareceu.
--
-- Item avulso NÃO gera movimento de estoque: é coisa fora do cadastro, não há
-- saldo para baixar. Inventar produto fantasma sujaria catálogo e ranking.
--
-- Corpo completo aplicado via MCP (migrações avulsos_desconto_frete,
-- rpc_venda_com_avulsos_desconto_frete e corrige_ordem_desconto_na_venda).

-- Relatórios: a ponte inteira, em vez de um número só.
--   bruto − desconto = receita de produto ; + frete = o que entrou
-- Por produto o valor é BRUTO. Não rateio o desconto entre produtos: seria mais
-- "correto" na contabilidade e menos explicável para quem lê sozinho.
-- `faturamento_por_dia` atende ao pedido de faturamento diário.
