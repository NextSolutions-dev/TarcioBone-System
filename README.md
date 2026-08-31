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

Next.js 16 (App Router, TS, Tailwind v4) + Supabase (Postgres/Auth/RLS/Storage, região
São Paulo) + Vercel + PWA — tudo nas contas da empresa.
Supabase: projeto `varejoflow` (`mzsdvusygxhczamzsvso`).
Repo: `NextSolutions-dev/TacioBone-System`. Produção: https://varejoflow.vercel.app

## Como rodar

```bash
npm install
cp .env.example .env.local   # peça os dois valores ao Samuel
npm run dev                  # http://localhost:3000
```

Acessos para teste: `dono@abareta.com.br` (dono) e `camila@abareta.com.br` (vendedora).
**A senha não está no código nem na tela** — peça ao Samuel. Os nomes ainda são da marca
fictícia porque a identidade do cliente ainda não foi aplicada.

> [!WARNING]
> **O `.env.local` aponta para o banco REAL do cliente.** Não existe base de
> desenvolvimento separada: o que você cadastrar aqui vai para o Supabase de produção
> do Tarcio. Hoje isso é tolerável porque ele ainda não carregou dado nenhum — mas
> **apague o que criar** ao terminar, e pare de usar assim no dia em que houver dado
> real. `DELETE`/`UPDATE` em dado de cliente exigem autorização nominal do dono
> (regra do `CLAUDE.md`).

### O que dá para testar hoje

O banco está **vazio de propósito** (produtos, vendas e clientes zerados). Um roteiro
que exercita quase tudo:

1. **Ajustes** — dê um nome à loja e configure um WhatsApp. Repare que o número só
   aparece no catálogo **depois** de marcar que a mensagem de teste chegou.
2. **Produtos** — cadastre um item com preço de varejo **e** de atacado, e mande uma
   foto (qualquer PNG/JPG; ele converte e reduz sozinho). Sem preço de atacado o
   produto não entra no catálogo — é regra, não bug.
3. **Estoque** — dê entrada de algumas peças.
4. **Vender** — escolha o canal no topo (varejo/atacado) e repare que o preço da tela
   muda. Monte uma venda, some um **item avulso**, aplique **desconto** e **frete**, e
   confira a conta aberta antes de confirmar.
5. **Faturamento** — a ponte bruto → desconto → receita de produto → frete → recebido
   tem de fechar, e o dia a dia deve mostrar a venda.
6. **/catalogo** — o site público, sem login.

Vale testar também com a **vendedora**: ela não enxerga Produtos nem Ajustes, e o
faturamento dela mostra só o que ela mesma vendeu.

## Estado atual

Protótipo funcional e verificado de ponta a ponta: venda pelo celular baixando estoque,
faturamento por produto, catálogo público fechando no WhatsApp, RLS testada nos dois
papéis. Migrações em `supabase/migracoes/` (aplicadas via MCP).

**Falta:** fotos reais dos produtos (hoje há uma ilustração tingida pela cor), auditoria
por trigger, e deploy na Vercel com subdomínio. Nada aqui é dado de cliente — é tudo seed
fictício.
