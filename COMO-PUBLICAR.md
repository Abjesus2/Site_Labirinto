# Labirinto — arquivo único, sem Google, com IA à sua escolha

O ZIP novo (React + Vite, 40+ arquivos, mais o backend Node) virou **um `index.html` de 2,4 MB** com JavaScript, CSS e ícones embutidos. Nenhum arquivo externo, nenhuma CDN, nenhum servidor.

## 1. O que mudou nesta versão

**Escolha da IA (novo).** Botão **Configurar IA** no cabeçalho do painel e dentro do assistente de IA. Você cadastra quantas chaves quiser, testa a conexão antes de gerar e alterna entre provedores quando precisar. Tudo fica salvo no seu navegador. Provedores: modo gratuito sem chave, Google Gemini, OpenAI (ChatGPT), Anthropic (Claude), DeepSeek, OpenRouter, GitHub Models (o caminho oficial do Copilot) e endpoint personalizado compatível com OpenAI. O passo a passo de cada chave está dentro da própria janela e no arquivo `GUIA-DAS-IAS.md`.

**IA gratuita sem cadastro (novo).** O provedor padrão é o Pollinations, serviço público que aceita uso anônimo. Como a cota pública acaba em horários de pico, o modo gratuito tenta quatro caminhos em sequência (modelos `openai`, `openai-fast`, `mistral` e o endpoint simples) antes de desistir. Se todos falharem, aparece um aviso curto com o botão **Configurar IA** para trocar de provedor num clique — sem mensagem de erro em JSON. Há também o provedor **Pollinations com conta**, que dá cota gratuita maior com um cadastro rápido.

**Ajuste das linhas consertado (corrigido).** Duas causas separadas. A primeira: ao soltar a alça, o traçado passava por uma validação que rejeitava qualquer rota encostando numa forma — e como diagramas densos (principalmente os gerados por IA) já nascem com linhas cruzando formas, toda tentativa era rejeitada e a linha voltava sozinha ao lugar. Agora, se a rota de partida já colidia, a colisão não veta mais o arraste: quem manda é você. O arraste só é desfeito quando o traçado fica estruturalmente quebrado (menos de dois pontos ou trecho fora do eixo). Em rotas limpas o freio continua: o trecho para na borda do obstáculo, sem entrar nele.

A segunda: as alças só existiam em trechos com mais de 15px e apenas nos traçados Suave e Angular. O limite caiu para 8px, e os traçados **Curva** e **Reta** — que não têm trechos ortogonais — passaram a mostrar alças calculadas sobre a rota equivalente; ao arrastar, a linha vira Suave (o formato ajustável) com um aviso explicando. Durante o arraste o desenho já aparece no formato final.

**Excel na IA (novo).** O anexo do assistente passou a aceitar `.xlsx` e `.csv`, além de `.txt`, `.pdf`, `.docx` e imagens. A planilha é lida no próprio navegador (o `.xlsx` é um zip de XMLs, então basta o leitor de zip que já vinha no pacote) e vira texto tabulado com o nome de cada aba, preservando colunas vazias. Limite de 300 linhas por aba e 24 mil caracteres, para não estourar o prompt. O `.xls` antigo (binário) não é lido: o app avisa para salvar como `.xlsx` ou `.csv`.

**Losango sempre com duas saídas (novo).** Regra fixada no prompt de todos os provedores: todo nó de decisão sai com no mínimo duas arestas rotuladas, sendo "Sim" e "Não" o par padrão, trocado por outro par só quando a pergunta pedir (Aprovado/Reprovado, Conforme/Divergente). Os rótulos do mesmo losango precisam ser diferentes e cobrir todos os desfechos, o texto do losango precisa ser pergunta fechada terminando em "?", e nenhuma saída pode ficar solta. Se a pergunta tem um desfecho só, a instrução manda usar 'process' em vez de losango.

**Salvamento em nuvem removido (novo).** O envio ao OneDrive não funcionava de forma confiável e foi retirado por inteiro, junto com o login Microsoft que existia só para ele: saíram o botão "Salvar no OneDrive" da barra, a opção do menu Guardar como, o selo "Drive Vinculado" no painel, o botão Entrar do cabeçalho e os módulos `firebase.ts` e `sync.ts`. O app não depende mais do Firebase — o arquivo ficou 160 KB menor e não faz nenhuma chamada de autenticação ao abrir.

