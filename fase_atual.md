# Fase atual — o que já está pronto

Atualizado em **2026-09-13**. Sistema do **Tarcio Boné** (atacado e varejo de bonés e
moda masculina, Caruaru/PE).

**Fases 0 a 8 concluídas**, e em 13/09 o produto ganhou **cores e tamanhos** — catálogo e
tela de venda no desenho de página de produto de loja grande. Essa mudança está explicada
item por item em **"Cores e tamanhos — os 4 pedidos de 13/09"**, logo abaixo das fases.
A troca deixou de estar bloqueada: o cliente definiu como quer em 06/09 e ela foi construída. As Fases 5 a 7 nasceram da **auditoria do time em 03/09** (`faltaaplicar.md`):
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
- **Troca foi definida e construída depois**, na Fase 8. O fluxo atual está descrito
  lá; a mudança pedida no relatório de testes está planejada na Parte 3.

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

## Cores e tamanhos — os 4 pedidos de 13/09

Publicado em produção em 13/09. Os quatro itens seguem a ordem do pedido.

> ⚠️ **Antes de testar, duas coisas.**
> - **As fotos antigas não aparecem no catálogo novo.** Agora a foto é **por cor**, então
>   cada produto precisa ter as fotos reenviadas na tela **Produtos**, em cada cor.
> - **As telas Produtos e Vender não foram vistas no navegador por quem construiu** (exigem
>   login). O catálogo e a página do pedido foram testados em computador e celular. Se algo
>   quebrar nessas duas telas, é o primeiro lugar a olhar.

---

### 1. Análise da referência (página de produto da Shein)

**O que a referência faz:**
- Um **produto** tem várias **cores**, e cada cor tem **as suas fotos** — trocar a cor troca
  a foto grande e a faixa de miniaturas.
- As cores aparecem **como fotos**, não como bolinhas coloridas.
- Escolhida a cor, aparecem os **tamanhos em pílulas**; o que acabou fica indisponível.
- Nome, preço e botão de adicionar ficam fixos enquanto a pessoa escolhe.

**O que isso exigiu por baixo:** até aqui cada produto era "modelo + cor", sem tamanho e
com uma foto só. Agora é **produto → cor → tamanho**:

| Tabela | O que guarda |
|---|---|
| `modelos` | o produto que o cliente vê: nome, descrição, categoria, se está no site |
| `produtos` | a **variação** (produto + cor + tamanho): é ela que tem estoque, preço e código |
| `modelo_fotos` | as fotos **de cada cor** |

A variação ficou na tabela `produtos` de propósito: **estoque, venda, troca e faturamento
já apontavam para ela**, então nada do que estava verificado precisou ser refeito.

A migração (`15_modelos_cores_tamanhos.sql`) só **acrescentou** coisas — não removeu nem
renomeou nada. Por isso o site publicado continuou funcionando enquanto o código novo não
subia.

---

### 2. Catálogo e tela de venda com foto, cores, tamanhos e quantidades

**O que foi feito:**

**Produtos (cadastro)**
- Um produto é cadastrado **com todas as cores de uma vez**: uma linha por cor, e os
  tamanhos da cor separados por vírgula (*P, M, G*). Vazio = tamanho único.
- O contador mostra quantas variações vão ser criadas antes de salvar.
- O sistema **gera o código** de cada variação (ex.: `POLO-PRE-M`).
- Produto e variações nascem **juntos** — não existe produto vazio esperando a cor.
- **Fotos por cor**, várias de uma vez. A primeira é a capa.
- Chegou cor ou tamanho novo? Botão **Cor ou tamanho** no card do produto. Repetir uma
  variação que já existe não duplica — só avisa.
- Cada tamanho mostra seu estoque: vermelho sem peça, amarelo abaixo do mínimo.

**Vender (sistema)**
- **Um card por produto**, com a foto, as bolinhas das cores, os tamanhos e o total de
  peças.
- Tocar abre a escolha de **cor** (pelas fotos) e **tamanho**, com a **quantidade de cada
  tamanho** escrita embaixo da letra.
- Tamanho sem peça fica **riscado e bloqueado**. Trocar a cor troca a foto e os tamanhos.
- No carrinho (**Revisar**), cada peça tem **−** e **+**, e o nome já diz cor e tamanho.
- Busca encontra por nome, cor, tamanho ou código.

**Catálogo (site)**
- Card do produto: foto (a segunda foto aparece ao passar o mouse), cores pelas fotos,
  tamanhos que ainda têm peça e o preço.
- Clicar abre a **página do produto**: foto grande com miniaturas, **Cor** com as fotos de
  cada cor, **Tamanho** em pílulas, quantidade e **Adicionar à sacola**.
