# TarcioBone — sistema da loja

Sistema de venda, estoque e faturamento para uma loja que vende no **atacado e no
varejo**, com vendedores operando pelo celular, mais um **site público de catálogo de
atacado** que fecha o pedido no WhatsApp.

## Para quem

Cliente: **Tarcio Bone** — distribuidor de boné e moda masculina em Caruaru/PE
(Feira de Caruaru), atacado e varejo, com envio para todo o Brasil.
É o **primeiro cliente comercial da Next Solutions**.

Usuários: **1 dono** (retaguarda, notebook) e **vendedores** (celular, PWA instalável).

> Nasceu como protótipo de vitrine e virou entrega quando o cliente fechou. Por isso o
> código ainda carrega a marca fictícia **Aba Reta** na identidade visual — trocar pela
> marca do Tarcio é tarefa pendente, não descuido. A vitrine neutra vive numa cópia
> separada (`varejoflow-vitrine`).

## A ideia (por que existe)

Nas palavras do cliente: *"Sistema com faturamento baseado nas vendas, registrar venda e
estoque… detalhamento do faturamento com os produtos detalhando os produtos que foram
vendidos."* E: *"Catálogo só atacado, sistema fica responsável pela venda varejo."*

O que planilha e caderno não resolvem: com várias pessoas vendendo ao mesmo tempo, o
estoque só é confiável se ele se mover sozinho a cada venda e se o banco recusar a venda
da peça que não existe. O faturamento não é digitado — ele **é** a soma do que saiu.

## O que o sistema faz

- **Painel** — faturamento do mês e do dia, ticket médio, mais vendidos, o que repor.
- **Vender** (celular) — canal varejo/atacado, busca, carrinho, itens avulsos, desconto,
  frete, forma de pagamento, cliente vinculado e recibo.
- **Vendas** — histórico com itens, preço praticado, desconto, frete e canal.
- **Clientes** — cadastro com telefone (é o que permite mandar mensagem depois), busca e
  aviso de telefone repetido.
- **Faturamento** — período livre, **dia a dia**, detalhamento por produto e a ponte
  bruto → desconto → receita de produto → frete → recebido.
- **Estoque** — saldo, alerta de reposição, entrada de mercadoria, histórico.
- **Produtos** (dono) — cadastro com preço de varejo e de atacado, foto e vitrine.
- **Ajustes** (dono) — nome da loja e WhatsApp do catálogo, com teste antes de valer.
- **/catalogo** (público, sem login) — vitrine de **atacado**; sacola vira mensagem no
  WhatsApp.

## Regras que não podem regredir

- **Estoque nunca é digitado.** `produtos.estoque_atual` é espelho mantido por trigger a
  partir de `estoque_movimentos`. Escrever nele direto é bug.
- **`CHECK (estoque_atual >= 0)` + `FOR UPDATE`** são a trava real contra dois celulares
  vendendo a última peça. Disciplina de usuário não substitui isso.
- **O total é `subtotal − desconto + frete`**, cada parcela em coluna própria. **Frete
  não é receita de produto** — somado junto, infla o faturamento.
- **Quem escolhe o preço por canal é a RPC**, não a tela. Produto sem preço de atacado
  não entra no catálogo e não pode ser vendido no atacado.
- **Item avulso não move estoque** — é coisa fora do cadastro, não há saldo para baixar.
- **A venda nasce inteira ou não nasce** — `registrar_venda` é uma transação só, e o
  dinheiro só é gravado no fim, quando o subtotal já existe.
- **Duplo envio não vira duas vendas** — `idempotency_key` (camada 1) + assinatura em
  janela de 2 min sob advisory lock (camada 2). O front tem `ref` de trava e "Salvando…".
- **Preço do item é snapshot.** Reajustar a tabela não reescreve venda antiga.
- **Permissão é RLS.** Esconder menu é cortesia; dono e vendedor são separados no banco.
- **O visitante não fala com as tabelas.** O site lê `catalogo_publico`, com grant por
  coluna: ele vê `disponivel` (sim/não), nunca o saldo real. O WhatsApp só aparece
  depois de testado (`whatsapp_publico` é nulo até lá).
- **Foto de produto** vai para bucket público (leitura) com escrita só do dono; o upload
  converte para JPEG e reduz — resolve HEIC de iPhone e corta egress.
- **Dinheiro em centavos (int)**, nunca float. Data de calendário ≠ momento.
- **Conteúdo nunca nasce invisível esperando JS** — efeito de revelação é camada extra.
- **A cascata de entrada usa `animation-fill-mode: backwards`, nunca `both`** — com
  `both` o transform fica retido, o elemento vira bloco de contenção e todo
  `position: fixed` dentro dele se ancora nele em vez da janela.

## Stack e ambiente

Next.js 16 (App Router, TS, Tailwind v4) + Supabase (Postgres/Auth/RLS/Storage, região
São Paulo) + Vercel + PWA — tudo nas contas da empresa.
Supabase: projeto `varejoflow` (`mzsdvusygxhczamzsvso`).
Repo: `NextSolutions-dev/TarcioBone-System`. Produção: https://varejoflow.vercel.app

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

**Fases 1 e 2 concluídas** e verificadas de ponta a ponta:

- Fase 1 — clientes com telefone, fotos de produto, atacado × varejo com canal na venda.
- Fase 2 — itens avulsos, desconto manual, frete e o faturamento refeito sobre o novo
  modelo de total, com quebra diária.

Migrações em `supabase/migracoes/` (aplicadas via MCP).

**Falta:** identidade do cliente (logo e cores — a marca dele é preto e dourado, e a copy
atual do catálogo ainda fala só de boné); troca/devolução (aguardando ele definir se é
nota ou fluxo com estoque); página pública do pedido com fotos; envio de mensagem pelo
sistema; e o restante do editor de catálogo.

**Pendência técnica:** excluir produto não apaga a foto no Storage — arquivo órfão
acumula. O Storage não aceita delete por SQL; a limpeza tem de sair pela API.
