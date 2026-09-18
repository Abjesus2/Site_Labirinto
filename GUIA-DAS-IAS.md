# Guia das IAs — como escolher e onde pegar cada chave

No app, clique em **Configurar IA** (canto superior direito do painel, ou dentro do assistente de IA). A janela lista todos os provedores, guarda **várias chaves ao mesmo tempo** no seu navegador e tem um botão **Testar conexão** para conferir antes de gerar qualquer fluxograma.

As chaves ficam só no seu navegador (armazenamento local) e são enviadas apenas para o serviço que você escolheu. Nenhum servidor intermediário.

## Começar sem cadastrar nada

**Gratuito (Pollinations)** já vem selecionado: é um serviço público e aberto que aceita uso anônimo. Basta abrir o app e gerar.

Ele é comunitário, com cota compartilhada por IP, e essa cota **acaba** em horários de pico — foi o erro 402/500 que apareceu no seu teste. Por isso o app agora tenta sozinho, em sequência, quatro caminhos gratuitos (modelos `openai`, `openai-fast` e `mistral`, e o endpoint simples da Pollinations) antes de desistir. Se todos falharem, aparece um aviso com o botão **Configurar IA** para trocar de provedor em um clique — nada de mensagem de erro em JSON.

Outra ressalva honesta: o texto do prompt sai do navegador para os servidores da Pollinations. Para processo interno sensível, use um provedor com chave própria.

## Pollinations com conta — gratuito, com cadastro rápido

Se o modo anônimo estiver sempre sem cota, esta é a saída mais próxima do "de graça":

1. Abra `https://enter.pollinations.ai` e crie a conta (login com GitHub ou e-mail).
2. Vá em **Keys** e gere uma chave. Para uso no navegador, escolha a **publicável (pk_)**.
3. Cole no app: o endereço já vem preenchido com o serviço novo (`gen.pollinations.ai`).

A conta ganha cota gratuita de Pollen, bem maior que a do modo anônimo. A chave publicável fica visível no código da página e consome a cota da sua conta, então não a use num site de tráfego alto.

**Alternativa igualmente gratuita e mais estável:** o Google Gemini, logo abaixo — o plano gratuito do AI Studio costuma bastar para este editor.

## Google Gemini — melhor custo-benefício com plano gratuito

1. Abra `https://aistudio.google.com/apikey` e entre com uma conta Google.
2. Clique em **Create API key**.
3. Escolha um projeto (ou deixe criar um novo) e confirme.
4. Copie a chave que começa com `AIza` e cole no campo do provedor.

O nível gratuito do AI Studio costuma bastar para o uso normal do editor. É o único, junto do Claude, que lê PDF anexado.

## OpenAI (ChatGPT)

1. Abra `https://platform.openai.com/api-keys` — é a conta de desenvolvedor da OpenAI, não a assinatura do ChatGPT Plus.
2. **Create new secret key**, dê um nome e confirme.
3. Copie a chave `sk-...` (ela aparece uma única vez) e cole no app.
4. Em **Settings → Billing**, adicione crédito: a API é cobrada por uso e é separada do ChatGPT Plus.

Modelo sugerido: `gpt-4o-mini` (barato e rápido para esse tipo de tarefa).

## Anthropic (Claude)

1. Abra `https://console.anthropic.com`, crie ou acesse sua conta.
2. **Settings → API keys → Create key**.
3. Copie a chave `sk-ant-...` e cole no app.
4. Adicione crédito em **Billing** — a assinatura do Claude.ai não vale para a API.

A chamada usa o cabeçalho oficial da Anthropic para acesso direto do navegador, então funciona sem servidor.

## DeepSeek

1. Abra `https://platform.deepseek.com` e crie a conta.
2. **API keys → Create new API key**.
3. Copie e cole no app.
4. Adicione crédito em **Top up** — os valores são bem baixos.

Se o navegador bloquear a chamada (erro de CORS no teste de conexão), use o DeepSeek através do OpenRouter.

## OpenRouter — uma chave para todas as IAs

É a opção mais confiável dentro do navegador, porque o OpenRouter foi feito para ser chamado direto de páginas web. Com uma única chave você usa GPT, Claude, Gemini, DeepSeek e Grok — inclusive modelos gratuitos.

1. Abra `https://openrouter.ai` e crie a conta (login com Google ou GitHub).
2. **Keys → Create Key**, copie a chave `sk-or-...`.
3. No campo **Modelo**, escolha um da lista. Os terminados em `:free` não consomem crédito, por exemplo `deepseek/deepseek-chat-v3.1:free`.

