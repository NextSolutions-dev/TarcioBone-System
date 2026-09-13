# Fase atual — o que já está pronto

Atualizado em **2026-09-13**. Sistema do **Tarcio Boné** (atacado e varejo de bonés e
moda masculina, Caruaru/PE).

**Fases 0 a 8 concluídas.** A troca deixou de estar bloqueada: o cliente definiu como
quer em 06/09 e ela foi construída. As Fases 5 a 7 nasceram da **auditoria do time em 03/09** (`faltaaplicar.md`):
todas as sete constatações procediam e foram tratadas. Antes de reportar erro, dá uma
olhada em **"O que ainda NÃO existe"** no fim: várias ausências são decisão, não falha.

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

## Fase 5 — fechar a exposição

Veio da auditoria. O sistema estava no ar com **e-mail e senha do dono pré-preenchidos no
formulário de login**, e o repositório era público.

- **Preenchimento removido** do login. A Fase 0 tinha tirado só o bloco de texto que
  exibia as credenciais; os campos continuavam preenchidos desde o commit inicial.
- **Senha fora do seed** (`04_seed_demo.sql`): agora vem de `current_setting('demo.senha')`.
- ✅ **Senha trocada** no console do Supabase em 06/09. Os e-mails `@abareta` seguem.
- ✅ **Repositório fechado** (privado) em 06/09.
- ✖️ **Leaked Password Protection não será ligado** — decisão de 13/09: não está disponível
  para o projeto. O advisor vai continuar acusando esse aviso; não é esquecimento.

## Fase 6 — o repositório volta a reconstruir o sistema

Era o achado mais caro da auditoria: as migrações 07, 09, 10 e 11 diziam "corpo aplicado
via MCP" e **não guardavam o SQL**. Um banco criado só por elas ficava com uma
`registrar_venda` sem canal, avulso, desconto nem frete, e sem função de faturamento.

- **`12_funcoes_canonicas.sql`** passa a guardar a definição final de todas as funções.
  Ficou num arquivo só porque a `registrar_venda` muda entre a 07 e a 09 — repetir o corpo
  nas duas criaria duas cópias divergentes. **Rodar 01 → 12 reproduz a produção.**
- **Seed do editor de catálogo** versionado na migração 10.
- **Lint zerado** — os 2 erros `set-state-in-effect` em Clientes. O reset do formulário
  saiu do efeito e foi para junto da ação; o aviso de telefone repetido virou valor
  derivado em vez de `setState` dentro do efeito.
- **Guarda de envio** nos botões de alternar/excluir bloco do editor.
- **`revoke execute` dos relatórios para `anon`.** Achado nosso, não da auditoria: as
  quatro funções de faturamento estavam liberadas para o visitante. **Não vazava** — testei,
  morre em `permission denied for table vendas` — mas grant indevido saiu.
- README e este arquivo alinhados ao código.

## Fase 7 — a identidade do Tarcio

A logo chegou em 06/09. O catálogo era urbano (azul royal, Anton, fundo claro) porque
nasceu de uma marca fictícia — e dizia o contrário do "Boné premium" que ele anuncia.

- **Logo aplicada** no catálogo, no login e no topo do sistema. O JPEG tinha cantos claros
  em volta do círculo preto; virou **PNG com recorte circular e fundo transparente**, para
  assentar sobre qualquer fundo.
- **Ícones do PWA** 192/512, `apple-touch-icon` e favicon, com fundo preto de sangria e a
  arte dentro da zona segura do recorte "maskable" do Android.
- **Paleta preto e dourado.** O dourado `#d0b088` foi **extraído da própria logo**, não
  escolhido no olho. Dá 9,4:1 de contraste sobre o preto; o creme do texto dá 16,6:1.
- **Playfair Display + Jost** no lugar de Anton + Space Mono. O título do herói deixou de
  ser caixa alta com tracking negativo (calibragem de fonte condensada) e virou caixa
  mista — é assim que "Tarcio" aparece na logo dele.
- **Copy do catálogo reescrita** para o posicionamento dele: distribuidor, peça premium,
  Caruaru, envio nacional. Tudo continua editável na tela Ajustes.
- **Manifesto do PWA** com o nome e as cores dele.
- Corrigido um defeito achado na verificação: o `<body>` continuava com o fundo claro do
  sistema, e no overscroll do celular aparecia uma faixa branca cortando a loja preta.

## Fase 8 — trocas

O cliente definiu em 06/09: a venda fica no histórico com data e hora, e o administrador
decide caso a caso se aceita a troca — dentro ou fora do prazo.

- **A tela de Vendas mostra há quantos dias cada venda foi feita.** É esse dado que
  sustenta a decisão. O prazo (padrão 15 dias) é configurável em Ajustes e **não bloqueia
  nada**: fora do prazo o sistema avisa em amarelo e deixa você aceitar.
- **Registrar troca** abre na própria venda, lista as peças daquele pedido com quanto
  ainda dá para trocar, e pede o motivo/especificação.
