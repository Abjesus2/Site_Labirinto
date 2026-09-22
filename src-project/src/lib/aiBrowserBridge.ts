/**
 * PONTE DE IA NO NAVEGADOR
 * ------------------------
 * O app original chamava um backend Node em /api/generate-diagram.
 * Aqui a chamada é interceptada e enviada ao provedor de IA escolhido pelo
 * usuário (gratuito, Gemini, ChatGPT, Claude, DeepSeek, OpenRouter, GitHub
 * Models ou endpoint próprio), devolvendo o mesmo streaming JSONL de antes.
 */

import { setAlertActionResolver, showToast } from './embedCompat';
import { openAISettings } from './aiSettingsUI';
import {
  applyImportedConfig,
  buildRequest,
  exportKeyFile,
  parseKeyFile,
  describeHttpError,
  extractWholeText,
  getActiveProvider,
  isProviderReady,
  loadConfig,
  prepareFiles,
  ProviderAttempt,
  saveConfig,
  streamToText,
} from './aiProviders';

const ENDPOINT_PATH = '/api/generate-diagram';

/**
 * Prompt idêntico ao que o servidor Express montava. Exportado porque também
 * alimenta o modo "Gerar Manualmente com Outra IA" (o usuário copia este
 * texto e cola num chat de IA qualquer, em vez de cadastrar uma chave aqui).
 */
