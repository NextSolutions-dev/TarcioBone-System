# Fase atual — o que já está pronto

Atualizado em **2026-09-01**. Sistema do **Tarcio Bone** (atacado e varejo de bonés e
moda masculina, Caruaru/PE).

**Fases 0 a 4 concluídas**, com uma única tarefa bloqueada (troca — o cliente ainda não
definiu como quer). Antes de reportar erro, dá uma olhada em **"O que ainda NÃO existe"**
no fim: várias ausências são decisão, não falha.

---

# Parte 1 — O que foi feito

## Fase 0 — deixar de ser demonstração

O projeto nasceu como protótipo de vitrine e virou entrega quando o Tarcio fechou.

- **Cópia da vitrine separada** (`varejoflow-vitrine`), feita por `git clone` e não por
  cópia de pasta — assim ela não leva `.env.local` nem `.vercel`, que apontam para o
  banco e o deploy do cliente.
- **Seed fictício apagado** do banco: 48 vendas, 80 itens, 94 movimentos, 14 produtos e
  4 categorias. Os 3 usuários ficaram, senão ninguém entra no sistema.
- **Credenciais de demonstração saíram da tela de login.**
- Ficha do cliente, decisões e índices registrados no vault da Next.

## Fase 1 — fundação de dados

### 1.1 Clientes

- Tabela `clientes` (nome, telefone, cidade, observação) com RLS.
- `vendas.cliente_id` **anulável de propósito**: venda de balcão não pode exigir
  cadastro — seria fricção com o cliente esperando na frente.
- Tela **Clientes**: lista, busca por nome ou telefone, cadastro.
- **Aviso de telefone repetido** em vez de constraint única. Em família dois clientes
  dividem o número, então travar no banco quebraria caso legítimo — o sistema mostra
  quem já usa aquele número e deixa você decidir.
- Na tela **Vender**, o campo de cliente virou seletor: escolher um cadastrado grava o
  vínculo; digitar solto continua funcionando.
- Telefone é guardado só em dígitos com DDI, porque é o formato que o WhatsApp consome.

### 1.2 Fotos de produto

- Bucket `produtos` **público para leitura** (foto de produto é conteúdo público do
  catálogo; URL assinada expiraria numa página cacheada) e **escrita só do dono**.
- Limite de 3 MB e lista de tipos ficam **no bucket** — quem valida é o servidor do
  Supabase, não a tela.
- O upload **converte para JPEG e reduz para 1400px no navegador**. Resolve dois
  problemas: foto de iPhone em HEIC que sobe e não aparece, e o consumo de banda, que é
  o que estoura o plano gratuito.
- Caminho do arquivo é gerado pelo sistema, nunca o nome original enviado pelo usuário.
- O catálogo usa a foto quando existe e cai numa ilustração quando não existe.

### 1.3 Atacado × varejo

- Produto ganhou **preço de atacado** (opcional) além do de varejo.
- Venda ganhou **canal** (varejo/atacado).
- **Quem escolhe o preço é o banco, não a tela.** A mesma quantidade sai por valores
  diferentes conforme o canal.
- O catálogo **só lista produto que tem preço de atacado**. Cair no preço de varejo por
  falta do outro mostraria ao lojista o preço do consumidor final.
- Vender no atacado item sem esse preço é recusado com mensagem clara.

## Fase 2 — o dinheiro do pedido

O total deixou de ser a soma dos itens. Agora é **`subtotal − desconto + frete`**, com
cada parcela guardada em coluna própria.

- **Itens avulsos**: dá para incluir no pedido algo que não está no cadastro, digitando
  nome e valor na hora. **Não mexe no estoque** — é coisa fora do cadastro, não há saldo
  para baixar; inventar um produto fantasma sujaria o catálogo e o ranking.
- **Desconto manual** no fechamento, com motivo, e teto no banco: não pode passar do
  valor dos itens.
- **Frete** por pedido. Entra no que o cliente paga mas **fica fora da receita de
  produto** — somado junto, faria parecer que a loja vendeu mais do que vendeu.
- Na tela de fechamento a **conta fica aberta**: itens, desconto, frete e o total.
- **Faturamento reconstruído**: mostra a ponte inteira em vez de um número só —
  bruto → desconto → receita de produto → frete → total recebido.
- **Quebra dia a dia**, que o cliente pediu.
- Por produto o valor é bruto, e **itens avulsos aparecem pelo nome**, na categoria
  "Avulso" — o detalhamento não mente sobre o que foi vendido.

## Fase 3 — catálogo de atacado

- **Editor de catálogo** na tela **Ajustes**: o dono edita o texto do topo (linha de
  cima, título, trecho colorido, parágrafo), o rodapé, o pedido mínimo e os blocos das
  duas seções do site, com ativar/desativar e excluir.
  **O catálogo não tem mais nenhum texto fixo no código.**
- Conteúdo inicial neutro, tirado do que o próprio Tarcio anuncia no perfil dele. Não
  reaproveitei a copy de boné do protótipo porque ele vende boné **e** moda masculina.
- **Pedido mínimo** configurável: o catálogo só libera fechar o pedido ao atingir a
  quantidade, e avisa quantas peças faltam.
- **Página pública `/pedido`** com as fotos dos itens. É o que resolve o pedido de
  "a mensagem já ir com as imagens": o WhatsApp não anexa imagem por link, só texto,
  então a mensagem leva o endereço dessa página.