- **O registro na venda NÃO mexe no estoque** (mudança de 13/09 — ver abaixo).
- **A troca NÃO mexe no dinheiro da venda.** O valor daquele dia entrou de verdade;
  reescrever faturamento passado faria o relatório mentir. Diferença de preço se registra
  como venda nova com item avulso.
- Não dá para trocar mais peças do que saíram naquele item, e o duplo clique não gera
  duas trocas (mesma trava de chave da venda).
- Só o dono registra troca — checado na ação **e** na função do banco.

### Mudança de 13/09 — estoque da troca passa a ser manual

No primeiro uso real, uma troca teve motivo **"Aba torta"** e a opção "voltou para o
estoque", que vinha marcada, ficou marcada: **4 bonés com defeito voltaram ao saldo
vendável.** O padrão automático decidiu por quem não estava olhando.

Decisão do time: **estoque só se move por ação manual do dono**, na tela Estoque.

| Situação | O que o dono faz |
|---|---|
| Troca de uma peça por outra | **Estoque → Registrar troca**: escolhe a peça que volta e a que sai. As duas mudam na mesma hora |
| Defeito com reembolso | **Estoque → Lançar entrada**, à mão, só se a peça puder voltar à venda |

- A troca na **Vendas continua existindo como registro**: a venda no histórico, os dias
  decorridos, a peça e o motivo — foi o que o cliente pediu em 06/09. Ela só deixou de
  mover saldo; se as duas telas movessem, a mesma troca baixaria o estoque duas vezes.
- A troca no estoque é **uma transação só**: ou as duas peças mudam, ou nenhuma. Duplo
  clique vira uma troca só, e vendedor não registra.
- **Excluir a troca devolve o saldo** das duas peças, pelo mesmo mecanismo da venda.
- Dá para escolher **a mesma peça dos dois lados** — é o caso de trocar um boné com
  defeito por outro igual. O saldo líquido fica igual e o fato fica registrado.
- As trocas antigas, de antes da mudança, **ficam como estavam**: reescrever o histórico
  faria o registro mentir sobre o que aconteceu com o saldo naquele dia.

## Cores e tamanhos — 13/09

Referência: página de produto da Shein. Um produto tem várias cores, cada cor tem suas
fotos e seus tamanhos, cada tamanho tem seu estoque.

- **Cadastro**: um produto com todas as cores de uma vez — uma linha por cor, tamanhos
  separados por vírgula (*P, M, G*). O sistema gera o código de cada variação. Cor ou
  tamanho novo depois entra pelo botão **Cor ou tamanho** no card do produto.
- **Fotos por cor**, várias por cor. A primeira é a capa.
- **Estoque por tamanho**: cada tamanho de cada cor tem saldo próprio.
- **Tela de venda**: um card por produto mostrando as cores. Tocar abre a escolha de cor
  (pelas fotos) e tamanho, **com a quantidade de cada tamanho**.
- **Catálogo**: página de produto com a foto que troca junto com a cor, as cores como
  miniaturas, os tamanhos em pílula e o esgotado riscado. **O catálogo NÃO mostra
  quantidade** — só se tem ou não tem, pela mesma regra de sempre: saldo é informação de
  dentro da loja.
- **Sem avaliações, selo de mais vendido, desconto relâmpago ou favoritos**: é a
  estrutura da Shein, não a linguagem de marketplace.
- A mensagem do WhatsApp e a página do pedido já dizem **cor e tamanho**.
- Logo da tela de login **sem fundo**, casando com o preto e dourado do painel.

Por baixo: cada linha de `produtos` virou uma **variação**. Estoque, venda, troca e
faturamento continuam apontando para ela, então nada do que já estava verificado mudou.

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

Entre como **dono** (`dono@abareta.com.br`). A senha é com o Samuel — e repare que o
formulário **não vem mais preenchido**: isso é a correção da Fase 5, não um erro.

> ⚠️ O `.env.local` aponta para o banco **de produção** do cliente. Apague o que criar.

## Roteiro

**1. Ajustes → configurar a loja**
Dê um nome à loja e um número de WhatsApp. Clique em "Enviar mensagem de teste", marque
que chegou e salve.
✅ Sem marcar a confirmação, o número **não** aparece no catálogo.

**2. Ajustes → textos do catálogo**
Mude o título e o trecho colorido. Ponha pedido mínimo = 6.
✅ Se o trecho colorido não existir dentro do título, o sistema avisa e não salva.

**3. Produtos → cadastrar com cores e tamanhos**
Clique em **Novo produto**. Preencha nome, preço de varejo **e** de atacado. Na parte
"Cores e tamanhos": Cor 1 = *Preto*, tamanhos *P, M, G*; **Outra cor**: *Bege*, *M, G*.
✅ O contador diz **5 variações a criar**.
✅ O produto aparece com 2 cores; o Preto com P, M e G; o Bege com M e G.
✅ Em cada cor, **+ Foto** aceita várias fotos de uma vez; a primeira ganha o selo "capa".
✅ **Cor ou tamanho** num produto existente: adicione *Azul, P*. Repetir *Preto, P* não
duplica — avisa que já existia.
✅ Um produto **sem** preço de atacado mostra "Falta preço de atacado" e fica fora do site.

