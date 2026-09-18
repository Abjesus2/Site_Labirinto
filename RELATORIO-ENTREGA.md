# Labirinto — Editor de Fluxogramas • Relatório de entrega

Documento de passagem do projeto. Cobre o estado atual, o que foi construído, por que cada decisão foi tomada, o que está testado e o que falta.

---

## 1. O que é

Editor de fluxogramas em React + React Flow, com geração por IA, controle de tempos (Value Stream Mapping), múltiplas versões do mesmo processo e exportação em vários formatos.

**Restrição central:** o produto final é **um único arquivo `index.html`** (~2,4 MB), com todo o JavaScript, CSS e ícones embutidos. Nenhum arquivo externo, nenhuma CDN, nenhum servidor. Isso existe porque o app precisa ser publicado dentro do Google Sites, que só aceita um trecho de HTML incorporado.

Consequências dessa restrição que valem para qualquer mudança futura:

- **Sem backend.** Tudo o que precisar de servidor tem de ser resolvido no navegador ou sair do escopo.
- **Sem dependência externa em runtime.** Nada de `<script src>` apontando para CDN, nada de fonte do Google, nada de imagem hospedada. Uma imagem externa numa barra de ferramentas já quebrou o offline uma vez (ver §5.6).
- **Tudo precisa funcionar dentro de um iframe de terceiros**, onde o navegador restringe pop-up, download, área de transferência e armazenamento.

---