O lugar do recurso continua coberto: os fluxogramas ficam no navegador e saem de lá pelo **Exportar Backup (.json)**, pelo **Compartilhar**, e pelo **Trazer fluxo de outro arquivo** / Ctrl+C e Ctrl+V entre diagramas. Para guardar na nuvem, basta salvar o `.json` na pasta sincronizada do seu Drive ou OneDrive pelo próprio explorador de arquivos.

**Texto da seta cobrindo forma ou tempo (corrigido).** O rótulo da linha nascia no meio do caminho, sem saber o que havia ali: às vezes caía sobre o selo de tempo (que fica logo abaixo de cada forma), às vezes sobre o corpo da forma. Agora o editor monta a lista de áreas ocupadas — corpo das formas e selos de tempo, já considerando formas dentro de raias e quadros — e a etiqueta **desliza ao longo da própria linha** até um trecho livre, saindo do meio para os dois lados. Quando o caminho inteiro está ocupado (linhas curtas entre formas coladas), ela se afasta perpendicularmente à linha, para o lado livre, começando encostada e só se distanciando o necessário. Raias e quadros não contam como obstáculo, já que são fundos. Se nada estiver totalmente livre, fica onde sobrepõe menos, em vez de sumir. A lógica está em `src/lib/labelPlacement.ts`, módulo puro com 12 verificações próprias (`smokeLabel.mjs`).

**Formas deformadas ao redimensionar (corrigido).** O ajuste de tamanho gravava largura e altura dentro de `styleOverride`, o mesmo objeto que as formas espalhavam no estilo do rótulo. O texto virava um bloco do tamanho da forma e, quando havia cor de fundo escolhida, aparecia como um quadrado no meio — visível no losango, mas presente em todas as formas desenhadas em SVG (decisão, documento, preparação, entrada manual, operação manual, exibição). Agora o tamanho vai para o `style` do próprio nó, e cada destino recebe só o que lhe cabe: o rótulo recebe apenas propriedades de texto (`pickTextStyle`), a caixa recebe cores e bordas menos geometria (`pickBoxStyle`). Diagramas antigos, que já têm largura/altura gravadas no lugar errado, são filtrados na renderização — não é preciso refazer nada.

Na mesma auditoria: **Copiar estilo / Colar estilo** também levava o tamanho junto, redimensionando a forma de destino sem o usuário pedir. Agora leva só cores, bordas e fonte. E o campo de dimensões da barra lateral passou a ler o tamanho real do nó, não a cópia em `styleOverride`.

**Copiar fluxos entre arquivos (novo).** Três caminhos, do mais rápido ao mais amplo:

- **Ctrl+C / Ctrl+V** — copia a seleção (ou a versão inteira, se nada estiver selecionado) e cola em outro fluxograma. A colagem nunca pede a permissão "ver texto e imagens copiados": o conteúdo vindo de fora chega pelo evento nativo de colar, e o recorte do próprio app vem do armazenamento local. O recorte é gravado em três níveis: área de transferência do sistema (atravessa abas, janelas, navegadores e computadores), `localStorage` compartilhado (funciona mesmo quando o navegador nega o clipboard) e memória. **Ctrl+X** recorta. A colagem usa o evento nativo de colar do navegador, e não `clipboard.readText`, justamente para o navegador nunca exibir o pedido de permissão "Ver texto e imagens copiados"; se esse evento não chegar, o app cai sozinho para o recorte guardado internamente.
- **Menu Exportar → Trazer fluxo de outro arquivo** — janela com três origens: diagramas salvos neste navegador, arquivo `.json` de outro computador, ou texto colado. Mostra as versões de cada origem com a contagem de etapas e ligações, e você escolhe **Adicionar ao fluxo atual** ou **Substituir o fluxo atual**.
- **Menu Exportar → Copiar fluxo desta versão / Colar fluxo copiado** — os mesmos atalhos, para quem prefere mouse.

A colagem sempre gera IDs novos e posiciona o bloco ao lado do que já existe, então nada é sobrescrito nem fica empilhado. Cada colagem entra no histórico (Ctrl+Z desfaz) e o enquadramento se ajusta para mostrar o resultado.

