# TarcioBone — sistema da loja

Sistema de venda, estoque e faturamento para uma loja que vende no **atacado e no
varejo**, com vendedores operando pelo celular, mais um **site público de catálogo de
atacado** que fecha o pedido no WhatsApp.

## Para quem

Cliente: **Tarcio Boné** — distribuidor de boné e moda masculina em Caruaru/PE
(Feira de Caruaru), atacado e varejo, com envio para todo o Brasil.
É o **primeiro cliente comercial da Next Solutions**.

Usuários: **1 dono** (retaguarda, notebook) e **vendedores** (celular, PWA instalável).

> Nasceu como protótipo de vitrine e virou entrega quando o cliente fechou. A identidade
> do Tarcio (logo, preto e dourado, serifada) foi aplicada em 2026-09-06; a marca fictícia
> **Aba Reta** só sobrevive nos **e-mails de acesso**, que ainda não foram trocados. A
> vitrine neutra vive numa cópia separada (`varejoflow-vitrine`).

## A ideia (por que existe)

Nas palavras do cliente: *"Sistema com faturamento baseado nas vendas, registrar venda e
estoque… detalhamento do faturamento com os produtos detalhando os produtos que foram
vendidos."* E: *"Catálogo só atacado, sistema fica responsável pela venda varejo."*

O que planilha e caderno não resolvem: com várias pessoas vendendo ao mesmo tempo, o
estoque só é confiável se ele se mover sozinho a cada venda e se o banco recusar a venda
da peça que não existe. O faturamento não é digitado — ele **é** a soma do que saiu.

## O que o sistema faz

- **Painel** — faturamento do mês e do dia, ticket médio, mais vendidos, o que repor.
- **Vender** (celular) — um card por produto com as cores; tocar abre a escolha de **cor
  e tamanho, com a quantidade de cada tamanho**. Canal varejo/atacado, itens avulsos,
  desconto, frete, forma de pagamento, cliente vinculado e recibo.
- **Vendas** — histórico com itens, preço praticado, desconto, frete e canal.
- **Clientes** — cadastro com telefone (é o que permite mandar mensagem depois), busca e
  aviso de telefone repetido.
- **Faturamento** — período livre, **dia a dia**, detalhamento por produto e a ponte
  bruto → desconto → receita de produto → frete → recebido.
- **Estoque** — saldo, alerta de reposição, entrada de mercadoria, histórico.
- **Produtos** (dono) — produto com várias **cores**, cada cor com seus **tamanhos** e
  suas **fotos**. Preço de varejo e de atacado, vitrine liga/desliga.
- **Ajustes** (dono) — nome da loja e WhatsApp do catálogo, com teste antes de valer.
- **/catalogo** (aberto por link, sem login) — vitrine de **atacado** com página de produto no
  desenho de loja grande: foto que troca com a cor, cores pelas fotos, tamanhos com o
  esgotado riscado. Sacola vira mensagem no WhatsApp.

## Regras que não podem regredir

- **Estoque nunca é digitado.** `produtos.estoque_atual` é espelho mantido por trigger a
  partir de `estoque_movimentos`. Escrever nele direto é bug.
- **`CHECK (estoque_atual >= 0)` + `FOR UPDATE`** são a trava real contra dois celulares
  vendendo a última peça. Disciplina de usuário não substitui isso.
- **O total é `subtotal − desconto + frete`**, cada parcela em coluna própria. **Frete
  não é receita de produto** — somado junto, infla o faturamento.
- **Troca não altera o dinheiro da venda.** O valor daquele dia entrou de verdade;
  reescrever faturamento passado faz o relatório mentir sobre o caixa do dia. Diferença
  de preço vira venda nova com item avulso.
- **Prazo de troca é referência, não trava.** O sistema mostra os dias decorridos e
  avisa quando passou; quem aceita ou recusa é o dono.
- **Troca só move estoque por ação manual.** O registro na venda não toca no saldo; quem
  move é o dono, na tela Estoque (troca de peça por peça, ou entrada à mão no caso de
  defeito com reembolso). O padrão automático já devolveu boné com defeito ao estoque
  vendável — não volte a automatizar sem decisão do cliente.
- **Quem escolhe o preço por canal é a RPC**, não a tela. Produto sem preço de atacado
  não entra no catálogo e não pode ser vendido no atacado.
- **Item avulso não move estoque** — é coisa fora do cadastro, não há saldo para baixar.
- **A venda nasce inteira ou não nasce** — `registrar_venda` é uma transação só, e o
  dinheiro só é gravado no fim, quando o subtotal já existe.
- **Duplo envio não vira duas vendas** — `idempotency_key` (camada 1) + assinatura em
  janela de 2 min sob advisory lock (camada 2). O front tem `ref` de trava e "Salvando…".
- **Preço do item é snapshot.** Reajustar a tabela não reescreve venda antiga.
- **Permissão é RLS.** Esconder menu é cortesia; dono e vendedor são separados no banco.
- **O visitante não fala com as tabelas.** O site lê `catalogo_variacoes` e
  `modelo_fotos`, com grant por coluna: ele vê `disponivel` (sim/não), nunca o saldo real.
  Por isso **quantidade por tamanho só aparece no sistema**, nunca no catálogo. O WhatsApp só aparece
  depois de testado (`whatsapp_publico` é nulo até lá).
- **Foto de produto** vai para bucket público (leitura) com escrita só do dono; o upload
  converte para JPEG e reduz — resolve HEIC de iPhone e corta egress.