**4. Estoque → dar entrada por tamanho**
Dê entrada em *Preto · P*, *Preto · G* e *Bege · M*. Deixe *Preto · M* zerado.
✅ Na lista, cada tamanho aparece com seu saldo.
✅ Não existe campo para digitar o saldo direto — é de propósito.

**5. Clientes → cadastrar**
Cadastre um cliente com telefone. Cadastre outro com **o mesmo** telefone.
✅ Aparece o aviso de telefone repetido, mas deixa cadastrar.

**6. Vender → escolher cor e tamanho**
O produto aparece como **um card**, com as bolinhas das cores. Toque nele.
✅ Abre a escolha de **cor** (pelas fotos) e **tamanho**, com a **quantidade de cada
tamanho** embaixo da letra.
✅ *Preto · M* aparece **riscado e bloqueado** (sem peça).
✅ Trocar a cor troca a foto e os tamanhos.
✅ Escolha quantidade e **Adicionar ao carrinho**; em **Revisar**, dá para tirar ou pôr
peça com − e +.

**6b. Vender → venda completa**
Escolha o canal no topo e repare que o preço muda. Monte uma venda, escolha o cliente
cadastrado, some um **item avulso**, ponha **desconto** e **frete**, confirme.
✅ A conta aberta bate com o total.
✅ O estoque cai só pelos itens de catálogo — o avulso não mexe.
✅ Desconto maior que os itens é recusado.

**7. Vendas**
✅ A venda aparece com desconto, frete, canal e o item avulso marcado.
✅ Tem botão de WhatsApp, porque o cliente tem telefone.
✅ Mostra **há quantos dias** a venda foi feita.

**7b. Vendas → Registrar troca** (só registro)
Clique em "Registrar troca", escolha uma peça, ponha quantidade 1 e um motivo.
✅ O aviso diz há quantos dias foi vendida e se está dentro do prazo.
✅ Depois de registrar, **o estoque NÃO muda** — é de propósito.
✅ Tentar trocar mais peças do que a venda tem é recusado.
✅ O **total da venda não muda** — troca não mexe em dinheiro.

**7c. Estoque → Registrar troca** (move o saldo)
Escolha a peça que volta (qtd 1) e a que sai (qtd 1).
✅ A que volta **sobe 1** e a que sai **cai 1**, na mesma hora.
✅ No histórico, as duas linhas aparecem com o selo **Troca** e dizem as duas peças.
✅ Pedir para sair mais do que tem em estoque é recusado, e nenhuma das duas muda.
✅ Mesma peça dos dois lados é aceita, e o saldo fica igual.

**8. Faturamento**
✅ A ponte fecha: bruto − desconto = receita de produto; + frete = total recebido.
✅ Tem quebra por dia e por canal.

**9. `/catalogo` (abra numa aba anônima, sem login)**
✅ Cada produto é um card com as cores e os tamanhos que ainda têm peça.
✅ Clicar abre a **página do produto**: foto grande, cores pelas fotos, tamanhos em pílula.
✅ Tamanho sem peça aparece **riscado**; cor sem nenhuma peça aparece **riscada**.
✅ **Não aparece quantidade** em lugar nenhum do catálogo — é regra.
✅ No celular, o botão **Adicionar à sacola** fica fixo no pé da tela.
✅ Só aparecem os produtos com preço de atacado, e o preço mostrado é o de atacado.
✅ Com menos de 6 peças, diz quantas faltam e não deixa fechar.
✅ Com 6+, o botão do WhatsApp aparece e a mensagem traz um **link do pedido**.

**10. Abra o link do pedido**
✅ Mostra os itens com a **foto da cor pedida**, a cor, o tamanho e o total.
✅ Troque um código na URL por um inexistente: ele avisa que o item saiu do catálogo.

**11. Entre como vendedor** (o acesso de vendedor do time — peça ao Samuel)
✅ Não vê Produtos nem Ajustes.
✅ Não vê os formulários de entrada e de troca no Estoque.
✅ O faturamento mostra só o que ele vendeu.

---

# O que ainda NÃO existe (não reportar como erro)

- **E-mails de acesso** ainda são `@abareta.com.br` (a senha já foi trocada em 06/09).
- **Os acessos de teste são do time** (um dono e um vendedor) e **saem antes da entrega**,
  junto com os dados de teste — que ficam no banco até a cliente mandar a planilha dos
  produtos reais.
- **Excluir produto não apaga a foto** no armazenamento (arquivo órfão). Conhecido.
- **Não existe base de teste separada** — o local escreve na produção do cliente.
- **Editar e excluir** produto, cliente e venda pela tela ainda não existem (só cadastro).
- **Auditoria** (quem mudou o quê) não foi construída.
- **Sem nota fiscal, sem pagamento online, sem funcionamento offline** — decisões, não
  esquecimento.

# Como reportar

Para cada problema: **qual tela**, **o que você fez**, **o que esperava**, **o que
aconteceu**. Se aparecer mensagem de erro, copie o texto dela.
