# Tarcio Boné — regras do projeto

Sistema de venda + estoque + faturamento para atacado e varejo com vendedores no celular,
mais um site público de catálogo que fecha o pedido no WhatsApp. É o **sistema de um
cliente real — Tarcio Boné**, 1º cliente comercial da Next Solutions. Nasceu como o
protótipo VarejoFlow; a vitrine de demonstração vive em outra pasta
(`Work/prototiposNext/varejoflow-vitrine`).

> Antes de qualquer tarefa, leia o `README.md` para o contexto completo do sistema.

## Invariantes — não regridem

0. **Produto é modelo → cor → tamanho.** Cada linha de `produtos` é uma **variação**
   (modelo + cor + tamanho): é ela que tem saldo, preço e código, e é ela que é vendida.
   `modelos` guarda o que é do produto inteiro (nome, descrição, categoria, vitrine);
   `modelo_fotos` guarda as fotos **por cor**. `produtos.modelo` (o nome) é espelho de
   `modelos.nome` mantido por trigger — renomeie o modelo, nunca a variação. A mesma cor
   no mesmo tamanho não se repete num modelo (índice único sem caixa e sem espaço).
   Cadastro nasce inteiro pela RPC `criar_modelo` (modelo + variações na mesma
   transação); cor ou tamanho novo entra por `adicionar_variacoes`, que ignora repetição.
1. **Estoque é derivado.** `produtos.estoque_atual` é espelho mantido pelo trigger
   `trg_aplicar_movimento` sobre `estoque_movimentos`. Nunca faça `update` nele direto;
   crie um movimento. `estoque_movimentos` é imutável (trigger barra `UPDATE`).
2. **A trava de venda concorrente é do banco:** `CHECK (estoque_atual >= 0)` mais
   `SELECT … FOR UPDATE` dentro de `registrar_venda`. Não mova essa garantia para o front.
3. **Venda só nasce pela RPC `registrar_venda`** — não existe policy de INSERT em
   `vendas`. Ela é atômica: cabeçalho, itens e movimentos na mesma transação.
4. **Idempotência em duas camadas:** `idempotency_key` (índice único parcial) e
   assinatura do conteúdo em janela de 2 minutos sob `pg_advisory_xact_lock`. Todo
   handler que grava no front precisa de `ref` de trava + rótulo "Salvando…".
5. **Faturamento e totais são calculados**, nunca digitados. `faturamento_por_produto` e
   `resumo_faturamento` são `security invoker` de propósito: a RLS decide o alcance
   (dono vê a loja, vendedor vê o que ele vendeu).
6. **Preço do item é snapshot** em `venda_itens.preco_unitario_centavos`.
7. **Permissão é RLS.** `private.eh_dono()` / `private.perfil_ativo()` — e os `grant
   execute … to authenticated` são obrigatórios, senão toda policy falha em silêncio.
8. **O papel `anon` não toca as tabelas de negócio.** O site lê a view
   `catalogo_variacoes` e a tabela `modelo_fotos` (`security_invoker = on`, grant **por
   coluna**): o visitante enxerga `disponivel` (booleano gerado), **nunca `estoque_atual`**.
   Por isso o catálogo mostra se o tamanho tem ou não tem, e **quantidade só aparece na
   tela de venda do sistema**. `catalogo_publico` é a view antiga, mantida só por
   compatibilidade durante deploy.
9. **Dinheiro em centavos (`int`)**, exibido por `dinheiro()` de `lib/utils`. Nunca float.
10. **Data de calendário ≠ momento.** `parseDataCalendario` para o dia escrito;
    `new Date(iso)` só para carimbo de sistema. Carimbo vem do servidor.
11. **Conteúdo nunca nasce invisível esperando JS.** Efeito de revelação vive sob
    uma classe que o próprio script adiciona (`.anima-scroll`) depois de
    confirmar que consegue animar. Sem JS, JS lento ou observer indisponível, a
    página tem de mostrar o produto igual. Regra vinda do tombo da landing page
    (Decisões 2026-07-02) e repetida aqui na 1ª versão do catálogo.
12. **`.cascata` usa `animation-fill-mode: backwards`, nunca `both`.** Com `both` o
    transform final fica retido, o elemento vira bloco de contenção e qualquer
    `position: fixed` dentro dele se ancora nele em vez da janela — foi o que quebrou a
    barra do carrinho em `/vender`.
13. **Migração nunca quebra o código publicado.** Aplicar no banco antes do deploy é o
    normal aqui, então toda migração é **aditiva**: coluna nova com default, função com
    parâmetro novo opcional, view antiga mantida. Em 2026-09-13 trocar a assinatura de
    `registrar_troca` deixou a troca quebrada em produção até o deploy.
