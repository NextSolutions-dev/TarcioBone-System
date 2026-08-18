# VarejoFlow

Sistema de venda, estoque e faturamento para varejo com vários vendedores no celular,
somado a um site público de catálogo que fecha o pedido no WhatsApp.

## Para quem

**Protótipo/vitrine da Next Solutions.** Roda com a marca fictícia **Aba Reta**
(loja de bonés) e dados inventados, para demonstrar a dois públicos ao mesmo tempo:

1. Um **prospect real** do ramo de bonés, que pediu exatamente isto: registrar venda e
   estoque, faturamento detalhado por produto, 6 celulares + 1 notebook, online, mais um
   site de catálogo com fechamento no WhatsApp.
2. Qualquer lead de **varejo/estoque** — é o protótipo que faltava na vitrine da Next
   (ao lado de ShalomFlow para fábrica, JDFlow para loteamentos e D+Oficina para gestão).

Usuários: **1 dono** (retaguarda, notebook) e **vendedores** (celular, PWA instalável).

## A ideia (por que existe)

Nas palavras do prospect: *"Sistema com faturamento baseado nas vendas, registrar venda e
estoque… detalhamento do faturamento com os produtos detalhando os produtos que foram
vendidos."* Mais: *"Site com catálogo de produtos e finalizar venda no whatsapp."*

O ponto que o desenho resolve é o que planilha e caderno não resolvem: com seis pessoas
vendendo ao mesmo tempo, o estoque só é confiável se ele se mover sozinho a cada venda e
se o banco recusar a venda da peça que não existe. O faturamento, por sua vez, não é
digitado — ele **é** a soma do que saiu.

## O que o sistema faz

- **Painel** — faturamento do mês e do dia, ticket médio, mais vendidos, o que repor, últimas vendas.
- **Vender** (celular) — busca, carrinho com alvos de toque grandes, forma de pagamento, recibo.
- **Vendas** — histórico com os itens de cada venda e o preço praticado na hora.
- **Faturamento** — período livre + detalhamento por produto (quantidade, valor, participação).
- **Estoque** — saldo por produto, alerta de reposição, entrada de mercadoria, histórico de movimentos.
- **Produtos** (dono) — cadastro e liga/desliga da vitrine do site.
- **/catalogo** (público, sem login) — vitrine que lê o mesmo banco; sacola vira mensagem no WhatsApp.

## Regras que não podem regredir

- **Estoque nunca é digitado.** `produtos.estoque_atual` é espelho mantido por trigger a
  partir de `estoque_movimentos`. Escrever nele direto é bug.
- **`CHECK (estoque_atual >= 0)` + `FOR UPDATE`** são a trava real contra dois celulares
  vendendo a última peça. Disciplina de usuário não substitui isso.
- **Faturamento é derivado.** `vendas.total_centavos` sai da soma dos itens dentro da RPC.
- **Preço do item é snapshot.** Reajustar a tabela não reescreve venda antiga.
- **A venda nasce inteira ou não nasce** — `registrar_venda` é uma transação só.
- **Duplo envio não vira duas vendas** — `idempotency_key` (camada 1) + assinatura em
  janela de 2 min sob advisory lock (camada 2). O front tem `ref` de trava e "Salvando…".
- **Permissão é RLS.** Esconder menu é cortesia; dono e vendedor são separados no banco.
- **O visitante não fala com as tabelas.** O site lê `catalogo_publico`, com grant por
  coluna: ele vê `disponivel` (sim/não), nunca o saldo real.
- **Dinheiro em centavos (int)**, nunca float. Data de calendário ≠ momento.
- **A cascata de entrada usa `animation-fill-mode: backwards`, nunca `both`** — com
  `both` o transform fica retido, o elemento vira bloco de contenção e todo
  `position: fixed` dentro dele se ancora nele em vez da janela.

## Stack e ambiente

Next.js 16 (App Router, TS, Tailwind v4) + Supabase (Postgres/Auth/RLS, região São Paulo)
+ Vercel + PWA — tudo nas contas da empresa.
Supabase: projeto `varejoflow` (`mzsdvusygxhczamzsvso`). Repo: `NextSolutions-dev/varejoflow`.

```bash
npm install
cp .env.example .env.local   # URL + publishable key do Supabase + WhatsApp da loja
npm run dev
```

Acessos do demo: `dono@abareta.com.br` e `camila@abareta.com.br` — a senha aparece na
própria tela de login (é ambiente de demonstração com dados fictícios).

## Estado atual

Protótipo funcional e verificado de ponta a ponta: venda pelo celular baixando estoque,
faturamento por produto, catálogo público fechando no WhatsApp, RLS testada nos dois
papéis. Migrações em `supabase/migracoes/` (aplicadas via MCP).

**Falta:** fotos reais dos produtos (hoje há uma ilustração tingida pela cor), auditoria
por trigger, e deploy na Vercel com subdomínio. Nada aqui é dado de cliente — é tudo seed
fictício.