## 2. Como rodar

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # gera dist/index.html — o arquivo único que é o produto
npm test         # build + 5 suítes de teste (96 verificações)
```

Publicação: hospedar `dist/index.html` (Netlify Drop, GitHub Pages, Cloudflare Pages, Render) e incorporar a URL no Google Sites via **Páginas → Incorporação de página inteira → Por URL**, ou via **Inserir → Incorporar → Código de incorporação** com um `<iframe>`. O arquivo tem de se chamar `index.html` e ficar na raiz da pasta publicada.

### Configuração do build

`vite.config.ts` usa `vite-plugin-singlefile` com `cssCodeSplit: false`, `assetsInlineLimit` altíssimo e `inlineDynamicImports: true`. Qualquer mudança que gere um segundo arquivo em `dist/` quebra o produto — o build precisa sempre terminar com um `index.html` sozinho.

---

## 3. Mapa dos arquivos

### Criados neste trabalho (`src/lib/`)

| Arquivo | Linhas | Papel |
|---|---|---|
| `embedCompat.ts` | 536 | Camada de compatibilidade para rodar embutido: avisos internos, downloads com alternativa, clipboard com três níveis de recuo, modal de texto, proteção de impressão e de armazenamento |
| `aiProviders.ts` | 886 | Registro dos 9 provedores de IA, montagem das requisições por tipo de API, leitura do streaming, armazenamento e backup cifrado das chaves |
| `aiSettingsUI.ts` | 568 | Janela "Configurar IA" em DOM puro (lista de provedores, chaves, teste de conexão, backup) |
| `aiBrowserBridge.ts` | 297 | Intercepta `/api/generate-diagram` e roteia para o provedor ativo, com cadeia de alternativas |
| `flowClipboard.ts` | 223 | Copiar/colar fluxos entre diagramas (clipboard do sistema + localStorage + memória) |
| `labelPlacement.ts` | 211 | Posição do rótulo da linha, desviando de formas e selos de tempo |
| `spreadsheet.ts` | 135 | Leitura de `.xlsx` no navegador, sem biblioteca de planilha |

Os quatro últimos são **módulos puros** (sem React) de propósito: assim têm teste isolado, sem montar o editor.

### Criados em `src/components/`

- `ImportFlowModal.tsx` (251) — "Trazer fluxo de outro arquivo": diagramas salvos, arquivo `.json` ou texto colado.
- `ShareModal.tsx` (141) — reescrito: compartilhamento por arquivo, sem nuvem.

### Arquivos grandes do app original (mexidos, não escritos do zero)

- `FlowEditor.tsx` (4526) — o editor inteiro. Concentra estado, atalhos, menus e modais.
- `CustomNodes.tsx` (1463) — todas as formas.
- `AdjustableEdge.tsx` (769) — a linha e suas alças de ajuste.
- `src/utils/` — geometria ortogonal, roteamento, snap, sanitização de grafo, manual do sistema.

### Removidos

`firebase.ts`, `sync.ts`, `googleDrive.ts`, `cloudProviders.ts`, `server.ts` (backend Express antigo), `firestore.rules`, além de ~50 scripts `.cjs` de patch que vinham no ZIP original e não faziam parte do app.

---

## 4. Decisões de arquitetura

**IA no navegador, sem tocar no editor.** O app chamava `POST /api/generate-diagram` num backend Node. Em vez de reescrever a tela de geração, o `aiBrowserBridge` substitui `window.fetch` e intercepta essa URL, devolvendo o mesmo streaming JSONL que o editor já sabia ler. O `FlowEditor` continua achando que existe um servidor. Isso mantém a superfície de mudança pequena e permite trocar de provedor de IA sem mexer em UI.

**Prompt idêntico ao do servidor.** O texto que o Express montava foi copiado letra por letra para o bridge (e depois estendido). Se o prompt for alterado, vale conferir se as regras de tempo total, conectividade e formas continuam íntegras — o editor depende delas para montar o grafo.

**Compatibilidade em vez de degradação.** Onde o navegador bloqueia algo dentro do iframe, existe um caminho alternativo, não um recurso a menos: download vira link clicável, clipboard cai para `execCommand`, `alert` vira aviso interno, `localStorage` cai para memória com aviso.

**Janelas do sistema estão proibidas.** Nada de `alert`, `confirm` ou `prompt` do navegador — eles são ignorados em iframes sem `allow-modals` e, fora do iframe, mostram "Esta página diz". Use `showToast` e `askText` de `embedCompat`.

**Módulos puros para lógica testável.** Geometria e parsing ficam fora do React para poderem ser testados com `node` direto, sem jsdom.

---

## 5. O que foi feito, por área

### 5.1 Empacotamento em arquivo único

Projeto React + Vite com 40+ arquivos virou um `index.html`. `vite-plugin-singlefile`, CSS sem divisão, importações dinâmicas embutidas. Dependências enxugadas para o que o front realmente usa.

### 5.2 Camada de compatibilidade (`embedCompat.ts`)

- **Downloads:** tenta o nativo e sempre oferece um link "Baixar" que abre em nova aba. Cobre os dois jeitos que o código dispara download — `a.click()` e `MouseEvent` (caminho do jsPDF). `URL.revokeObjectURL` foi adiado em 2 minutos porque o código original invalidava a URL antes de o link alternativo poder ser usado.
- **Clipboard:** `navigator.clipboard` → `execCommand('copy')` → caixa com o texto selecionado.
- **Avisos:** `window.alert` substituído em qualquer contexto por aviso interno; mensagens que citam "Configurar IA" ganham botão que abre a janela (via `setAlertActionResolver`).
- **Armazenamento:** se `localStorage` lança exceção, entra um substituto em memória e o usuário é avisado de que nada será salvo.
- **Impressão** protegida, com alternativa de abrir em tela cheia.
- **Atalho "Abrir em tela cheia"** aparece só quando o app está embutido.

### 5.3 IA multi-provedor

Nove provedores: Gratuito (Pollinations, sem chave), Pollinations com conta, Google Gemini, OpenAI, Anthropic, DeepSeek, OpenRouter, GitHub Models (o caminho oficial do Copilot) e endpoint personalizado compatível com OpenAI.

- Três formatos de API tratados: `openai`, `gemini`, `anthropic`, mais `text` (resposta em texto puro do endpoint simples da Pollinations).
- Streaming traduzido para o JSONL que o editor consome; se o provedor recusar streaming, refaz sem.
- **Cadeia de alternativas:** o modo gratuito tenta 4 caminhos (modelos `openai`, `openai-fast`, `mistral` e endpoint simples) antes de desistir. Isso nasceu de um erro real: a Pollinations depreciou a API antiga e passou a devolver 402/500.
- **Erros legíveis:** 401/403 vira "chave recusada", 402 "conta sem crédito", 429 "limite atingido", 404 no gratuito vira "o serviço saiu do ar". Detalhe técnico cortado em 140 caracteres.
- **Chaves:** várias ao mesmo tempo no `localStorage`, com teste de conexão por provedor e passo a passo de como obter cada uma dentro da própria janela.
- **Backup:** exportar para `.json` cifrado (AES-256-GCM, PBKDF2 250 mil iterações) ou em texto puro, importar de volta, e gerar um bloco `window.__AI_CONFIG__` para colar no `index.html` e distribuir o app já configurado.
- **Regra do losango** fixada no prompt: todo nó `decision` sai com no mínimo duas arestas rotuladas, "Sim"/"Não" como par padrão, texto em forma de pergunta fechada, sem pontas soltas.
- **Anexos:** `.txt`, `.csv`, `.pdf`, `.docx`, `.xlsx` e imagens. `.docx` via mammoth, `.xlsx` via `spreadsheet.ts`, PDF e imagem enviados como binário para os provedores que suportam.

### 5.4 Remoção de nuvem e contas

Saíram, nesta ordem e a pedido: login Google + Drive; depois OneDrive + login Microsoft (não funcionava). Hoje o app **não faz nenhuma chamada de autenticação** ao abrir e não depende do Firebase. Dados saem pelo `.json` (exportar/importar), pelo Compartilhar e pelo copiar/colar entre diagramas.

### 5.5 Copiar e colar fluxos entre arquivos

- **Ctrl+C / Ctrl+X / Ctrl+V** — copia a seleção (ou a versão inteira, se nada estiver selecionado). O recorte é gravado na área de transferência do sistema, no `localStorage` e em memória.
- A colagem **não usa `clipboard.readText`** de propósito: essa API faz o navegador pedir a permissão "ver texto e imagens copiados". O conteúdo vindo de fora chega pelo evento `paste`, que não exige permissão; o recorte do próprio app vem do `localStorage`. Se o evento não chegar em 250 ms, há um recuo automático.
- **Trazer fluxo de outro arquivo** (menu Exportar) — diagramas salvos, arquivo `.json` ou texto colado, com escolha de versão e de adicionar/substituir.
- Toda colagem gera IDs novos e posiciona o bloco ao lado do conteúdo existente.

### 5.6 Correções no editor

| Problema | Causa | Correção |
|---|---|---|
| Abas simples/normal/detalhado não apareciam | só eram listadas as versões já existentes; um diagrama novo só tinha `normal` | as três ficam sempre visíveis e a versão vazia é criada ao clicar |
| Quadrado colorido no meio das formas ao redimensionar | o tamanho era gravado em `data.styleOverride`, e as formas espalhavam esse objeto inteiro no estilo do rótulo | tamanho vai para `node.style`; `pickTextStyle` e `pickBoxStyle` separam o que vai para texto e para caixa (6 rótulos e 17 caixas ajustados) |
| Copiar/colar estilo redimensionava a forma de destino | o estilo copiado levava largura/altura | filtrado com `pickBoxStyle` |
| Menu "Guardar como" dizia "salvo" sem salvar | destinos de nuvem só mostravam sucesso | destinos reais encaminhados; GitHub (sem integração) baixa o arquivo avisando |
| Ícone do OneDrive vinha da Wikipédia | `<img src>` externo | SVG embutido (e depois o botão foi removido) |
| Texto da seta cobria forma ou selo de tempo | o rótulo nascia no meio do caminho sem verificar o que havia ali | `labelPlacement.ts`: desliza pela própria linha até um trecho livre; se o caminho todo estiver ocupado, afasta perpendicular |
| Ajuste das linhas voltava sozinho ao soltar | qualquer rota encostando numa forma era rejeitada — e rotas geradas por IA já nascem cruzando formas | se a rota de partida já colidia, a colisão não veta mais o arraste; só desfaz quando o traçado fica estruturalmente quebrado |
| Alças de ajuste não apareciam | limite de 15 px e só nos traçados Suave/Angular | limite de 8 px; Curva e Reta ganham alças sobre a rota equivalente e convertem para Suave ao arrastar, com aviso |

---

## 6. Testes

```bash
npm test
```

96 verificações, cinco suítes:

| Suíte | Verificações | O que cobre |
|---|---|---|
| `tests/app.mjs` | 69 | App inteiro em jsdom: renderização, painel, editor, versões, exportações, compartilhar, janela de IA, chaves, geração com cada formato de API, copiar/colar fluxos, redimensionamento, avisos internos |
| `tests/app.mjs --embedded` | 69 | As mesmas, com o app forçado a se achar dentro de iframe |
| `tests/labels.mjs` | 12 | Posição do rótulo da linha |
| `tests/spreadsheet.mjs` | 9 | Leitura de `.xlsx` (monta um arquivo real com jszip) |
| `tests/edges.mjs` | 6 | Geometria do arraste de trechos da linha |

O `tests/app.mjs` executa o **arquivo final `dist/index.html`**, não o código-fonte. Ele converte o `<script type="module">` para script clássico (jsdom não executa módulos) e injeta os polyfills que faltam (`ResizeObserver`, `fetch`, `ReadableStream`). Ao mexer no HTML de entrada, confira se essa conversão continua funcionando.

**O que os testes não cobrem** (precisa de navegador real):

- Arrastar de verdade nós e linhas (só a geometria pura é testada).
- Exportar PNG/SVG/PDF (dependem de canvas).
- Uma geração de IA completa com chave válida — use o botão **Testar conexão** de cada provedor.
- Aparência e layout.

---

## 7. Limitações conhecidas e riscos

- **Provedor gratuito é instável.** Serviço público de terceiros, com cota por IP e API que já mudou uma vez. A cadeia de alternativas ameniza, mas o caminho estável sem custo é a chave gratuita do Google Gemini.
- **Chave de IA no navegador.** Inerente ao modelo sem servidor. Quem precisar de chave que nunca chegue ao cliente vai precisar de um proxy — e isso quebra a premissa do arquivo único.
- **CORS por provedor.** DeepSeek e GitHub Models podem ser barrados pelo navegador. O teste de conexão detecta e a mensagem sugere OpenRouter, que foi feito para uso em página web.
- **Dentro do iframe**, pop-up e download continuam sujeitos ao navegador; por isso o botão "Abrir em tela cheia".
- **`FlowEditor.tsx` tem 4526 linhas.** Qualquer alteração ali pede atenção: estado, atalhos, menus e modais convivem no mesmo arquivo. Vale quebrar em partes antes de crescer mais.
- **Sem checagem de tipos no build.** O Vite usa esbuild, que não faz type-check. `typescript` não está nas dependências. Adicionar `tsc --noEmit` num script é um ganho barato.
- **`.xls` antigo** (binário) não é lido; o app orienta a salvar como `.xlsx` ou `.csv`.
- **Tamanho do arquivo:** 2,4 MB. Cada dependência nova entra inteira no produto.

---

## 8. Sugestões de próximos passos

1. **Type-check no CI:** adicionar `typescript` e um script `typecheck`.
2. **Quebrar o `FlowEditor.tsx`** em módulos por responsabilidade (atalhos, exportações, modais, estado do diagrama).
3. **Undo/redo do ajuste de linhas:** hoje o arraste entra no histórico, mas vale revisar granularidade.
4. **Validador de grafo pós-geração:** checar na prática a regra do losango (decisão com uma saída só) e avisar o usuário, já que hoje ela é só instrução de prompt.
5. **Teste em navegador real** (Playwright) para cobrir arraste, exportação de imagem e a geração completa.
6. **Compressão do entregável:** servir o `index.html` com gzip/brotli no host reduz de 2,4 MB para cerca de 700 KB na rede.

---

## 9. Convenções adotadas

- Interface, mensagens e comentários novos em **português do Brasil**.
- Comentário explica **por que**, não o que — especialmente onde a escolha parece estranha sem contexto (ex.: por que não usamos `clipboard.readText`).
- Nenhuma dependência externa em runtime.
- Nenhuma janela nativa do navegador.
- Toda correção de bug ganha verificação automatizada na suíte correspondente.