export const buildPrompt = (body: any): string => {
  const { prompt, complexities, existingVersions, appendMode, allowedShapeTypes, files, manualMode } = body || {};

  const compList = (complexities || ['normal']).join(', ');
  const allowedList =
    allowedShapeTypes && Array.isArray(allowedShapeTypes) && allowedShapeTypes.length > 0
      ? allowedShapeTypes
      : ['start', 'end', 'process', 'decision', 'document', 'database', 'inputoutput'];
  const allowedStr = allowedList.map((t: string) => `"${t}"`).join(', ');

  let contextStr = '';
  if (manualMode) {
    // Modo "Gerar Manualmente com Outra IA": este prompt é copiado e colado
    // num chat de IA qualquer. O app não sabe, no momento em que o prompt é
    // gerado, se a pessoa vai anexar um arquivo DIRETO naquele chat (sem
    // passar pelo app) — por isso o aviso abaixo cobre os três casos
    // possíveis em vez de assumir que "sem texto" significa "sem nada".
    contextStr =
      `CONTENT LOCATION NOTE: whatever the user wrote, if anything, is at the very end of this ` +
      `prompt, right after this note, under "User content:". There may be NO text at all there — ` +
      `in that case, the ONLY source of information is a file attached directly to this chat message, ` +
      `and you must analyze that file. There may also be BOTH a text description AND one or more ` +
      `attached files together — in that case use everything available (the text below plus any file ` +
      `attached to this message) to build the flowchart. Never refuse or ask for more input just because ` +
      `the text below is empty — check for an attached file first.\n\n`;
    contextStr += prompt ? `User content: ${prompt}` : `User content: (nenhum texto — veja o arquivo anexado a esta conversa, se houver)`;
    if (files && files.length > 0) {
      contextStr += `\n\nThe user also attached ${files.length} file(s) to this app before generating this prompt (they should attach the same file(s) directly here too). Analyze the text above together with any attached file(s).`;
    }
  } else if (prompt && files && files.length > 0) {
    contextStr = `User Prompt & Attached Files: ${prompt}\n\nIMPORTANT: The user has attached files alongside this prompt. You MUST analyze BOTH the text prompt and the file contents together. They complement each other to form the final flowchart.`;
  } else if (prompt) {
    contextStr = `User Prompt: ${prompt}`;
  } else if (files && files.length > 0) {
    contextStr = `The user did not provide a specific text prompt, but attached files. Analyze the attached files and extract a logical flowchart process from them.`;
  } else {
    contextStr = `User Prompt: Generate flowchart based on existing versions.`;
  }

  if (existingVersions && Object.keys(existingVersions).length > 0) {
    contextStr += `\n\nEXISTING VERSIONS PROVIDED BY USER:\n${JSON.stringify(
      existingVersions,
      null,
      2,
    )}\n\nUse this existing flowchart data as the definitive source of truth to generate the missing versions or improve the requested versions.`;
  }

  if (appendMode) {
    contextStr += `\n\nAPPEND MODE IS ON: The user wants to add new steps to the existing diagram without replacing it. YOU MUST USE GLOBALLY UNIQUE IDs for all new nodes and edges (e.g., prefixing with "new_" or a random string like "n_abc123") so they do not conflict with the existing IDs provided above.`;
  }

  return `Você é uma IA especialista em mapeamento de processos que gera fluxogramas profissionais em tempo real.
        Com base no conteúdo do usuário (texto, arquivos anexados e/ou versões existentes), gere as versões: [${compList}].
        Siga as boas práticas de mapeamento de processos (ISO 5807, BPMN 2.0, ANSI): caminho principal primeiro, depois as exceções; toda decisão com saídas rotuladas; retrabalhos e caminhos alternativos explícitos; passagens de bastão entre setores explícitas.

        ========================================================================
        0. FORMATO DE SAÍDA (CRITICAL)
        ========================================================================
        A saída DEVE ser estritamente JSON Lines (JSONL): cada linha é UM objeto JSON válido. NÃO escreva markdown (como \`\`\`json), títulos, explicações ou qualquer texto fora do JSON.

        0.1. ORDEM DE ESCRITA — OBRIGATÓRIA:
        - Escreva UMA versão de cada vez, na ordem: "simples", depois "normal", depois "detalhado" (só as que foram pedidas). O campo "version" tem que ser exatamente "simples", "normal" ou "detalhado", em minúsculas.
        - Dentro de cada versão, escreva cada nó e LOGO EM SEGUIDA todas as arestas que SAEM dele (a aresta pode apontar para o ID de um nó que você vai escrever nas próximas linhas). NUNCA deixe todas as arestas para o final: respostas longas são cortadas por limite de tamanho, e se as arestas estiverem no fim elas se perdem — o diagrama chega sem nenhuma ligação.
        - IDs únicos com prefixo por versão: "s1", "s2"... no simples; "n1", "n2"... no normal; "d1", "d2"... no detalhado. Uma aresta só pode ligar IDs da MESMA versão, e só IDs que você realmente escreve como nó.
        - Use "source" e "target" (não "from"/"to") nas arestas.

        0.2. EXEMPLO COMPLETO DE UMA VERSÃO BEM FEITA (processo com ramificações, convergência, dois finais e troca de setor):
        {"progress": 10}
        {"version": "normal", "node": {"id": "n1", "label": "Início do Recebimento de Mercadorias", "type": "start", "duration": 0}}
        {"version": "normal", "edge": {"id": "n1-n2", "source": "n1", "target": "n2"}}
        {"version": "normal", "node": {"id": "n2", "label": "Conferir Nota Fiscal com o Pedido de Compra", "type": "process", "duration": 10, "department": "Recebimento"}}
        {"version": "normal", "edge": {"id": "n2-n3", "source": "n2", "target": "n3"}}
        {"version": "normal", "node": {"id": "n3", "label": "Nota Fiscal Confere com o Pedido?", "type": "decision", "duration": 1, "department": "Recebimento"}}
        {"version": "normal", "edge": {"id": "n3-n4", "source": "n3", "target": "n4", "label": "Sim"}}
        {"version": "normal", "edge": {"id": "n3-n6", "source": "n3", "target": "n6", "label": "Não"}}
        {"version": "normal", "node": {"id": "n4", "label": "Descarregar e Contar os Volumes Recebidos", "type": "process", "duration": 30, "department": "Recebimento"}}
        {"version": "normal", "edge": {"id": "n4-n5", "source": "n4", "target": "n5"}}
        {"version": "normal", "node": {"id": "n5", "label": "Quantidade Física Bate com a Nota Fiscal?", "type": "decision", "duration": 2, "department": "Recebimento"}}
        {"version": "normal", "edge": {"id": "n5-n8", "source": "n5", "target": "n8", "label": "Sim"}}
        {"version": "normal", "edge": {"id": "n5-n6", "source": "n5", "target": "n6", "label": "Não"}}
        {"version": "normal", "node": {"id": "n6", "label": "Registrar Divergência e Acionar o Supervisor", "type": "process", "duration": 5, "department": "Recebimento"}}
        {"version": "normal", "edge": {"id": "n6-n7", "source": "n6", "target": "n7"}}
        {"version": "normal", "node": {"id": "n7", "label": "Supervisor Autoriza Receber com Divergência?", "type": "decision", "duration": 10, "department": "Supervisão"}}
        {"version": "normal", "edge": {"id": "n7-n8", "source": "n7", "target": "n8", "label": "Sim"}}
        {"version": "normal", "edge": {"id": "n7-n9", "source": "n7", "target": "n9", "label": "Não"}}
        {"version": "normal", "node": {"id": "n8", "label": "Dar Entrada da Mercadoria no Estoque pelo Sistema", "type": "process", "duration": 8, "department": "Estoque"}}
        {"version": "normal", "edge": {"id": "n8-n10", "source": "n8", "target": "n10"}}
        {"version": "normal", "node": {"id": "n9", "label": "Recusar Mercadoria e Notificar o Fornecedor", "type": "process", "duration": 15, "department": "Compras"}}
        {"version": "normal", "edge": {"id": "n9-n11", "source": "n9", "target": "n11"}}
        {"version": "normal", "node": {"id": "n10", "label": "Fim — Mercadoria Recebida", "type": "end", "duration": 0}}
        {"version": "normal", "node": {"id": "n11", "label": "Fim — Mercadoria Recusada", "type": "end", "duration": 0}}
        {"progress": 100}

        O que este exemplo ensina (repita esses padrões no seu fluxo):
        - Cada losango tem DUAS saídas rotuladas indo para lugares DIFERENTES — o fluxo se abre em ramos, não é uma fila reta.
        - Os dois "Não" (n3 e n5) CONVERGEM na mesma etapa de tratamento (n6); o "Sim" do supervisor CONVERGE de volta ao caminho principal (n8).
        - Há dois finais possíveis (recebida / recusada) — um processo real pode terminar de mais de um jeito.
        - A troca de setor (Recebimento → Supervisão → Estoque/Compras) aparece no campo "department".
        - Nenhuma aresta tem "isDubious": o texto de origem deixa cada ligação clara, então nenhuma é duvidosa (ver seção 5.1).
        - Campos opcionais do nó: "duration", "setupTime", "waitTime" (minutos), "department", e "notes" (só no 'detalhado'). Campo opcional da aresta: "label" (obrigatório nas saídas de losango) e "isDubious" (raríssimo).

        CRITICAL SHAPE RULE: o "type" de todo nó DEVE ser um dos tipos permitidos: [${allowedStr}]. Não invente tipos.

        CRITICAL DECISION RULE: todo nó 'decision' (losango de pergunta) SEMPRE sai com pelo menos duas arestas rotuladas, uma para cada desfecho — o par padrão é "Sim" e "Não". Nunca gere um losango com uma única saída.

        ========================================================================
        1. NÍVEIS DE DETALHE
        ========================================================================
        - 'simples' (visão executiva): 4 a 6 nós. Resumo do caminho principal e do objetivo. Pode ter 0 ou 1 decisão.
        - 'normal' (visão tática): 9 a 20 nós. OBRIGATÓRIO ter pelo menos 2 ou 3 decisões (se 'decision' for permitido), com ramos diferentes para exceções, pelo menos um retrabalho/volta quando o texto sugerir, e convergência de volta ao caminho principal.
        - 'detalhado' (visão operacional): PELO MENOS 16 nós, SEM TETO — continue decompondo até que toda ação, verificação, sistema, papel e regra citados (ou claramente implícitos) na fonte tenham o próprio nó. Como referência, espere cerca de 1 decisão a cada 4 a 6 etapas quando a fonte descreve verificações, conferências, escolhas ou exceções. Pare só quando não houver mais nada a extrair.

        1.1. MÁXIMO DE DETALHE NO 'detalhado' (CRITICAL — ESTE É O PEDIDO PRINCIPAL DO USUÁRIO):
        - A versão 'detalhado' precisa conter o MÁXIMO DE INFORMAÇÃO POSSÍVEL extraída do prompt e/ou dos arquivos — nada relevante pode ficar de fora.
        - Releia o prompt e cada arquivo e garanta que TODO fato concreto vire conteúdo no diagrama: sistemas/ferramentas, papéis responsáveis, critérios de aprovação/rejeição, prazos/SLAs, documentos de entrada e saída, regras de negócio, exceções, retrabalhos, validações e qualquer número citado.
        - Cada nó do 'detalhado' PODE (e deve, quando a fonte tiver informação) preencher "notes" com o contexto extra que não cabe no label (sistema usado, responsável, critério de decisão, entradas/saídas). Seja CURTO: 1 ou 2 frases, no máximo ~200 caracteres — "notes" longos estouram o tamanho da resposta e cortam as ligações do fim do diagrama.
        - Num losango, o "notes" deve trazer o critério exato da decisão (número, condição, documento) quando a fonte tiver.
        - Não repita a mesma informação genérica em vários "notes"; nunca invente.
        - As versões 'simples' e 'normal' não usam "notes".
        - IMPORTANTE: nada do que está nesta seção 1.1 substitui ou reduz a obrigação da seção 3.2 (setores/raias). Preencher "department" em cada nó continua igualmente obrigatório sempre que houver setor/área/equipe mencionado, mesmo com o 'detalhado' tendo muito mais nós — não deixe esse campo em branco só porque há mais coisa pra gerar.

        1.2. EXEMPLO OBRIGATÓRIO DE GRANULARIDADE (siga este padrão, não apenas o espírito dele):
        Um parágrafo de origem como este:
        "Após a organização dos volumes na esteira, o colaborador se desloca até o computador, acessa o sistema de recebimento e realiza a leitura individual de cada volume para gerar as etiquetas de Recebimento Agrupado. A cada volume bipado, o sistema gera a respectiva etiqueta, que é enviada para impressão. Após concluir as leituras, o colaborador recolhe as etiquetas impressas, identifica a caixa correspondente e aplica cada etiqueta no respectivo volume."

        ERRADO (muito raso, NUNCA em 'detalhado' nem em 'normal'): virar um único nó "Etiquetagem de Volumes" e passar direto pra próxima etapa.

        CERTO para 'detalhado' — cada ação atômica, incluindo o loop de retrabalho que o texto implica ("após concluir as leituras" = só depois de bipar TODOS; se faltar etiqueta em alguma caixa, volta e bipa/imprime de novo):
        1. "Acessar Computador para Bipar Volumes" (process)
        2. "Bipar Etiqueta de Cada Volume no Sistema" (process)
        3. "Recolher Etiquetas Impressas" (process)
        4. "Colar Etiquetas nas Caixas Correspondentes" (process)
        5. "Todas as Caixas Estão com Etiquetas Coladas?" (decision) → "Sim" segue pra próxima etapa do processo maior; "Não" volta pro passo 2, formando um loop até a resposta virar "Sim".

        CERTO para 'normal' — mesmo parágrafo, bem menos etapas:
        1. "Bipar Volumes para Imprimir Etiquetas" (process)
        2. "Colar Etiquetas nas Caixas" (process)
        3. "Todas as Etiquetas Estão Coladas?" (decision) → "Sim"/"Não" (loop de volta se "Não")

        Aplique este MESMO nível de decomposição a CADA parágrafo/trecho da fonte. Se um trecho descreve várias ações em sequência (faz X, depois Y, depois verifica Z), cada ação vira o próprio nó em 'detalhado'. Uma verificação implícita no texto ("após concluir todas as leituras", "confere se está tudo certo", "garante que X bateu com Y") quase sempre é uma pergunta/decisão que falta no diagrama — adicione o losango correspondente em vez de pular direto pra próxima etapa.

        ========================================================================
        2. FORMAS PERMITIDAS (ORDEM DO USUÁRIO)
        ========================================================================
        USE EXCLUSIVAMENTE estes tipos de nó: [${allowedStr}]
        - Se 'document', 'database' ou 'inputoutput' não estiverem na lista, use 'process' ou outro tipo permitido.
        - Se 'decision' não estiver na lista, use 'process' para as ramificações (mesmo assim com 2 saídas rotuladas).
        - Mesmo que "swimlane" ou "frame" estejam nesta lista, NÃO os utilize para gerar nós — veja a seção 3.2 sobre setores/departamentos.

        ========================================================================
        3. RAMIFICAÇÕES, CONVERGÊNCIAS E RETRABALHOS (CRITICAL — erro grave e recorrente)
        ========================================================================
        - Um fluxograma em LINHA RETA (cada nó com exatamente uma entrada e uma saída, do início ao fim) é ERRO GRAVE em 'normal' e 'detalhado'. Quase todo processo real tem ramificações: se o seu diagrama ficou uma fila única, você deixou de mapear as decisões e exceções da fonte — releia e corrija antes de escrever.
        - Monte primeiro o caminho principal (o "caminho feliz") e depois, para cada verificação, escolha ou problema possível, o caminho alternativo.
        - Viram LOSANGO (decision) as palavras e ideias da fonte como: "se", "caso", "quando", "senão", "verifica", "confere", "valida", "aprova", "está correto?", "tem estoque?", "há divergência?", "dentro do prazo?", "tipo A ou tipo B", "no 2º ou no 3º andar", "com ou sem avaria".
        - Cada saída de um losango leva a um lugar DIFERENTE. O caminho negativo/alternativo SEMPRE vai para algum destes: (a) uma etapa de correção seguida de VOLTA a uma etapa anterior (retrabalho/loop); (b) uma etapa específica de tratamento da exceção que depois CONVERGE de volta ao caminho principal; (c) um final alternativo (ex.: "Fim — Pedido Cancelado").
        - Escolhas entre alternativas (ex.: "Coleta Realizada no 2º ou 3º Andar?") geram UM RAMO PARA CADA alternativa, com a etapa específica de cada uma (ex.: saída "2º Andar" → "Levar Carrinho até a Gaiola"; saída "3º Andar" → "Conduzir Carrinho ao Buffer da Colmeia"), e depois os ramos CONVERGEM na etapa comum seguinte. Nunca coloque as etapas de alternativas diferentes uma atrás da outra na mesma fila.
        - Convergência: ramos que tratam cenários diferentes voltam a se juntar numa etapa comum posterior.
        - Toda aresta que sai de um losango TEM "label" com o desfecho (ex.: "Sim", "Não", "Aprovado", "Reprovado", "2º Andar", "3º Andar").

        3.1. REGRA OBRIGATÓRIA DO LOSANGO (DECISÃO) — NUNCA VIOLAR:
        - Todo nó do tipo 'decision' DEVE ter NO MÍNIMO 2 arestas de saída, para caminhos diferentes. Um losango com uma única saída é ERRO GRAVE: se a pergunta só tem um desfecho, ela não é decisão — use 'process'.
        - O par padrão é "Sim" e "Não". Troque por outro par só quando a pergunta pedir (ex.: "Aprovado"/"Reprovado", "Conforme"/"Divergente", "2º Andar"/"3º Andar").
        - Com três ou mais desfechos, rotule todos (ex.: "Sim", "Não", "Parcial").
        - Os rótulos das saídas do mesmo losango são diferentes entre si, mutuamente exclusivos e cobrem todos os desfechos.
        - O texto do losango é UMA pergunta fechada terminando com "?" (ex.: "Documentação Está Completa?"). Uma pergunta por losango.
        - Nenhuma saída fica solta: cada uma leva a uma etapa, a uma volta ou a um final.

        3.2. SETORES, ÁREAS OU DEPARTAMENTOS DIFERENTES (RAIAS E QUADROS) — CRITICAL:
        - Se o processo atravessa mais de um setor, departamento, equipe, sistema ou área física (ex.: "Recebimento" entrega para "Armazenagem", que entrega para "Expedição"), preencha o campo "department" de CADA nó com o nome curto de quem executa aquela etapa.
        - "department" é curto (2 a 4 palavras, ex.: "Vendas", "Financeiro", "Logística", "Cliente", "Sistema Externo") porque vira o título da raia/quadro desenhado ao redor das etapas daquele setor.
        - Use exatamente o MESMO texto em todas as etapas do mesmo setor (não misture "TI" com "Tecnologia da Informação").
        - O aplicativo desenha sozinho a raia ou o quadro ao redor de cada setor. Por isso você NUNCA deve gerar nós do tipo "swimlane" ou "frame".
        - Só se o processo inteiro acontece dentro de um único setor, deixe "department" vazio ("") em todos os nós.

        ========================================================================
        4. PRESERVAÇÃO DO TEMPO TOTAL
        ========================================================================
        - A SOMA de tempos (duration + setupTime + waitTime) de todos os nós de uma versão DEVE ser IDÊNTICA em 'simples', 'normal' e 'detalhado'.
        - Ao agrupar microetapas em 'normal' e 'simples', some os tempos individuais para que SOMA(simples) === SOMA(normal) === SOMA(detalhado).
        - Se estiver gerando a partir de versões existentes, preserve o tempo total delas.

        ========================================================================
        5. CONECTIVIDADE
        ========================================================================
        - TODO nó, exceto "start", tem pelo menos 1 aresta de entrada.
        - TODO nó, exceto "end", tem pelo menos 1 aresta de saída.
        - Nunca deixe nós órfãos. Todos os textos em português (PT-BR).

        5.1. CONECTIVIDADE GLOBAL DO FLUXO (CRITICAL):
        - O diagrama INTEIRO de cada versão é UM SÓ fluxo conectado, do "start" até o(s) "end". É ERRO GRAVE gerar blocos que se conectam entre si mas formam "ilhas" separadas.
        - Confira: dá pra ir do "start" até TODO nó, e de TODO nó até algum "end"? Se um bloco não tem caminho vindo do resto do fluxo, falta ligá-lo.
        - Pra ligar os blocos: identifique onde o bloco começa (qual etapa anterior leva até ele) e onde termina (para qual etapa seguinte ele vai). Quase sempre essa ligação está no texto (ex.: "depois de etiquetadas, as caixas seguem para separação") ou na própria ORDEM em que os trechos aparecem na fonte.
        - "isDubious": true é uma EXCEÇÃO RARÍSSIMA, NÃO um padrão. O app pinta essa linha de vermelho e o usuário precisa revisá-la uma por uma — marcar ligações certas como duvidosas é um erro tão grave quanto deixar blocos soltos.
          · Uma ligação é CERTA (NÃO marque) quando: o texto descreve a sequência; a ordem dos parágrafos/etapas da fonte indica o que vem depois; é a saída de uma decisão descrita no texto; é a volta de um retrabalho descrito ou claramente implícito.
          · Só marque "isDubious": true quando, depois de reler a fonte, NÃO existe pista nenhuma de qual etapa específica de um bloco liga com qual etapa do outro. Mesmo assim crie a aresta com a sua melhor estimativa (em vez de deixar os blocos desconectados), para o usuário validar.
          · Num processo bem descrito, o esperado é ZERO arestas com "isDubious". Nunca mais que 1 a cada 10 arestas. Se passou disso, você está usando errado — remova as marcações das ligações que a fonte sustenta.
        - A ÚNICA exceção pra deixar fluxos genuinamente separados (sem ligação) é quando o texto deixa EXPLÍCITO que são processos totalmente distintos e independentes (ex.: "Processo A: ... Processo B, sem relação com o A: ..."). Fora isso, tudo faz parte do MESMO processo e deve estar conectado — inclusive entre departamentos/raias diferentes (a passagem de bastão entre setores é exatamente o tipo de ligação que não pode faltar).

        ========================================================================
        6. TEXTOS DOS NÓS
        ========================================================================
        - Labels DESCRITIVOS e PROFISSIONAIS, entre 20 e 70 caracteres, sem abreviações ou siglas obscuras.
        - Etapa ('process'): comece com VERBO no infinitivo + objeto (ex.: "Conferir Documentos Fiscais Recebidos", "Separar Volumes por Rota de Entrega").
        - Decisão ('decision'): pergunta fechada terminando com "?" (ex.: "Volume Está Avariado?").
        - Início/fim: diga o que dispara ou encerra o processo (ex.: "Fim — Pedido Expedido").
        - Exemplo RUIM: "Confer. Docs", "CDF", "Etapa 3", "Processo".

        ========================================================================
        7. CHECKLIST FINAL — confira CADA versão antes de escrevê-la
        ========================================================================
        [ ] Os nós e suas arestas de saída estão intercalados (nó, arestas dele, próximo nó...), nunca todas as arestas no final.
        [ ] Todo losango tem 2 ou mais saídas, com rótulos diferentes, levando a destinos diferentes.
        [ ] 'normal' e 'detalhado' NÃO são uma linha reta: têm ramos que se abrem e depois convergem, voltam (retrabalho) ou terminam num final alternativo.
        [ ] Toda verificação, escolha ou exceção citada ou implícita na fonte virou losango.
        [ ] "department" preenchido em todos os nós quando há mais de um setor, com o mesmo nome para o mesmo setor.
        [ ] Um único fluxo conectado do "start" até o(s) "end", sem ilhas.
        [ ] "isDubious" ausente em todas as ligações que a fonte sustenta (o normal é nenhuma).
        [ ] Todo ID usado numa aresta existe como nó da mesma versão.

        ${contextStr}`;
};