- Tamanho sem peça aparece **riscado**; cor sem nenhuma peça aparece **riscada**.
- No celular a foto desliza com o dedo e o botão de adicionar fica **fixo no pé da tela**.
- A sacola, a mensagem do WhatsApp e a página do pedido dizem **cor e tamanho**; a foto do
  pedido é a da cor pedida.

**Onde a quantidade aparece:** na **tela de venda**, sim. No **catálogo, não** — lá só
aparece se tem ou não tem. É a regra que o sistema segue desde o início: o saldo exato é
informação comercial (concorrente e lojista negociando usariam), e a própria Shein também
não mostra. Mostrar no catálogo é uma mudança pequena, se o Tarcio quiser.

**Como testar:**
1. **Produtos → Novo produto**: *Preto* com *P, M, G* e *Bege* com *M, G*.
   ✅ O contador diz 5 variações; o produto aparece com 2 cores.
2. Envie **fotos** em cada cor.
   ✅ A primeira ganha o selo "capa".
3. **Estoque**: dê entrada em *Preto P*, *Preto G* e *Bege M*. Deixe *Preto M* zerado.
4. **Vender**: toque no card.
   ✅ Aparece a quantidade embaixo de cada tamanho; *Preto M* está riscado.
   ✅ Trocar para Bege troca a foto e os tamanhos.
5. **/catalogo** numa aba anônima: abra o produto.
   ✅ Cores pelas fotos, *Preto M* riscado, **nenhuma quantidade aparece**.
6. Adicione à sacola e abra o **link do pedido**.
   ✅ O pedido mostra a foto da cor, a cor e o tamanho.

---

### 3. Sem nada de marketplace

**O que foi feito:** da referência veio só a **estrutura** — foto por cor, cores como
miniaturas, tamanhos em pílula. Ficou de fora, de propósito:
- avaliações e estrelas;
- selo de "mais vendido" e ranking;
- preço riscado, desconto relâmpago e contagem regressiva;
- favoritos (coração);
- "enviado por", guia de tamanhos e sugestão de tamanho.

O visual segue o do Tarcio: preto, dourado e serifada.

**Como testar:** abra qualquer produto no catálogo.
✅ Nenhum desses elementos aparece.

---

### 4. Logo sem fundo na tela de login

**O que foi feito:**
- A logo é dourada sobre preto chapado, e o painel do login é preto com brilho dourado —
  por isso ela aparecia dentro de um **retângulo preto** recortado no degradê.
- O fundo foi **retirado da imagem**, não redesenhado em SVG: o dourado tem brilho
  metálico, e um SVG achataria tudo numa cor só.
- A retirada foi pela conta exata de "arte sobre preto": recomposta sobre preto, a imagem
  volta ao original com erro médio de 0,15 em 255 — praticamente sem perda.
- Arquivos novos: `logo-tarcio-transparente.png` (logo inteira, 1200px) e
  `simbolo-tarcio-transparente.png` (só o TB, 512px).

**Como testar:** abra **/login** no computador.
✅ A logo aparece direto sobre o fundo, sem retângulo preto em volta.

---

### Correções feitas no caminho

- **Botão com varredura dourada** no catálogo deixava o texto **branco sobre dourado
  claro** — quase ilegível. Agora o texto escurece.
- **Botões do WhatsApp** (verde) e **"Chamar no WhatsApp"** (dourado) tinham texto creme,
  com contraste ruim. Agora é preto.
- Estoque, Vendas, Faturamento e Painel passaram a mostrar o **tamanho** junto do nome —
  senão "Polo · Preto · P" e "Polo · Preto · G" apareciam iguais.

## Capa do catálogo e acesso por link — 17/09

**Banco zerado nesta data.** Produtos, vendas, estoque, trocas, clientes e categorias
foram apagados. Ficaram: os **acessos**, a **configuração da loja** e os **6 blocos de
texto** do catálogo. Sobrou 1 arquivo de foto sem dono no armazenamento — o Storage não
aceita exclusão por SQL; apagar no painel do Supabase, em Storage → `produtos`.

### O que mudou na aparência

Só a **abertura**. Produtos e preços continuam exatamente como estavam.

- A capa ocupa a tela toda: a **marca** de um lado, o **slogan** do outro, com a linha
  dourada da casa por baixo e um convite para rolar.
- Dois focos de luz dourada giram devagar no fundo — o preto chapado atrás de tipografia
  grande ficava morto.
- O texto continua vindo de **Ajustes**: linha de cima, título, trecho dourado e
  parágrafo. Nada foi fixado no código.
- **Coleção vazia agora tem aviso** ("A coleção está sendo atualizada") em vez de um vão
  em branco — é o que o visitante vê até a planilha da cliente entrar.