- **O pedido não é gravado.** Os itens viajam na própria URL (`?i=SKU:QTD`) e a página
  busca no catálogo. Com isso não nasce venda que ninguém confirmou, e o visitante
  continua sem nenhuma permissão de escrita no banco.

## Fase 4 — operação diária

- **Faturamento por canal**: atacado × varejo, com a participação de cada um. É a leitura
  que diz qual das duas pernas sustenta a loja.
- **Mensagem ao cliente pelo sistema**: botão na tela de Vendas que monta no WhatsApp um
  resumo daquele pedido. Só aparece quando há cliente cadastrado **e** com telefone.
- ⏸ **Troca — não construída.** O Tarcio ainda não disse se quer só uma observação
  escrita ou um fluxo que devolve a peça ao estoque. São coisas muito diferentes, e
  construir no escuro seria retrabalho garantido.

## Regras que o sistema garante no banco (não só na tela)

Vale saber, porque muita coisa que parece "trava da interface" é o banco recusando:

- Estoque **nunca é digitado** — ele se move sozinho a cada venda.
- Dois celulares vendendo a última peça: um ganha, o outro recebe recusa.
- Duplo clique / F5 no fechamento **não gera duas vendas**.
- Venda nasce inteira ou não nasce.
- Vendedor não altera produto, não dá entrada em estoque, não mexe em Ajustes e só
  enxerga as próprias vendas.
- Visitante do site não fala com as tabelas — lê só o que é público, e nunca o saldo.

---

# Parte 2 — Como testar

Banco começa **vazio** (0 produtos, 0 vendas, 0 clientes). Faça na ordem: cada passo
depende do anterior.

## Antes de começar

```bash
npm install
cp .env.example .env.local   # peça os 2 valores ao Samuel
npm run dev                  # http://localhost:3000
```

Entre como **dono** (`dono@abareta.com.br`). A senha é com o Samuel.

> ⚠️ O `.env.local` aponta para o banco **de produção** do cliente. Apague o que criar.

## Roteiro

**1. Ajustes → configurar a loja**
Dê um nome à loja e um número de WhatsApp. Clique em "Enviar mensagem de teste", marque
que chegou e salve.
✅ Sem marcar a confirmação, o número **não** aparece no catálogo.

**2. Ajustes → textos do catálogo**
Mude o título e o trecho colorido. Ponha pedido mínimo = 6.
✅ Se o trecho colorido não existir dentro do título, o sistema avisa e não salva.

**3. Produtos → cadastrar**
Cadastre 2 produtos com preço de varejo **e** de atacado. Cadastre 1 **sem** preço de
atacado. Mande foto em qualquer um.
✅ O sem preço de atacado mostra "Falta preço de atacado" e não vai para o catálogo.
✅ A foto aparece na miniatura, mesmo se você enviar PNG.

**4. Estoque → dar entrada**
Dê entrada de 20 peças em cada produto.
✅ O saldo sobe. Tente digitar o saldo direto — não existe esse campo, é de propósito.

**5. Clientes → cadastrar**
Cadastre um cliente com telefone. Cadastre outro com **o mesmo** telefone.
✅ Aparece o aviso de telefone repetido, mas deixa cadastrar.

**6. Vender → venda completa**
Escolha o canal no topo e repare que o preço muda. Monte uma venda, escolha o cliente
cadastrado, some um **item avulso**, ponha **desconto** e **frete**, confirme.
✅ A conta aberta bate com o total.
✅ O estoque cai só pelos itens de catálogo — o avulso não mexe.
✅ Desconto maior que os itens é recusado.

**7. Vendas**
✅ A venda aparece com desconto, frete, canal e o item avulso marcado.
✅ Tem botão de WhatsApp, porque o cliente tem telefone.

**8. Faturamento**
✅ A ponte fecha: bruto − desconto = receita de produto; + frete = total recebido.
✅ Tem quebra por dia e por canal.

**9. `/catalogo` (abra numa aba anônima, sem login)**
✅ Só aparecem os produtos com preço de atacado, e o preço mostrado é o de atacado.
✅ Com menos de 6 peças, diz quantas faltam e não deixa fechar.
✅ Com 6+, o botão do WhatsApp aparece e a mensagem traz um **link do pedido**.

**10. Abra o link do pedido**
✅ Mostra os itens com foto e o total.
✅ Troque um código na URL por um inexistente: ele avisa que o item saiu do catálogo.

**11. Entre como vendedora** (`camila@abareta.com.br`)
✅ Não vê Produtos nem Ajustes.
✅ O faturamento mostra só o que ela vendeu.

---

# O que ainda NÃO existe (não reportar como erro)

- **Identidade visual do cliente.** O sistema ainda usa a marca fictícia "Aba Reta". A
  marca do Tarcio é preto e dourado, e a troca depende do arquivo da logo.
- **Troca/devolução** — bloqueada, aguardando definição dele.
- **Excluir produto não apaga a foto** no armazenamento (arquivo órfão). Conhecido.
- **Não existe base de teste separada** — o local escreve na produção do cliente.
- **Editar e excluir** produto, cliente e venda pela tela ainda não existem (só cadastro).
- **Auditoria** (quem mudou o quê) não foi construída.
- **Sem nota fiscal, sem pagamento online, sem funcionamento offline** — decisões, não
  esquecimento.

# Como reportar

Para cada problema: **qual tela**, **o que você fez**, **o que esperava**, **o que
aconteceu**. Se aparecer mensagem de erro, copie o texto dela.