## GitHub Models (o caminho do Copilot)

O Copilot do editor de código não tem API pública para uso externo. O caminho oficial da Microsoft/GitHub é o **GitHub Models**, que dá cota gratuita.

1. Abra `https://github.com/settings/personal-access-tokens` → **Generate new token** (fine-grained).
2. Em **Permissions**, marque **Models: Read**. Nada além disso.
3. Gere, copie o token (`github_pat_...`) e cole no app.

Alguns navegadores bloqueiam a chamada direta ao GitHub por política de origem. Se o teste de conexão falhar por rede, use o OpenRouter.

## Outro serviço compatível com OpenAI

Serve para Groq, Together, Mistral, Ollama rodando no seu computador, LM Studio ou qualquer API no formato `/chat/completions`. Informe o endpoint completo, o nome exato do modelo e a chave (deixe vazia se o serviço não exigir, como no Ollama local).

## Guardar as chaves sem colar de novo

As chaves já ficam salvas no navegador, mas isso se perde ao trocar de computador, usar outro navegador ou limpar os dados. Dentro de **Configurar IA** há a seção **Backup das chaves** com quatro botões.

**Exportar com senha (recomendado).** Gera um `.json` cifrado com AES-256-GCM e uma senha derivada por PBKDF2 (250 mil iterações). O arquivo pode ficar no seu Drive, no OneDrive, num pendrive ou no e-mail: sem a senha ele não abre — nem por você, então anote a senha. Na importação o app pede a senha automaticamente.

**Exportar sem senha.** Mesmo arquivo, com as chaves em texto puro. Só use em pasta local sua; qualquer pessoa que abrir o arquivo lê as chaves.

**Importar arquivo.** Escolha o `.json` e as chaves voltam. A importação é somada ao que já existe: chaves de provedores que não estão no arquivo continuam intactas.

**Copiar bloco para o index.html.** Copia um `<script>window.__AI_CONFIG__ = {...}</script>` para colar dentro do `<head>` do arquivo. Aí a cópia publicada já abre configurada e ninguém precisa cadastrar nada — bom para a equipe. Em compensação, a chave fica visível no código-fonte da página, então use só com chave restrita por HTTP referrer (no Google Cloud Console, para o Gemini) ou com chave de cota limitada.

Também dá para fazer isso pelo console do navegador: `LabirintoAI.exportKeys('senha')` e `LabirintoAI.importKeys(texto, 'senha')`.

### Qual dessas usar

| Situação | Melhor opção |
|---|---|
| Só você, em um computador | Deixe como está; o navegador já guarda. Exporte com senha de vez em quando, como backup |
| Você em vários computadores | Exportar com senha e guardar o arquivo na sua nuvem |
| Equipe usando o site publicado | Bloco no `index.html`, com chave restrita por referrer |
| Empresa, com chave que não pode vazar | Nesse caso o certo é um pequeno servidor guardando a chave e repassando as chamadas — foge do arquivo único, mas é o único jeito de a chave nunca chegar ao navegador |

## Qual escolher

| Situação | Escolha |
|---|---|
| Quero testar agora, sem cadastro | Gratuito (Pollinations) — pode ficar sem cota |
| O modo gratuito falhou e quero continuar sem pagar | Google Gemini (plano gratuito) ou Pollinations com conta |
| Quero qualidade boa sem pagar | Google Gemini (plano gratuito) |
| Quero uma chave só para tudo, e que funcione no navegador | OpenRouter |
| Vou anexar PDF | Gemini ou Claude |
| Já tenho conta paga da OpenAI/Anthropic/DeepSeek | O provedor correspondente |
| Uso corporativo com GitHub | GitHub Models |

## Se o teste de conexão falhar

- **404 no modo gratuito** — o endereço ou o modelo do serviço público saiu do ar. Como isso muda sem aviso, use Gemini (grátis) ou Pollinations com conta.
- **402/500 no modo gratuito** — a cota pública acabou. O app já tenta outros modelos sozinho; se insistir, use Gemini (grátis) ou Pollinations com conta.
- **401/403** — chave errada, expirada ou sem crédito. Confira e gere outra.
- **429** — limite atingido. Espere alguns minutos ou troque de provedor.
- **404** — nome do modelo incorreto para aquele serviço.
- **"o navegador bloqueou a chamada (CORS)"** — o serviço não permite chamadas diretas de página web. Use OpenRouter, Gemini ou o modo gratuito.