### Acesso ao catálogo

Decisão: o catálogo é **aberto por link**, não por busca.

- O link **"Área da loja" saiu do catálogo**: quem compra não tem o que fazer no login.
  O dono continua entrando por `/login`, e o app instalado abre direto em `/vender`.
- **Nada é indexado** (`robots.txt` + `noindex`): o catálogo some do Google.
- ⚠️ Isto **não é proteção** — quem souber o endereço `/catalogo` entra. Se a cliente
  quiser restrição de verdade, o próximo passo é **link com código**
  (`/catalogo?c=xxxxx`), que ainda não foi feito.

### Correções de passagem

- `.clip-aba` e `.risca-aba` usavam `both` e deixavam transformação retida — a armadilha
  que já quebrou a barra do carrinho. Agora usam `backwards`.
- A abertura passou a respeitar "reduzir movimento"; antes só a `.cascata` respeitava.
- A cor da barra do navegador ainda era o azul-marinho do protótipo.

## Merge com o trabalho do Angelo — 18/09

O repositório tinha duas linhas de trabalho paralelas sobre a mesma base. Juntadas sem
conflito de arquivo (`b25ea64`), com `tsc`, `lint` e `build` limpos.

### O que veio do Angelo (já está no ar desde 13/09 23:40)

- **Devolução ligada à venda** — a tela Estoque ganhou "Realizar troca": o dono digita o
  **número da venda**, escolhe o item devolvido e diz se a peça volta ao estoque. Em
  reembolso o valor sai calculado, com o desconto da venda rateado e o frete devolvido
  quando a venda inteira volta.
- **Migração 16** (`atendimentos_pos_venda`) — aditiva, já aplicada no banco, com
  `revoke ... from public, anon`, trava por chave de envio e bloqueio dos produtos em
  ordem de id. Não reescreve venda nem estoque por fora.
- **Reembolso aparece no faturamento e no painel** (`resumo_reembolsos` e as duas
  quebras, por dia e por canal).
- **Categoria criada dentro do formulário do produto**, sem sair da tela.

### A troca manual saiu — decisão de 18/09

Prevalece o fluxo que já está no ar. A troca manual peça por peça, feita para o pedido
de 13/09, foi removida: a ação sumiu de `estoque/acoes.ts` e a **migração 17** derruba
`registrar_troca_estoque`, a tabela `trocas_estoque` e a coluna que ligava o movimento
a ela.

Duas coisas ficam de pé, de propósito:

- **`public.trocas` continua no banco**, vazia e sem quem escreva nela. A RPC do Angelo
  soma essa tabela com `atendimentos_pos_venda` para saber quanto de cada item já
  voltou; derrubá-la quebraria a devolução em produção.
- **A migração 17 é destrutiva**, o inverso da regra das migrações. Por isso ela só
  pode ser aplicada **depois** do deploy que tira a ação do código — antes disso o que
  está publicado ainda declara a função. Ainda não foi aplicada.

Fica um buraco conhecido, e ele é da decisão, não do código: **peça vendida fora do
sistema não tem devolução**. O caminho para ela é entrada manual de estoque com o motivo
escrito, e aí não existe registro de troca nem reembolso calculado.

### Situação do que ainda não subiu

A capa do catálogo, o acesso por link e o banco zerado estão **em commit local**, não
publicados. Em produção ainda roda o catálogo anterior — que, com o banco zerado, mostra
a coleção vazia sem o aviso "A coleção está sendo atualizada" (o aviso veio no commit que
não subiu).

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

# Parte 3 — auditoria do relatório e próxima fase

Auditado no código em **2026-09-13**. Categoria e controle do catálogo foram
implementados no código local; o novo fluxo de troca/reembolso **continua plano,
não entrega**. O roteiro 7b/7c acima descreve o fluxo ainda vigente e precisa
ser substituído após a próxima publicação. Não houve teste autenticado no
navegador nem escrita no banco.

| Pedido | Situação verificada |
|---|---|
| Categoria no cadastro | **Implementado no código local; teste autenticado pendente.** O formulário agora cria e seleciona a categoria sem apagar o produto preenchido. A tabela e a permissão de escrita do dono já existiam. |
| SKU opcional | **Já vale para o cadastro.** Não há campo obrigatório; o sistema gera o SKU interno. A coluna ainda é obrigatória no banco e o link `/pedido?i=SKU:QTD` a utiliza. |
| Sem preço de atacado | **Implementado no código local; teste autenticado pendente.** A view pública exclui a variação; o card não mostra mais o botão e a ação do servidor recusa habilitar modelo sem preço de atacado. |
| Troca e reembolso | **Pendente.** Vendas registra troca sem mexer no saldo; Estoque tem um segundo formulário que movimenta duas peças, sem vínculo obrigatório à venda. Faturamento não abate reembolsos. |
| Teste 10, link do pedido | **Código pronto, teste completo pendente.** A página aceita URL válida manualmente; a geração pelo catálogo exige WhatsApp testado e ativado em Ajustes, pedido mínimo e produtos publicados. |
| Faturamento do vendedor | **Pendente.** A RLS restringe os dados, mas a tela mostra o mesmo detalhamento do dono. Comissão não existe. |
| Logo sem fundo | **Já aplicado no login**, que usa `logo-tarcio-transparente.png`. Conferir o símbolo usado no sistema e catálogo visualmente antes de mudar. |