**Lista de IAs mais enxuta (novo).** Na janela Configurar IA, clicar numa linha apenas seleciona aquela IA; os campos de endpoint, modelo e chave abrem no botão **Detalhes ▾** de cada linha e fecham no **Ocultar ▴**. Fechada, a linha mostra o nome, a etiqueta, o modelo em uso e o status da chave. A única exceção: quando a janela é aberta por um aviso de falta de chave, o provedor ativo já vem aberto.

**Avisos só dentro da página (novo).** As caixas "Esta página diz" do navegador foram eliminadas: `window.alert` é substituído por avisos internos em qualquer contexto — arquivo local, site hospedado ou iframe. Avisos que falam em trocar de IA já vêm com o botão **Configurar IA**, que abre a janela na hora. O app não usa `confirm` nem `prompt` do navegador; onde era preciso pedir texto (chave, senha do backup), existe janela própria.

**IA em uso à vista (novo).** O assistente de IA mostra, logo acima dos níveis de detalhe, uma faixa com o provedor selecionado e o modelo, com bolinha verde quando está pronto e âmbar quando falta chave, mais um botão **Trocar** que abre as configurações. A faixa se atualiza sozinha ao salvar uma troca.

**Backup das chaves (novo).** Dentro de Configurar IA: exportar para um arquivo `.json` (com senha, cifrado em AES-256-GCM, ou sem senha), importar de volta em outro navegador ou computador, e copiar um bloco `window.__AI_CONFIG__` para colar no `index.html` e distribuir o app já configurado. Detalhes e recomendação de uso no `GUIA-DAS-IAS.md`.

**Versões simples/normal/detalhado corrigidas.** Antes, as abas só apareciam depois que a IA criava cada versão — num diagrama novo só existia "normal", então não havia o que trocar. Agora as três ficam sempre visíveis e, ao clicar numa versão ainda vazia, ela é criada na hora para você desenhar à mão ou pedir para a IA gerar.

**Conexão com o Google removida.** Saíram o botão de login com Google, o pedido de permissão do Google Drive, a sincronização com o Drive e as opções "Google Drive" do menu Guardar como. Os módulos `googleDrive.ts` e `cloudProviders.ts` foram apagados do projeto.

**Compartilhar sem nuvem.** O botão Compartilhar dependia inteiramente do Drive. Agora ele baixa o arquivo `.json` do fluxograma, copia o conteúdo para a área de transferência ou copia o link do editor. Quem receber usa **Exportar → Importar Fluxograma (.json)** e continua a edição com todas as versões e tempos.

**Correções encontradas na auditoria do seu código:**

- O menu **Guardar como** mostrava "sucesso" para OneDrive e GitHub sem salvar nada. O OneDrive agora salva de fato, e o GitHub (que não tem integração no projeto) baixa o arquivo avisando que o commit é manual.
- O **OneDrive nunca funcionaria**: o código lia o token do Google. Agora o login Microsoft guarda o token certo e o envio usa esse token.
- O botão do OneDrive carregava o ícone de um **link externo da Wikipédia** — num arquivo único isso quebra offline. Virou SVG embutido.
- Havia um `\n` literal escapando no meio do JSX da barra de ferramentas. Removido junto com o bloco do Drive.

**Adaptações mantidas da versão anterior:** IA rodando no navegador em vez do backend Node; `.docx` convertido no navegador; downloads com link alternativo quando o iframe bloqueia; clipboard com três níveis de fallback; `alert`/`prompt` substituídos por avisos e janelas próprias; `localStorage` com queda para memória e aviso; impressão protegida; botão "Abrir em tela cheia" quando embutido.

## 2. Verificação automatizada

O arquivo compilado foi executado em navegador headless, nos modos normal e embutido em iframe. 56 verificações, todas passando, zero erros de console:

app monta e abre o editor · modo gratuito cai automaticamente para a alternativa quando a cota pública falha · erro final vira mensagem clara com botão "Configurar IA" que abre a janela · login Google ausente do HTML · botão Configurar IA presente · janela lista os 9 provedores com o passo a passo · chave cadastrada persiste no navegador · provedor ativo é gravado · Claude recebe `x-api-key` e o cabeçalho de acesso direto do navegador · streaming do Claude vira JSONL válido · modo gratuito não envia `Authorization` e devolve JSONL · o prompt original do servidor é preservado · as três versões aparecem no editor · a troca de versão funciona · exportar `.json`, `.drawio` e `.bpmn` baixa arquivo · no iframe cada exportação ganha link alternativo, fora dele não · compartilhamento sem nuvem e sem menção ao Drive · backup exporta e reimporta as chaves · arquivo com senha sai cifrado, senha errada é recusada e senha certa restaura · chaves embutidas no `index.html` são lidas na abertura · o assistente exibe o provedor e o modelo ativos e acompanha a troca · `alert` do navegador nunca é chamado e o aviso interno aparece com botão de ação · o erro informa quantas alternativas foram tentadas · selecionar uma IA não expande a linha, e o botão Detalhes/Ocultar abre e fecha os campos · trazer fluxo por texto colado insere as etapas no canvas · Ctrl+C grava o recorte com a origem · Ctrl+V cola sem repetir nenhum ID · o evento nativo de colar traz o fluxo · a área de transferência nunca é lida, então nenhum pedido de permissão aparece.

O que só dá para confirmar no navegador real: uma geração completa com chave válida de cada provedor (use o botão **Testar conexão**) e o login Microsoft, que depende do provedor estar habilitado no projeto Firebase.

## 3. Publicar no Google Sites

A caixa **Inserir → Incorporar → Código de incorporação** aceita só um trecho curto de HTML, e o Sites ainda o exibe dentro de um iframe. Um app de 2,5 MB não cabe ali — é limitação da caixa, não do seu código. O caminho é hospedar o arquivo e incorporar a URL; o que você cola no Sites tem menos de 300 caracteres.

**Hospedar (escolha uma):**

- **Netlify Drop** (`app.netlify.com/drop`): arraste a pasta com o `index.html`, URL na hora, sem cadastro complicado.
- **GitHub Pages**: suba o `index.html` num repositório público e ative Pages.
- **Cloudflare Pages** ou **Render** (Static Site): arraste a pasta ou conecte o repositório.
- **Firebase Hosting**, se preferir linha de comando: `firebase init hosting` com a pasta `public` e `firebase deploy`.

O arquivo precisa se chamar `index.html` e ficar na raiz da pasta publicada.

**Colocar no Sites:**

- **Página inteira (melhor para um editor):** aba **Páginas → + → Incorporação de página inteira → Por URL**.
- **Dentro de uma seção:** **Inserir → Incorporar → Código de incorporação** e cole o trecho do arquivo `snippet-google-sites.txt`, trocando a URL. Depois estique o bloco: o editor precisa de 800 px de altura ou mais.

## 4. Detalhes finais

- **Sem contas:** o app não pede login nenhum e não conversa com serviço de autenticação; só as chamadas à IA que você escolher saem do navegador.
- **O app funciona sem login nenhum.** Diagramas e pastas ficam no navegador; exporte o `.json` para guardar em definitivo.
- **Chave pré-configurada:** se quiser que todos usem a mesma chave do Gemini sem cadastrar nada, preencha `window.__GEMINI_API_KEY__ = "";` nas primeiras linhas do `<head>` do `index.html`. Ela fica visível no código-fonte da página — restrinja por HTTP referrer no Google Cloud Console.
- **Cache:** ao republicar, force `Ctrl+F5`.

## 5. Reconstruir depois de mexer no código

```bash
npm install
npx vite build      # gera dist/index.html, o arquivo único
```

Arquivos novos deste trabalho: `src/lib/spreadsheet.ts` (leitura de .xlsx), `src/lib/labelPlacement.ts` (posição dos rótulos), `src/lib/flowClipboard.ts` (recorte de fluxos), `src/components/ImportFlowModal.tsx` (trazer fluxo de outro arquivo), `src/lib/aiProviders.ts` (provedores, chaves e streaming), `src/lib/aiSettingsUI.ts` (janela Configurar IA), `src/lib/aiBrowserBridge.ts` (intercepta `/api/generate-diagram`) e `src/lib/embedCompat.ts` (compatibilidade em iframe), todos carregados por `src/main.tsx`.