const textToStream = (text: string): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let sent = false;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) {
        controller.close();
        return;
      }
      sent = true;
      controller.enqueue(encoder.encode(text));
    },
  });
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 503 ("model overloaded" / "high demand") é quase sempre passageiro — o
 * próprio provedor recomenda tentar de novo. Antes disso o app já desistia
 * dessa tentativa na primeira resposta 503, sem dar chance de a sobrecarga
 * passar. Duas novas tentativas com espera curta (2s, depois 5s) antes de
 * seguir para o próximo passo da cadeia (ou desistir). Não se aplica ao modo
 * gratuito, que já tem sua própria cadeia de alternativas.
 */
const fetchWithOverloadRetry = async (
  url: string,
  init: RequestInit,
  isFree: boolean,
): Promise<Response> => {
  let res = await fetch(url, init);
  if (isFree) return res;

  const delaysMs = [2000, 5000];
  for (const delay of delaysMs) {
    if (res.status !== 503) break;
    await sleep(delay);
    res = await fetch(url, init);
  }
  return res;
};

const generateDiagram = async (body: any, signal?: AbortSignal | null): Promise<Response> => {
  const { def, config } = getActiveProvider();

  if (!isProviderReady(def, config)) {
    openAISettings({
      message: `O provedor "${def.name}" ainda não tem chave cadastrada. Informe a chave ou escolha o modo gratuito, que não precisa de cadastro.`,
    });
    throw new Error(
      `Nenhuma IA configurada. Abra "Configurar IA", cadastre uma chave ou selecione o modo gratuito.`,
    );
  }

  const files = await prepareFiles(body?.files);
  if (files.ignored.length) {
    showToast({
      message: `Arquivo(s) não suportado(s) e ignorado(s): ${files.ignored.join(', ')}`,
      tone: 'warn',
    });
  }
  if (files.pdfs.length && !def.supportsPdf) {
    showToast({
      message: `${def.name} pode não interpretar PDF. Para PDF, use Google Gemini ou Claude, ou anexe .docx/.txt.`,
      tone: 'warn',
      timeout: 12000,
    });
  }

  const prompt = buildPrompt(body || {});

  // O nível 'detalhado' agora pede o máximo de informação possível (mais
  // nós, sem teto fixo, e um campo "notes" extra por nó) — a resposta fica
  // bem mais longa, então o limite de saída da IA sobe para não cortar o
  // JSONL no meio quando 'detalhado' está entre as versões pedidas.
  const wantsDetalhado = Array.isArray(body?.complexities) && body.complexities.includes('detalhado');
  const maxTokens = wantsDetalhado ? 24000 : undefined;

  // Cadeia de tentativas: o modo gratuito troca de modelo/endpoint sozinho
  // quando a cota pública falha; os demais tentam com e sem streaming.
  const attempts: ProviderAttempt[] = def.attempts || [
    { endpoint: def.endpoint, kind: def.kind, stream: true, label: def.name },
    { endpoint: def.endpoint, kind: def.kind, stream: false, label: `${def.name} (sem streaming)` },
  ];

  let lastError: Error | null = null;
  const falhas: string[] = [];

  for (const attempt of attempts) {
    try {
      const req = buildRequest(def, config, prompt, files, {
        stream: attempt.stream,
        signal,
        maxTokens,
        endpointOverride: def.attempts ? attempt.endpoint : undefined,
        modelOverride: def.attempts ? attempt.model : undefined,
        kindOverride: def.attempts ? attempt.kind : undefined,
      });

      const res = await fetchWithOverloadRetry(req.url, req.init, def.free);

      if (!res.ok) {
        lastError = await describeHttpError(def, res);
        falhas.push(String(res.status));
        continue;
      }

      if (req.kind === 'text') {
        return new Response(textToStream(await res.text()), { status: 200 });
      }
      if (!attempt.stream || !res.body) {
        return new Response(textToStream(extractWholeText(req.kind, await res.json())), { status: 200 });
      }
      return new Response(streamToText(req.kind, res.body), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      const msg = String(e?.message || e);
      lastError = /failed to fetch|networkerror|load failed/i.test(msg)
        ? new Error(
            `${def.name}: o navegador bloqueou a chamada (CORS ou rede). Abra "Configurar IA" e escolha outro provedor — ` +
              'OpenRouter e Google Gemini funcionam bem direto do navegador.',
          )
        : new Error(msg);
    }
  }

  // Nenhuma tentativa deu certo. A mensagem vira um aviso dentro da página,
  // com o botão "Configurar IA" (ver setAlertActionResolver abaixo).
  if (def.free) {
    const quantas = attempts.length;
    const codigos = Array.from(new Set(falhas)).join(', ');
    throw new Error(
      `A IA gratuita não conseguiu responder — tentei ${quantas} alternativas` +
        (codigos ? ` (erros ${codigos})` : '') +
        '. Abra "Configurar IA" e escolha outro provedor: o Google Gemini tem plano gratuito e o OpenRouter tem modelos ":free".',
    );
  }

  throw lastError || new Error('Não foi possível gerar com a IA selecionada. Abra "Configurar IA" para revisar o provedor.');
};

export const installAIBridge = (): void => {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  if ((window as any).__labirintoAIBridge__) return;
  (window as any).__labirintoAIBridge__ = true;

  // Avisos que falam em "Configurar IA" ganham o botão que abre a janela.
  setAlertActionResolver((message: string) =>
    /Configurar IA/i.test(message)
      ? {
          label: 'Configurar IA',
          run: () =>
            openAISettings({
              message: 'Escolha outro provedor ou cadastre uma chave para continuar gerando.',
            }),
        }
      : null,
  );

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr && urlStr.includes(ENDPOINT_PATH)) {
      let body: any = {};
      try {
        if (init?.body) body = JSON.parse(init.body as string);
        else if (input instanceof Request) body = await input.clone().json();
      } catch {
        body = {};
      }
      return generateDiagram(body, init?.signal ?? null);
    }

    return originalFetch(input as any, init);
  };

  (window as any).LabirintoAI = {
    openSettings: (opts?: any) => openAISettings(opts),
    getConfig: () => loadConfig(),
    setActive: (id: string) => {
      const cfg = loadConfig();
      saveConfig({ ...cfg, active: id });
    },
    // Backup das chaves também pelo console, se preferir automatizar.
    exportKeys: (password?: string) => exportKeyFile(password),
    importKeys: async (text: string, password?: string) =>
      applyImportedConfig(await parseKeyFile(text, password), 'merge'),
  };
};