## Plano de implementação

1. **Categoria:** botão “+ Nova categoria” ao lado do seletor, cadastro sem perder os
   dados já digitados e seleção imediata. Validar no servidor, restringir ao dono e
   impedir nomes duplicados.
2. **SKU e catálogo:** manter o SKU técnico gerado para preservar links existentes,
   sem exigir código da loja. Sem preço de atacado, mostrar só “Falta preço de
   atacado”, sem controle redundante para publicar. Conferir a regra também na ação
   de servidor; cada variação pode ter preço de atacado diferente.
3. **Fluxo único em Estoque:** retirar o formulário de troca de Vendas, preservando
   nela o histórico. Substituir o formulário atual de Estoque por botão **Realizar
   troca**, com **Reembolso** e **Trocar por outra peça**. Manter “Lançar entrada”
   para reposição comum. Selecionar venda e item, mostrar prazo e quantidade ainda
   elegível, exigir motivo e confirmar somente como dono.
4. **Trocar por outra peça:** aceitar só item cadastrado; escolher a variação que
   volta e a que sai. Uma RPC transacional vincula a venda ao atendimento e cria
   entrada/saída em `estoque_movimentos`, com trava de saldo e idempotência. Não
   retirar valor do faturamento. A decisão de repor a peça é explícita do dono;
   peça sem condição de revenda não pode inflar o saldo vendável.
5. **Reembolso:** aceitar item cadastrado ou avulso; avulso não entra em estoque
   nem pode ser usado na troca por peça. Registrar valor em centavos, venda/item,
   motivo, data e operador. Não reescrever o total histórico da venda: mostrar
   bruto, reembolso e líquido, abatendo no dia do reembolso. Limitar pelo valor
   ainda não devolvido e tratar desconto/frete. Em produto cadastrado, entrada em
   estoque apenas por decisão explícita do dono.
6. **Banco/publicação:** migração aditiva em `supabase/migracoes/`, aplicada antes
   do deploy. Preservar as RPCs/views antigas durante a transição; criar vínculos,
   RLS e RPCs novas, atualizar relatórios de faturamento e Painel sem expor dados
   de outro vendedor, regenerar `src/lib/supabase/types.ts`.
7. **Vendedor e visual:** priorizar o que ele vendeu e o total; esconder análises
   gerenciais. Comissão depende de regra comercial. Conferir logo no login,
   sistema e catálogo em desktop e celular.

**Aceite:** criar categoria sem perder o formulário; sem atacado não há botão de
publicação; cadastro sem SKU manual e link do pedido funcionando; reembolso de
avulso reduz o líquido sem movimento de estoque; troca de peça move entrada e
saída sem abatimento financeiro; duplo envio não duplica; saldo insuficiente
não gera registro parcial; vendedor vê apenas os próprios dados. Verificar com
`npm run lint`, `npm run build` e testes autenticados numa base segura.
**O `.env.local` aponta para a produção; não criar/apagar dados reais para testar.**

**Decisões confirmadas pelo cliente:** numa devolução parcial, o reembolso abate
**somente as peças devolvidas**, nunca a venda inteira. Produto cadastrado
reembolsado **só volta ao estoque se o dono confirmar que a peça pode ser
revendida**; sem essa confirmação, não há movimento de entrada. Item avulso
jamais movimenta estoque.

**Regra financeira confirmada pelo cliente:** ratear o desconto
proporcionalmente ao valor dos itens devolvidos; em devolução parcial, não
reembolsar frete. Se toda a venda for devolvida, incluir o frete no reembolso.
O cálculo em centavos ainda precisa definir arredondamento determinístico,
sem ultrapassar o valor originalmente pago.

**Verificação local desta rodada:** `npm run lint`, `npx tsc --noEmit` e
`npm run build` passaram. Não houve teste autenticado de gravação porque o
ambiente local aponta para a base de produção.

# Como reportar

Para cada problema: **qual tela**, **o que você fez**, **o que esperava**, **o que
aconteceu**. Se aparecer mensagem de erro, copie o texto dela.