14. **O catálogo não anuncia o login, e nada aqui é indexado.** Decisão do cliente
    (2026-09-17): o catálogo só deve ser aberto por quem recebeu o link. Não recolocar
    link para `/login` nas rotas públicas — o dono entra pelo endereço direto e o app
    instalado abre em `/vender`. `robots.ts` e o `robots` do metadata mantêm tudo fora
    de busca. Isso **não é proteção**, é parar de ser descoberto; o que protege é a RLS
    e a senha.
15. **Estoque só se move por ação do dono ou pela venda.** A troca registrada na venda é
    só registro; o saldo muda na tela Estoque (troca peça por peça, ou entrada manual em
    defeito com reembolso). Não reautomatizar sem decisão do cliente.

16. **`git push` na `main` publica.** O projeto da Vercel está ligado ao repositório
    com `main` como branch de produção: o push sobe para
    `tarciobone.nextsolutionstech.com.br` sozinho, sem `vercel --prod`. Não existe
    "guardar no repositório e publicar depois" — quem faz push está publicando para o
    cliente. Trabalho em revisão fica em commit local.
17. **Devolução tem duas portas, e elas não se anulam.** Desde 2026-09-13 convivem
    `registrar_atendimento_pos_venda` (devolução ligada ao número da venda, com
    reembolso calculado) e `registrar_troca_estoque` (troca manual peça por peça, sem
    venda). A RPC de atendimento soma `trocas` + `atendimentos_pos_venda` antes de
    liberar quantidade, então uma não conta em dobro com a outra. Só apagar uma das
    duas com decisão do cliente registrada.

## Convenções

- Server Components por padrão; `"use client"` só onde há interação real.
- Nomes de domínio em português, como o banco (`TelaVender`, `registrar_venda`).
- Validação de entrada com `zod` no servidor; Server Action reconfere o papel antes de agir.
- Toda mudança de banco entra por `apply_migration` (MCP) **e** fica versionada em
  `supabase/migracoes/`, com o porquê escrito no comentário.
- Regerar `src/lib/supabase/types.ts` a cada mudança de schema. Nada de `any`.
- Ícones: SVG inline com `currentColor` em `lib/icones.tsx`. Sem emoji.

## Identidade visual — dois registros, de propósito

A marca é do cliente: logo **Tarcio Boné Premium**, preto e dourado, serifada. O dourado
`#d0b088` foi amostrado da própria arte. A logo sem fundo (`logo-tarcio-transparente.png`)
é para fundo escuro; o símbolo TB (`simbolo-tarcio.png`) é para espaço pequeno — a 32px o
lockup inteiro vira borrão.

**Sistema** (`(sistema)/*`) — ferramenta de trabalho, claro de propósito (usado o dia
inteiro). Tokens `--ar-*`: marca `#1a1a1c` (preto da marca), acento dourado `#8a6a35`,
fundo `#f3f5f9`. Display **Archivo**, texto **Inter**.

**Loja** (`catalogo/*`, `pedido/*`) — fala com o lojista comprando, registro premium.
Tokens `--lj-*`: ônix `#0b0b0c`, carvão `#141416`, creme `#f0ebe3`, ouro `#d0b088`.
**Playfair Display** nos títulos e **Jost** nas etiquetas, carregadas só nessas rotas. O
`<body>` é do sistema: quem pinta o preto é `body:has(.registro-loja)`.

Página de produto no desenho de loja grande (referência Shein): a foto troca com a cor,
as cores são as próprias fotos, tamanhos em pílula com o esgotado riscado. **Sem
avaliação, selo de mais vendido, desconto relâmpago ou favoritos** — linguagem de
marketplace não entra no catálogo de um distribuidor.

Texto sobre dourado é **ônix, nunca branco nem creme** (branco sobre `#e6d0b0` dá 1,4:1).

## Ambiente

Supabase `varejoflow` (`mzsdvusygxhczamzsvso`, região sa-east-1), contas da empresa.
Repo: `NextSolutions-dev/TarcioBone-System`. Produção: https://tarciobone.nextsolutionstech.com.br
(projeto `tarciobone` na Vercel; o endereço reserva é `tarciobone.vercel.app`. O antigo
`varejoflow.vercel.app` deixou de existir quando o projeto foi renomeado em 2026-09-13.)
Segredos só em `.env.local` / envs da Vercel. Não existe uso de service key neste projeto.

⚠️ **Não há base de desenvolvimento separada** — o `.env.local` aponta para o banco de
produção do cliente. Enquanto ele não carregar dado real, testar assim é tolerável;
depois disso, não é. `DELETE`/`UPDATE` em dado de cliente exigem autorização nominal.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