- **Dinheiro em centavos (int)**, nunca float. Data de calendário ≠ momento.
- **Conteúdo nunca nasce invisível esperando JS** — efeito de revelação é camada extra.
- **A cascata de entrada usa `animation-fill-mode: backwards`, nunca `both`** — com
  `both` o transform fica retido, o elemento vira bloco de contenção e todo
  `position: fixed` dentro dele se ancora nele em vez da janela.
- **O `<body>` é do sistema (claro); as rotas públicas são pretas.** Quem pinta o preto no
  body é `body:has(.registro-loja)`. Sem isso o fundo claro aparece no overscroll do
  celular. Tirou a classe `registro-loja` do layout da loja, quebrou.

## Stack e ambiente

Next.js 16 (App Router, TS, Tailwind v4) + Supabase (Postgres/Auth/RLS/Storage, região
São Paulo) + Vercel + PWA — tudo nas contas da empresa.
Supabase: projeto `varejoflow` (`mzsdvusygxhczamzsvso`).
Repo: `NextSolutions-dev/TarcioBone-System`. Produção: **https://tarciobone.nextsolutionstech.com.br**
(o antigo `varejoflow.vercel.app` saiu do ar quando o projeto foi renomeado, em 13/09).

## Como rodar

```bash
npm install
cp .env.example .env.local   # peça os dois valores ao Samuel
npm run dev                  # http://localhost:3000
```

Acessos para teste: `dono@abareta.com.br` (dono) e `camila@abareta.com.br` (vendedora).
**A senha não está mais no código nem na tela** — peça ao Samuel.

> [!CAUTION]
> **A senha antiga deve ser considerada comprometida.** Até 2026-09-06 ela vinha
> pré-preenchida no formulário de login em produção e este repositório era público, então
> ela continua no histórico do git. O preenchimento foi removido, mas **a troca da senha
> em si ainda não foi feita** — depende do console do Supabase. Enquanto não for trocada,
> qualquer pessoa que tenha visto o histórico ou a página consegue entrar.

> [!WARNING]
> **O `.env.local` aponta para o banco REAL do cliente.** Não existe base de
> desenvolvimento separada: o que você cadastrar aqui vai para o Supabase de produção
> do Tarcio. Hoje isso é tolerável porque ele ainda não carregou dado nenhum — mas
> **apague o que criar** ao terminar, e pare de usar assim no dia em que houver dado
> real. `DELETE`/`UPDATE` em dado de cliente exigem autorização nominal do dono
> (regra do `CLAUDE.md`).

> Para o roteiro completo de testes e a lista do que já foi construído em cada fase,
> veja **[`fase_atual.md`](fase_atual.md)**.

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

**Fases 1 a 4 construídas; 6 e 7 concluídas em 2026-09-06.**

- Fase 1 — clientes com telefone, fotos de produto, atacado × varejo com canal na venda.
- Fase 2 — itens avulsos, desconto manual, frete e o faturamento refeito sobre o novo
  modelo de total, com quebra diária.
- Fase 3 — editor de catálogo, pedido mínimo e página pública `/pedido`.
- Fase 4 — faturamento por canal e mensagem ao cliente pelo sistema.
- Fase 6 — **as migrações voltaram a reconstruir o banco.** O corpo das funções estava só
  no servidor; agora vive em `12_funcoes_canonicas.sql`. Rodar `01 → 12` reproduz a
  produção. Também: lint zerado e `revoke` dos relatórios para `anon`.
- Fase 7 — identidade do cliente: logo, preto e dourado (`#d0b088`, tirado da própria
  arte), Playfair Display + Jost no lugar de Anton + Space Mono, ícones do PWA e copy do
  catálogo reescrita para o posicionamento premium dele.
- Fase 8 — **trocas**. A tela de Vendas mostra há quantos dias a venda foi feita e
  registra a troca (peça e motivo). Desde 13/09 o estoque da troca é manual: a tela
  Estoque tem **Registrar troca**, que diz a peça que volta e a que sai.
- **Cores e tamanhos** (13/09) — cada produto tem cores, cada cor tem fotos e tamanhos, e
  o estoque é por tamanho. Catálogo e tela de venda no desenho de página de produto de
  loja grande. Logo da tela de login sem fundo.
- **Usuários, capa e login** (18/09) — o dono cria os acessos da equipe pela tela
  **Usuários** (nome, e-mail, senha e cargo), com teto de 3 donos; a abertura do
  catálogo passou a entrar em ordem, com a marca assentando e o brilho atravessando
  o dourado; a tela de login ficou só com a marca.
- **Capa e acesso por link** (17/09) — a abertura do catálogo virou uma capa com a marca,
  o slogan e os textos principais (produtos e preços seguem como estavam). O catálogo
  deixou de anunciar o login e saiu dos buscadores. **Banco zerado** nesta data: só os
  acessos, a configuração e os textos do catálogo ficaram.

Migrações em `supabase/migracoes/`, rodadas em ordem de `01` a `15`. **A 12 guarda a
versão final das funções até a Fase 7**; da 13 em diante, cada migração guarda a versão
final das funções que ela cria ou redefine — a troca vigente está na **14**, e cadastro
de produto e faturamento por produto na **15**.

**Falta (Fase 9):** apontar o domínio próprio para o que já está no ar; **carregar os
produtos reais**, que aguardam a planilha da cliente (CSV ou Excel); trocar os e-mails
`@abareta`; e, na entrega, **apagar os dados e os acessos de teste do time**. O plano do
Supabase segue o **gratuito** por decisão — ele pausa após ~7 dias sem uso.

**Pendência técnica:** excluir produto não apaga a foto no Storage — arquivo órfão
acumula. O Storage não aceita delete por SQL; a limpeza tem de sair pela API.
