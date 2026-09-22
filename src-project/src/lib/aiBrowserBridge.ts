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

  return `You are a real-time flowchart generation AI.
        Based on the user's prompt or existing flowcharts/files, generate the versions: [${compList}].
        
        CRITICAL: Your output MUST be strictly in JSON Lines format (JSONL).
        Each line MUST be a single valid JSON object. DO NOT output any markdown (like \`\`\`json) or standard text.
        
        Format to follow line by line:
        {"progress": 10}
        {"version": "simples", "node": {"id": "n1", "label": "Início do Processo", "type": "start", "duration": 0}}
        {"version": "simples", "node": {"id": "n2", "label": "Triagem e Validação", "type": "process", "duration": 15, "setupTime": 2, "department": "Atendimento"}}
        {"version": "simples", "edge": {"id": "e1", "source": "n1", "target": "n2"}}
        {"progress": 50}
        {"version": "detalhado", "node": {"id": "d1", "label": "Início", "type": "start", "duration": 0}}
        {"version": "detalhado", "node": {"id": "d2", "label": "Conferência de Documentos Fiscais Recebidos", "type": "process", "duration": 12, "department": "Faturamento", "notes": "Sistema: ERP Financeiro módulo Fiscal. Responsável: Analista de Faturamento. Critério: nota fiscal deve bater com o pedido de compra em valor, quantidade e CFOP. Exceção: divergência acima de 5% vai para aprovação do supervisor."}}
        ...
        {"progress": 100}
        
        CRITICAL SHAPE RULE: The "type" of every node MUST be strictly one of the allowed node types: [${allowedStr}]. Do NOT invent or use unlisted shape types.

        CRITICAL DECISION RULE: todo nó 'decision' (losango de pergunta) SEMPRE sai com pelo menos duas arestas rotuladas, uma para cada desfecho — o par padrão é "Sim" e "Não". Nunca gere um losango com uma única saída.

        CRITICAL INSTRUCTIONS & FLOWCHART ENGINEERING CRITERIA (ISO 5807 & BPMN 2.0 Standards):
        Your mission is to generate professional, industry-grade process flowcharts with realistic branching, decision handling, exception paths, and feedback loops. Avoid simplistic straight-line chains for 'normal' and 'detalhado'.

        1. ARCHITECTURAL HIERARCHY & COMPLEXITY LEVELS:
        - 'simples' (Macro / Executive View): 4 to 6 core nodes. High-level summary of the happy path and primary goal.
        - 'normal' (Tactical Standard Process): 9 to 15 nodes. MUST include at least 2-3 decision gates (if 'decision' is allowed), branching paths for different conditions/exceptions, feedback/rework loops, and proper convergence (merging) back into the main flow.
        - 'detalhado' (Operational Deep-Dive): AT LEAST 16 nodes, WITH NO UPPER CEILING — keep breaking steps down and adding decision gates, sub-branches, and exception handling until every distinct action, check, system, role, and rule mentioned in (or reasonably implied by) the source material has its own node. Do not stop at a round number just because it "looks complete"; stop only when there is truly nothing left to extract from the source. Exhaustive step-by-step mapping: pre-validations, micro-tasks, parallel/conditional sub-branches for different scenarios, failure/retry loops, and convergence to finalization.

        1.1. MAXIMUM DETAIL EXTRACTION FOR 'detalhado' (CRITICAL — ESTE É O PEDIDO PRINCIPAL DO USUÁRIO):
        - A versão 'detalhado' precisa conter o MÁXIMO DE INFORMAÇÃO POSSÍVEL extraída do prompt do usuário e/ou dos arquivos anexados — nada relevante que estiver no texto/arquivo pode ficar de fora do fluxo.
        - Releia o prompt e cada arquivo anexado e garanta que TODO fato concreto neles mencionado vire conteúdo no diagrama: sistemas/ferramentas usados em cada etapa, papéis/cargos responsáveis, critérios de aprovação/rejeição, prazos/SLAs, documentos ou dados de entrada e saída de cada etapa, regras de negócio, exceções, retrabalhos, validações, e qualquer número (percentual, valor, prazo) citado.
        - Cada nó da versão 'detalhado' PODE (e deve, sempre que houver informação relevante disponível na fonte) preencher o campo opcional "notes" com um resumo curto e objetivo desse contexto extra que não cabe no label — ex.: sistema usado, responsável, critério de decisão, entradas/saídas, referência à regra do processo original. "notes" é livre (frase corrida, sem limite rígido de tamanho), mas deve ser específico e vir das informações fornecidas, nunca inventado genericamente.
        - Onde o label de um nó de decisão ('decision') resumir uma regra, o "notes" deve trazer o critério exato usado para decidir (o número, a condição, o documento de referência) sempre que a fonte tiver essa informação.
        - Não repita a mesma informação genérica em vários "notes" — cada um deve refletir o que é específico DAQUELA etapa.
        - As versões 'simples' e 'normal' continuam sem "notes" (esse campo é exclusivo do 'detalhado', para não poluir as visões macro/tática).

        2. STRICT SHAPE CONSTRAINT (USER MANDATE):
        YOU MUST STRICTLY AND EXCLUSIVELY USE ONLY THE FOLLOWING ALLOWED NODE TYPES:
        [${allowedStr}]
        
        DO NOT use any node type that is NOT in this allowed list!
        - If 'document' is not in the list, use 'process' or other allowed types.
        - If 'database' is not in the list, use 'process' or other allowed types.
        - If 'inputoutput' is not in the list, use 'process' or other allowed types.
        - If 'decision' is not in the list, use 'process' for branching.
        - Always ensure nodes have valid "type" attribute from this allowed list only.
        - NEVER output custom, invented, or unrecognized types outside this list.
        - Mesmo que "swimlane" ou "frame" estejam nesta lista, NÃO os utilize para gerar nós — veja a seção 3.2 sobre setores/departamentos.

        3. BRANCHING, MERGING & FEEDBACK LOOPS (CRITICAL):
        - Real processes diverge and converge: When a decision node occurs, create distinct paths for different outcomes (e.g. Approved vs Rejected, Success vs Error, Standard vs Escalated).
        - Feedback / Correction Loops: In case of rejection, error, or incomplete data, create an edge returning back to the appropriate previous step for correction (e.g., from "Admin Approval: Rejected" -> back to "Fill Request Form").
        - Convergence (Merges): Branching activities handling different scenarios MUST converge back together into a shared subsequent stage (e.g., after divergent payment or repair tracks, both merge into "Quality Inspection" or "Final Delivery").
        - Decision Edge Labels: EVERY edge originating from a 'decision' node MUST have a descriptive 'label' string (e.g., "Sim", "Não", "Aprovado", "Reprovado", "Erro", "Sucesso", "Simples", "Complexo").

        3.1. REGRA OBRIGATÓRIA DO LOSANGO (DECISÃO) — NUNCA VIOLAR:
        - Todo nó do tipo 'decision' DEVE ter NO MÍNIMO 2 arestas de saída, para caminhos diferentes. Um losango com uma única saída é ERRO GRAVE: se a pergunta só tem um desfecho, ela não é decisão — use 'process'.
        - O par padrão é "Sim" e "Não". Só troque por outro par quando a pergunta pedir (por exemplo "Aprovado"/"Reprovado", "Conforme"/"Divergente", "Dentro do prazo"/"Atrasado").
        - Quando houver três ou mais desfechos, rotule todos e cubra também o caso de exceção (ex.: "Sim", "Não", "Parcial").
        - Os rótulos das saídas do mesmo losango precisam ser diferentes entre si e mutuamente exclusivos: juntos devem cobrir todos os desfechos possíveis da pergunta.
        - O texto do losango deve ser uma PERGUNTA fechada, terminando com "?" (ex.: "Documentação está completa?"). Se não der para responder com o par de rótulos escolhido, reescreva a pergunta.
        - Cada saída precisa levar a algum lugar: nenhuma ponta solta. O caminho negativo normalmente volta para a etapa de correção anterior ou segue para um tratamento de exceção.

        3.2. SETORES, ÁREAS OU DEPARTAMENTOS DIFERENTES (RAIAS E QUADROS) — CRITICAL:
        - Se o processo atravessa mais de um setor, departamento, equipe, sistema ou área física responsável (ex.: "Atendimento" entrega para "Estoque", que entrega para "Financeiro"; ou "Cliente" x "Sistema" x "Equipe Interna"), preencha o campo "department" de CADA nó com o nome curto de quem executa aquela etapa.
        - "department" precisa ser curto (2 a 4 palavras, ex.: "Vendas", "Financeiro", "Logística", "Cliente", "Sistema Externo") porque o app usa esse texto como título da raia/quadro desenhado ao redor das etapas daquele setor.
        - Use exatamente o MESMO texto em todas as etapas do mesmo setor — não varie o nome do mesmo grupo (não misture "TI" com "Tecnologia da Informação", por exemplo).
        - O aplicativo desenha automaticamente a raia ou o quadro ao redor de cada setor identificado, depois de gerar o diagrama. Por isso você NUNCA deve gerar nós do tipo "swimlane" ou "frame" — mesmo que apareçam na lista de formas permitidas, esses dois tipos são reservados para uso manual do usuário depois, não para geração por IA.
        - Se o processo inteiro acontece dentro de um único setor/departamento/área, deixe "department" vazio ("") em todos os nós — nesse caso nenhuma raia é desenhada.

        4. ABSOLUTE TOTAL TIME PRESERVATION (VALUE STREAM INTEGRITY):
        - The GRAND TOTAL SUM of times (duration + setupTime + waitTime) across all nodes in a version MUST BE RIGOROUSLY IDENTICAL for 'simples', 'normal', and 'detalhado'.
        - Mathematical Consistency: When generating from scratch, establish the total process duration first (or calculate it in 'detalhado'). When grouping micro-steps in 'normal' and 'simples', sum the exact individual times so that SUM(simples) === SUM(normal) === SUM(detalhado).
        - If generating from existing versions, preserve the exact total lead time.

        5. GRAPH CONNECTIVITY:
        - EVERY node except "start" MUST have at least 1 incoming edge.
        - EVERY node except "end" MUST have at least 1 outgoing edge.
        - NEVER leave orphaned nodes. All labels MUST be in Portuguese (PT-BR).

        6. LABELS (CRITICAL):
        - Labels devem ser DESCRITIVOS, COMPLETOS e PROFISSIONAIS, entre 20 e 70 caracteres.
        - NUNCA use abreviações ou siglas obscuras. Escreva o nome completo da etapa.
        - Exemplo BOM: "Conferência de Documentos Fiscais Recebidos".
        - Exemplo RUIM: "Confer. Docs" ou "CDF".
        - Prefira frases claras que qualquer pessoa da operação entenda ao ler.
        
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
