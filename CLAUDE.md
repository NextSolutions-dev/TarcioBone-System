@AGENTS.md

## Banco

Projeto Supabase: `varejoflow` — ref `mzsdvusygxhczamzsvso` (org da empresa, sa-east-1).

Hoje o banco só tem **seed fictício da loja-demo Aba Reta**. Se este sistema for vendido
a um cliente real, passa a valer a regra da casa: `DELETE` e `UPDATE` em dado do cliente
são proibidos sem autorização explícita e nominal do dono, para as linhas citadas — nunca
para a categoria. `execute_sql` só para `SELECT` de diagnóstico; alteração vai por
`apply_migration`.
