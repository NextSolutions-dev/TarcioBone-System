 O projeto está parcialmente pronto para testes manuais, mas ainda não dá para considerar “fases 0–4 concluídas e
  verificadas” sem ressalvas.

   Fase      Situação encontrada
  ━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Fase 0    Parcial e com falha crítica nas credenciais
  ────────  ──────────────────────────────────────────────────────────
   Fase 1    Implementada no front, schema e tipos
  ────────  ──────────────────────────────────────────────────────────
   Fase 2    Interface pronta, mas SQL completo não está versionado
  ────────  ──────────────────────────────────────────────────────────
   Fase 3    Implementada e parcialmente confirmada em produção
  ────────  ──────────────────────────────────────────────────────────
   Fase 4    Interface pronta; RPC de faturamento não está versionada
  ────────  ──────────────────────────────────────────────────────────
   Trocas    Não implementadas, como documentado

  Principais constatações:

  1. Credenciais ainda estão na tela e no código. O login publicado vem com e-mail e senha preenchidos em src/app/
     login/formulario.tsx:41 e src/app/login/formulario.tsx:59. A senha também aparece na migração de seed
     (supabase/migracoes/04_seed_demo.sql:45). Isso contradiz diretamente o fase_atual.md:23 e o README.md:90.
     Deve-se assumir essa senha como comprometida e rotacioná-la antes de compartilhar o sistema para testes.

  2. As migrações não reproduzem o banco atual. Os arquivos 07, 09, 10 e 11 contêm comentários dizendo que a
     implementação completa foi aplicada via MCP, mas não guardam o SQL correspondente:
      - supabase/migracoes/07_atacado_varejo.sql:45
      - supabase/migracoes/09_avulsos_desconto_frete.sql:42
      - supabase/migracoes/10_editor_catalogo.sql:57
      - supabase/migracoes/11_faturamento_por_canal.sql:5

     Em um banco criado apenas com essas migrações, a RPC de venda não aceitaria canal, avulsos, desconto ou frete,
     e as funções faturamento_por_dia e faturamento_por_canal nem seriam criadas. Essas funcionalidades só podem
     estar funcionando porque existem alterações aplicadas diretamente no banco de produção.

  3. O build passa, mas o lint não.
      - npm run build: passou, com todas as rotas geradas.
      - npm run lint: falhou com 2 erros react-hooks/set-state-in-effect em src/app/(sistema)/clientes/formulario-
        cliente.tsx:47 e src/app/(sistema)/clientes/formulario-cliente.tsx:72.

      - Não existem arquivos nem script de testes automatizados.

  4. A produção pública está online. /, /catalogo e /pedido responderam HTTP 200. Pela API pública do Supabase,
     confirmei:
      - catalogo_publico acessível;
      - catalogo_blocos acessível, com 6 blocos;
      - configuração e hero existentes;
      - zero produtos no catálogo;
      - pedido mínimo atualmente 0;
      - WhatsApp ainda não publicado;
      - saldo real, clientes e vendas bloqueados para anônimo.

     Assim, /pedido e o editor estão implantados, mas o roteiro completo do catálogo ainda exige cadastrar
     produtos, estoque, pedido mínimo e WhatsApp.

  5. A frase “não existe texto fixo no catálogo” é exagerada. Ainda existem títulos e fallbacks fixos como “Por que
     comprar aqui”, “A coleção”, “Como comprar” e “Catálogo online” em src/app/catalogo/page.tsx:146. O conteúdo
     principal é editável, mas não todo o texto.

  6. A venda principal segue as invariantes. O front chama somente registrar_venda, envia canal, cliente, avulsos,
     desconto e frete, e possui trava por ref e “Salvando…” em src/app/(sistema)/vender/tela-vender.tsx:143. Porém,
     várias gravações secundárias — alternar produto no catálogo, ativar/excluir blocos e formulários comuns — não
     possuem a trava por ref exigida pelo AGENTS.md.

  7. O README está desatualizado. Ele ainda declara apenas fases 1–2 concluídas em README.md:127 e lista página de
     pedido, mensagem pelo sistema e editor como faltantes, embora já estejam no código.

  Minha conclusão prática: as funcionalidades das fases 1–4 estão majoritariamente presentes no front e parte delas
  está confirmada no ambiente publicado, mas antes de iniciar testes com terceiros eu corrigiria, nesta ordem:
  credenciais expostas, migrações incompletas, erros de lint e documentação divergente. Não alterei nenhum arquivo
  nem dado do banco durante a auditoria.