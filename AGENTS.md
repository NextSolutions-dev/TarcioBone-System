# VarejoFlow — regras do projeto

Sistema de venda + estoque + faturamento para varejo com vendedores no celular, mais um
site público de catálogo que fecha o pedido no WhatsApp. É o **protótipo/vitrine da Next
Solutions** para o vertical varejo, rodando com a marca fictícia **Aba Reta** (bonés) e
dados de seed — não há dado de cliente real aqui.

> Antes de qualquer tarefa, leia o `README.md` para o contexto completo do sistema.

## Invariantes — não regridem

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
   `catalogo_publico` (`security_invoker = on`) e o grant é **por coluna**: o visitante
   enxerga `disponivel` (booleano gerado), nunca `estoque_atual`.
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

## Convenções

- Server Components por padrão; `"use client"` só onde há interação real.
- Nomes de domínio em português, como o banco (`TelaVender`, `registrar_venda`).
- Validação de entrada com `zod` no servidor; Server Action reconfere o papel antes de agir.
- Toda mudança de banco entra por `apply_migration` (MCP) **e** fica versionada em
  `supabase/migracoes/`, com o porquê escrito no comentário.
- Regerar `src/lib/supabase/types.ts` a cada mudança de schema. Nada de `any`.
- Ícones: SVG inline com `currentColor` em `lib/icones.tsx`. Sem emoji.

## Identidade visual — dois registros, de propósito

**Sistema** (`(sistema)/*`) — ferramenta de trabalho, segue o design system da casa.
Tokens `--ar-*`: marca `#16233d`, acento âmbar `#f59e0b`/`#b45c07`, fundo `#f3f5f9`.
Display **Archivo**, texto **Inter**.

**Loja** (`catalogo/*`) — fala com o consumidor final, registro editorial próprio.
Tokens `--lj-*`: tinta `#141a22`, concreto `#e7e5e0`, papel `#f7f6f3`, royal `#1f4fd8`.
**Anton** no cartaz e **Space Mono** na ficha técnica, carregadas só nesta rota.
Fundo neutro é decisão: quem traz cor são os bonés.

Assinatura da loja: **a linha da aba** — régua horizontal que nasce no hero, sustenta
a fila de bonés e volta como prateleira sob cada peça; no hover a peça descola e
inclina. É a única ousadia da página; não somar outras.

Ao adaptar para um cliente real: troque o bloco de tokens e o nome — a estrutura
das telas não muda.

## Ambiente

Supabase `varejoflow` (`mzsdvusygxhczamzsvso`, região sa-east-1), contas da empresa.
Repo: `NextSolutions-dev/TacioBone-System`. Produção: https://varejoflow.vercel.app
Segredos só em `.env.local` / envs da Vercel. Não existe uso de service key neste projeto.

⚠️ **Não há base de desenvolvimento separada** — o `.env.local` aponta para o banco de
produção do cliente. Enquanto ele não carregar dado real, testar assim é tolerável;
depois disso, não é. `DELETE`/`UPDATE` em dado de cliente exigem autorização nominal.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
