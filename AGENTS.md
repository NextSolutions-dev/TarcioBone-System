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
11. **`.cascata` usa `animation-fill-mode: backwards`, nunca `both`.** Com `both` o
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

## Identidade visual (Aba Reta — fictícia)

Tokens em `globals.css`, prefixo `--ar-`. Marca `#16233d` (azul-noite), acento
`#f59e0b` / `#b45c07` (âmbar), fundo `#f3f5f9`. Display **Archivo**, texto **Inter**.
Ao adaptar para um cliente real: troque só o bloco de tokens e o nome — a estrutura
das telas não muda.

## Ambiente

Supabase `varejoflow` (`mzsdvusygxhczamzsvso`, região sa-east-1), contas da empresa.
Segredos só em `.env.local` / envs da Vercel. Não existe uso de service key neste projeto.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
