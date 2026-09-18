/**
 * PROVEDORES DE IA — tudo no navegador, sem servidor.
 * ---------------------------------------------------
 * Cada provedor descreve: endpoint, formato do corpo, leitura do streaming,
 * onde pegar a chave e o passo a passo para criá-la.
 * As chaves ficam no localStorage do próprio navegador do usuário.
 */

import { extractSpreadsheetText, isLegacyExcel, isSpreadsheetFile } from './spreadsheet';

export type ProviderKind = 'openai' | 'gemini' | 'anthropic' | 'text';

export interface ProviderAttempt {
  endpoint: string;
  model?: string;
  kind: ProviderKind;
  stream: boolean;
  label: string;
}

export interface ProviderDef {
  id: string;
  name: string;
  badge: string;
  kind: ProviderKind;
  endpoint: string;
  defaultModel: string;
  models: string[];
  keyless?: boolean;
  free?: boolean;
  editableEndpoint?: boolean;
  keyLabel?: string;
  keyHint?: string;
  keyUrl?: string;
  supportsPdf?: boolean;
  supportsImages?: boolean;
  steps: string[];
  notes?: string;
  /** Alternativas tentadas em ordem quando a principal falha (usado no modo gratuito). */
  attempts?: ProviderAttempt[];
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'free',
    name: 'Gratuito (Pollinations)',
    badge: 'sem chave',
    kind: 'openai',
    endpoint: 'https://text.pollinations.ai/openai',
    defaultModel: 'openai',
    models: ['openai', 'openai-fast', 'mistral', 'gemini'],
    keyless: true,
    free: true,
    editableEndpoint: true,
    keyHint: 'Não precisa de chave. O serviço é público e pode ficar sem cota.',
    keyUrl: 'https://enter.pollinations.ai',
    supportsImages: true,
    attempts: [
      { endpoint: 'https://text.pollinations.ai/openai', kind: 'openai', stream: true, label: 'openai (streaming)' },
      { endpoint: 'https://text.pollinations.ai/openai', model: 'openai-fast', kind: 'openai', stream: false, label: 'openai-fast' },
      { endpoint: 'https://text.pollinations.ai/', model: 'openai-fast', kind: 'text', stream: false, label: 'endpoint simples' },
      { endpoint: 'https://text.pollinations.ai/', model: 'mistral', kind: 'text', stream: false, label: 'mistral' },
    ],
    steps: [
      'Não precisa cadastrar nada: escolha este provedor e clique em Salvar.',
      'É um serviço público e gratuito (Pollinations.AI, Berlim), com cota compartilhada por IP.',
      'Se der erro de cota (402/429/500), o app tenta automaticamente outros modelos gratuitos.',
      'Se ainda assim falhar, use "Pollinations com conta" (chave gratuita) ou o Google Gemini, que tem plano gratuito.',
    ],
    notes:
      'Serviço público de terceiros, sem garantia de disponibilidade: o texto do prompt sai do navegador para os servidores da Pollinations. Não use com informação confidencial.',
  },
  {
    id: 'pollinations-key',
    name: 'Pollinations com conta (chave gratuita)',
    badge: 'gratuito com cadastro',
    kind: 'openai',
    endpoint: 'https://gen.pollinations.ai/v1/chat/completions',
    defaultModel: 'openai',
    models: ['openai', 'openai-fast', 'gemini', 'mistral'],
    editableEndpoint: true,
    keyLabel: 'Chave da Pollinations (pk_... ou sk_...)',
    keyUrl: 'https://enter.pollinations.ai',
    supportsImages: true,
    steps: [
      'Abra enter.pollinations.ai e crie a conta (login com GitHub ou e-mail).',
      'Vá em Keys e gere uma chave. Para uso no navegador, escolha a publicável (pk_).',
      'Copie a chave e cole acima; o endereço já vem preenchido com o serviço novo (gen.pollinations.ai).',
      'A conta ganha uma cota gratuita de Pollen, bem maior que a do modo anônimo.',
    ],
    notes:
      'A chave publicável fica visível para quem abrir o código da página e consome a cota da sua conta se o app tiver muito tráfego.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'tem plano gratuito',
    kind: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    keyLabel: 'Chave de API (AIza...)',
    keyUrl: 'https://aistudio.google.com/apikey',
    supportsPdf: true,
    supportsImages: true,
    steps: [
      'Abra aistudio.google.com/apikey e entre com uma conta Google.',
      'Clique em "Create API key" / "Criar chave de API".',
      'Escolha um projeto (ou deixe criar um novo) e confirme.',
      'Copie a chave que começa com "AIza" e cole no campo acima.',
      'O nível gratuito do AI Studio já atende o uso normal deste editor.',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    badge: 'pago por uso',
    kind: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini'],
    keyLabel: 'Chave de API (sk-...)',
    keyUrl: 'https://platform.openai.com/api-keys',
    supportsImages: true,
    steps: [
      'Abra platform.openai.com/api-keys e faça login (é a conta da OpenAI, não a do ChatGPT Plus).',
      'Clique em "Create new secret key", dê um nome e confirme.',
      'Copie a chave "sk-..." — ela só aparece uma vez — e cole acima.',
      'Em Settings > Billing, adicione créditos: a API é cobrada por uso, separada da assinatura do ChatGPT.',
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    badge: 'pago por uso',
    kind: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-5',
    models: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-5'],
    keyLabel: 'Chave de API (sk-ant-...)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    supportsPdf: true,
    supportsImages: true,
    steps: [
      'Abra console.anthropic.com e crie/entre na sua conta.',
      'Vá em Settings > API keys > "Create key".',
      'Copie a chave "sk-ant-..." e cole acima.',
      'Adicione créditos em Billing — a assinatura do Claude.ai não vale para a API.',
    ],
    notes:
      'A chamada é feita direto do navegador com o cabeçalho oficial de acesso direto da Anthropic.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    badge: 'barato',
    kind: 'openai',
    endpoint: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyLabel: 'Chave de API (sk-...)',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    steps: [
      'Abra platform.deepseek.com e crie a conta (aceita login com Google ou e-mail).',
      'Vá em "API keys" > "Create new API key".',
      'Copie a chave e cole acima.',
      'Adicione crédito em "Top up" — os valores são bem baixos.',
    ],
    notes:
      'Se o navegador bloquear a chamada por CORS, use o DeepSeek através do OpenRouter (opção abaixo).',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (GPT, Claude, Gemini, DeepSeek, Grok)',
    badge: 'uma chave para tudo',
    kind: 'openai',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'deepseek/deepseek-chat-v3.1:free',
    models: [
      'deepseek/deepseek-chat-v3.1:free',
      'google/gemini-2.5-flash',
      'openai/gpt-4o-mini',
      'anthropic/claude-sonnet-4.5',
      'x-ai/grok-4-fast:free',
    ],
    keyLabel: 'Chave de API (sk-or-...)',
    keyUrl: 'https://openrouter.ai/keys',
    supportsImages: true,
    steps: [
      'Abra openrouter.ai e crie a conta (login com Google ou GitHub).',
      'Vá em Keys > "Create Key", copie a chave "sk-or-..." e cole acima.',
      'Escolha o modelo no campo Modelo: os terminados em ":free" não consomem crédito.',
      'É a opção mais confiável no navegador, porque o OpenRouter foi feito para uso direto em páginas web.',
    ],
  },
  {
    id: 'github',
    name: 'GitHub Models (Copilot)',
    badge: 'cota gratuita',
    kind: 'openai',
    endpoint: 'https://models.github.ai/inference/chat/completions',
    defaultModel: 'openai/gpt-4o-mini',
    models: ['openai/gpt-4o-mini', 'openai/gpt-4.1-mini', 'deepseek/DeepSeek-V3-0324', 'meta/Llama-3.3-70B-Instruct'],
    keyLabel: 'Token pessoal do GitHub (ghp_... ou github_pat_...)',
    keyUrl: 'https://github.com/settings/personal-access-tokens',
    steps: [
      'O Copilot do editor não tem API pública: o caminho oficial da Microsoft/GitHub é o GitHub Models.',
      'Abra github.com/settings/personal-access-tokens > "Generate new token" (fine-grained).',
      'Em Permissions, marque "Models: Read". Não precisa de mais nada.',
      'Gere, copie o token e cole acima.',
    ],
    notes:
      'Alguns navegadores bloqueiam a chamada direta ao GitHub por CORS. Se der erro de rede, use o OpenRouter.',
  },
  {
    id: 'custom',
    name: 'Outro serviço compatível com OpenAI',
    badge: 'avançado',
    kind: 'openai',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [],
    editableEndpoint: true,
    keyLabel: 'Chave de API',
    steps: [
      'Serve para Groq, Together, Mistral, Ollama local, LM Studio ou qualquer API no formato /chat/completions da OpenAI.',
      'Cole o endereço completo do endpoint no campo "Endpoint".',
      'Informe o nome do modelo exatamente como o serviço espera.',
      'Se o serviço não exigir chave (ex.: Ollama em localhost), deixe o campo de chave vazio.',
    ],
  },
];

export const getProvider = (id: string): ProviderDef =>
  PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];

/* ------------------------------------------------------------------ */
/* Configuração salva no navegador                                     */
/* ------------------------------------------------------------------ */

export interface ProviderConfig {
  key?: string;
  model?: string;
  endpoint?: string;
}

export interface AIConfig {
  active: string;
  providers: Record<string, ProviderConfig>;
}

const STORAGE_KEY = 'labirinto_ai_config_v1';
const LEGACY_GEMINI_KEY = 'labirinto_gemini_api_key';

let cache: AIConfig | null = null;

const defaults = (): AIConfig => ({ active: 'free', providers: {} });

export const loadConfig = (): AIConfig => {
  if (cache) return cache;
  let cfg = defaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        cfg = { active: parsed.active || 'free', providers: parsed.providers || {} };
      }
    }
  } catch {
    /* armazenamento bloqueado: segue com o padrão */
  }

  // Migração: chave antiga do Gemini e chave embutida no index.html
  try {
    const legacy = localStorage.getItem(LEGACY_GEMINI_KEY);
    if (legacy && !cfg.providers.gemini?.key) {
      cfg.providers.gemini = { ...(cfg.providers.gemini || {}), key: legacy };
    }
  } catch {
    /* ignore */
  }
  // Configuração embutida no index.html (window.__AI_CONFIG__): serve como
  // padrão quando o navegador ainda não tem nada salvo.
  const baked = (window as any).__AI_CONFIG__;
  if (baked && typeof baked === 'object') {
    cfg = {
      active: cfg.active !== 'free' ? cfg.active : baked.active || cfg.active,
      providers: { ...(baked.providers || {}), ...cfg.providers },
    };
  }

  const embedded = (window as any).__GEMINI_API_KEY__;
  if (embedded && String(embedded).trim() && !cfg.providers.gemini?.key) {
    cfg.providers.gemini = { ...(cfg.providers.gemini || {}), key: String(embedded).trim() };
    if (cfg.active === 'free') cfg.active = 'gemini';
  }

  cache = cfg;
  return cfg;
};

export const saveConfig = (cfg: AIConfig): void => {
  cache = cfg;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* armazenamento bloqueado: vale só nesta sessão */
  }
};

export const getActiveProvider = (): { def: ProviderDef; config: ProviderConfig } => {
  const cfg = loadConfig();
  const def = getProvider(cfg.active);
  return { def, config: cfg.providers[def.id] || {} };
};

export const isProviderReady = (def: ProviderDef, config: ProviderConfig): boolean =>
  Boolean(def.keyless || (config.key && config.key.trim()));

export interface ActiveSummary {
  id: string;
  name: string;
  model: string;
  ready: boolean;
  keyless: boolean;
  free: boolean;
}

/** Resumo do provedor ativo, para mostrar na tela sem abrir as configurações. */
export const getActiveSummary = (): ActiveSummary => {
  const { def, config } = getActiveProvider();
  return {
    id: def.id,
    name: def.name,
    model: (config.model || '').trim() || def.defaultModel,
    ready: isProviderReady(def, config),
    keyless: Boolean(def.keyless),
    free: Boolean(def.free),
  };
};

/* ------------------------------------------------------------------ */
/* Arquivos anexados                                                   */
/* ------------------------------------------------------------------ */

export interface InputFile {
  name?: string;
  mimeType: string;
  data: string; // base64
}

const base64ToArrayBuffer = (b64: string): ArrayBuffer => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};

const base64ToUtf8 = (b64: string): string =>
  new TextDecoder('utf-8').decode(new Uint8Array(base64ToArrayBuffer(b64)));

export interface PreparedFiles {
  texts: string[];
  images: InputFile[];
  pdfs: InputFile[];
  ignored: string[];
}

/** Converte os anexos: .docx e texto viram texto; imagens e PDFs seguem como binário. */
export const prepareFiles = async (files?: InputFile[]): Promise<PreparedFiles> => {
  const out: PreparedFiles = { texts: [], images: [], pdfs: [], ignored: [] };
  if (!files || !Array.isArray(files)) return out;

  for (const file of files) {
    const mime = file.mimeType || '';
    const name = file.name || 'arquivo';
    const isDocx =
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword' ||
      name.toLowerCase().endsWith('.docx');

    if (isSpreadsheetFile(name, mime)) {
      try {
        out.texts.push(await extractSpreadsheetText(base64ToArrayBuffer(file.data), name));
      } catch (e) {
        console.error('Erro ao ler planilha', e);
        out.ignored.push(name);
      }
    } else if (isLegacyExcel(name, mime)) {
      // .xls é o formato binário antigo do Excel; não dá para ler sem uma
      // biblioteca pesada. O caminho é salvar como .xlsx ou .csv.
      out.ignored.push(`${name} (salve como .xlsx ou .csv)`);
    } else if (/\.csv$/i.test(name)) {
      try {
        out.texts.push(`[Conteúdo da planilha ${name}]:\n${base64ToUtf8(file.data)}`);
      } catch {
        out.ignored.push(name);
      }
    } else if (isDocx) {
      try {
        const mammoth: any = await import('mammoth');
        const result = await (mammoth.default || mammoth).extractRawText({
          arrayBuffer: base64ToArrayBuffer(file.data),
        });
        out.texts.push(`[Conteúdo do documento ${name}]:\n${result.value}`);
      } catch (e) {
        console.error('Erro ao ler .docx', e);
        out.ignored.push(name);
      }
    } else if (mime.startsWith('text/') || mime === 'application/json') {
      try {
        out.texts.push(`[Conteúdo do arquivo ${name}]:\n${base64ToUtf8(file.data)}`);
      } catch {
        out.ignored.push(name);
      }
    } else if (mime.startsWith('image/')) {
      out.images.push(file);
    } else if (mime === 'application/pdf') {
      out.pdfs.push(file);
    } else {
      out.ignored.push(name);
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Montagem da requisição por tipo de API                              */
/* ------------------------------------------------------------------ */

export interface BuiltRequest {
  url: string;
  init: RequestInit;
  kind: ProviderKind;
}

export const buildRequest = (
  def: ProviderDef,
  config: ProviderConfig,
  prompt: string,
  files: PreparedFiles,
  opts: {
    stream: boolean;
    signal?: AbortSignal | null;
    maxTokens?: number;
    endpointOverride?: string;
    modelOverride?: string;
    kindOverride?: ProviderKind;
  },
): BuiltRequest => {
  const key = (config.key || '').trim();
  const model = opts.modelOverride || (config.model || '').trim() || def.defaultModel;
  const endpoint = opts.endpointOverride || (config.endpoint || '').trim() || def.endpoint;
  const textBlock = [...files.texts, prompt].join('\n\n');
  const kind = opts.kindOverride || def.kind;

  // Endpoint simples da Pollinations: responde texto puro, sem envelope JSON.
  if (kind === 'text') {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = `Bearer ${key}`;
    return {
      kind: 'text',
      url: endpoint,
      init: {
        method: 'POST',
        headers,
        signal: opts.signal || undefined,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: textBlock }],
          stream: false,
        }),
      },
    };
  }

  if (kind === 'gemini') {
    const parts: any[] = [];
    for (const img of files.images) parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    for (const pdf of files.pdfs) parts.push({ inlineData: { mimeType: pdf.mimeType, data: pdf.data } });
    parts.push({ text: textBlock });
    const url =
      `${endpoint.replace(/\/$/, '')}/${encodeURIComponent(model)}:` +
      (opts.stream ? 'streamGenerateContent?alt=sse&key=' : 'generateContent?key=') +
      encodeURIComponent(key);
    return {
      kind: 'gemini',
      url,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: opts.signal || undefined,
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.2, maxOutputTokens: opts.maxTokens || 32768 },
        }),
      },
    };
  }

  if (kind === 'anthropic') {
    const content: any[] = [];
    for (const img of files.images) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mimeType, data: img.data },
      });
    }
    for (const pdf of files.pdfs) {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdf.data },
      });
    }
    content.push({ type: 'text', text: textBlock });
    return {
      kind: 'anthropic',
      url: endpoint,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        signal: opts.signal || undefined,
        body: JSON.stringify({
          model,
          max_tokens: opts.maxTokens || 16000,
          temperature: 0.2,
          stream: opts.stream,
          messages: [{ role: 'user', content }],
        }),
      },
    };
  }

  // Formato OpenAI (ChatGPT, DeepSeek, OpenRouter, GitHub Models, gratuito, custom)
  const content: any[] = [{ type: 'text', text: textBlock }];
  for (const img of files.images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.data}` },
    });
  }
  for (const pdf of files.pdfs) {
    content.push({
      type: 'file',
      file: { filename: pdf.name || 'documento.pdf', file_data: `data:application/pdf;base64,${pdf.data}` },
    });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (def.id === 'openrouter') {
    headers['HTTP-Referer'] = typeof location !== 'undefined' ? location.origin : 'https://labirinto.app';
    headers['X-Title'] = 'Labirinto Fluxogramas';
  }

  return {
    kind: 'openai',
    url: endpoint,
    init: {
      method: 'POST',
      headers,
      signal: opts.signal || undefined,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        stream: opts.stream,
        messages: [{ role: 'user', content: content.length === 1 ? textBlock : content }],
      }),
    },
  };
};

/* ------------------------------------------------------------------ */
/* Leitura do streaming                                                */
/* ------------------------------------------------------------------ */

const extractDelta = (kind: ProviderKind, json: any): string => {
  try {
    if (kind === 'gemini') {
      const parts = json?.candidates?.[0]?.content?.parts || [];
      return parts.map((p: any) => p.text || '').join('');
    }
    if (kind === 'anthropic') {
      if (json?.type === 'content_block_delta') return json?.delta?.text || '';
      if (json?.type === 'content_block_start') return json?.content_block?.text || '';
      return '';
    }
    const choice = json?.choices?.[0];
    return choice?.delta?.content || choice?.message?.content || choice?.text || '';
  } catch {
    return '';
  }
};

/** Converte o SSE do provedor no fluxo de texto puro que o editor já sabe ler. */
export const streamToText = (
  kind: ProviderKind,
  upstream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> => {
  const reader = upstream.getReader();
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      if (kind === 'text') {
        controller.enqueue(value);
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('event:') || line.startsWith(':')) continue;
        const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
        if (!payload || payload === '[DONE]') continue;
        try {
          const text = extractDelta(kind, JSON.parse(payload));
          if (text) controller.enqueue(encoder.encode(text));
        } catch {
          /* fragmento incompleto */
        }
      }
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => undefined);
    },
  });
};

export const extractWholeText = (kind: ProviderKind, json: any): string => {
  if (kind === 'gemini') {
    const parts = json?.candidates?.[0]?.content?.parts || [];
    return parts.map((p: any) => p.text || '').join('');
  }
  if (kind === 'anthropic') {
    const blocks = json?.content || [];
    return blocks.map((b: any) => b.text || '').join('');
  }
  return json?.choices?.[0]?.message?.content || '';
};

export const describeHttpError = async (def: ProviderDef, res: Response): Promise<Error> => {
  let detail = '';
  try {
    const data = await res.clone().json();
    detail = data?.error?.message || data?.message || '';
    if (typeof detail !== 'string') detail = JSON.stringify(detail);
  } catch {
    try {
      detail = await res.clone().text();
    } catch {
      detail = '';
    }
  }
  detail = String(detail || '').replace(/\s+/g, ' ').slice(0, 140);

  if (def.free) {
    const motivo =
      res.status === 404
        ? 'o endereço ou o modelo do serviço gratuito saiu do ar'
        : res.status === 402 || res.status === 429 || res.status >= 500
          ? 'a cota pública está esgotada'
          : `o serviço respondeu ${res.status}`;
    return new Error(`A IA gratuita não respondeu: ${motivo} (erro ${res.status}).`);
  }
  if (res.status === 401 || res.status === 403) {
    return new Error(`${def.name}: chave recusada (${res.status}). Revise a chave em "Configurar IA". ${detail}`.trim());
  }
  if (res.status === 402) {
    return new Error(`${def.name}: conta sem crédito (402). Adicione saldo ou troque de provedor em "Configurar IA".`);
  }
  if (res.status === 429) {
    return new Error(`${def.name}: limite de uso atingido (429). Aguarde alguns minutos ou troque de provedor.`);
  }
  if (res.status === 404) {
    return new Error(`${def.name}: modelo ou endereço não encontrado (404). Revise o modelo em "Configurar IA". ${detail}`.trim());
  }
  return new Error(`${def.name}: falha ${res.status}. ${detail}`.trim());
};

/** Teste rápido de conexão usado pelo botão "Testar" das configurações. */
export const testProvider = async (
  def: ProviderDef,
  config: ProviderConfig,
): Promise<{ ok: boolean; message: string }> => {
  const attempts: ProviderAttempt[] = def.attempts || [
    { endpoint: (config.endpoint || '').trim() || def.endpoint, kind: def.kind, stream: false, label: def.name },
  ];
  let last = '';

  for (const attempt of attempts) {
    try {
      const req = buildRequest(
        def,
        config,
        'Responda apenas com a palavra OK.',
        { texts: [], images: [], pdfs: [], ignored: [] },
        {
          stream: false,
          maxTokens: 16,
          endpointOverride: def.attempts ? attempt.endpoint : undefined,
          modelOverride: def.attempts ? attempt.model : undefined,
          kindOverride: def.attempts ? attempt.kind : undefined,
        },
      );
      const res = await fetch(req.url, req.init);
      if (!res.ok) {
        last = (await describeHttpError(def, res)).message;
        continue;
      }
      const text =
        req.kind === 'text' ? (await res.text()).trim() : extractWholeText(req.kind, await res.json()).trim();
      const via = def.attempts && attempts.length > 1 ? ` (via ${attempt.label})` : '';
      return { ok: true, message: `Conexão OK${via}${text ? ` — resposta: "${text.slice(0, 40)}"` : ''}` };
    } catch (e: any) {
      const msg = String(e?.message || e);
      last = /failed to fetch|networkerror|load failed/i.test(msg)
        ? 'O navegador bloqueou a chamada (CORS/rede). Este provedor pode não aceitar acesso direto do navegador — tente o OpenRouter, o Gemini ou o modo gratuito.'
        : msg;
    }
  }

  return { ok: false, message: last || 'Não foi possível conectar.' };
};


/* ------------------------------------------------------------------ */
/* Backup das chaves: exportar e importar arquivo                      */
/* ------------------------------------------------------------------ */

export const FILE_TYPE = 'labirinto-ai-keys';

export interface KeyFile {
  app: string;
  type: string;
  version: number;
  encrypted: boolean;
  exportedAt: string;
  config?: AIConfig;
  kdf?: { name: string; hash: string; iterations: number; salt: string };
  cipher?: { name: string; iv: string };
  data?: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return btoa(out);
};

const fromB64 = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export const cryptoAvailable = (): boolean =>
  typeof crypto !== 'undefined' && !!(crypto as any).subtle;

const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

/** Gera o conteúdo do arquivo de backup, com ou sem senha. */
export const exportKeyFile = async (password?: string): Promise<string> => {
  const cfg = loadConfig();
  const base: KeyFile = {
    app: 'Labirinto Fluxogramas',
    type: FILE_TYPE,
    version: 1,
    encrypted: false,
    exportedAt: new Date().toISOString(),
  };

  if (!password) {
    return JSON.stringify({ ...base, config: cfg }, null, 2);
  }

  if (!cryptoAvailable()) {
    throw new Error('Este navegador não permite criptografar aqui. Exporte sem senha ou abra o app por um endereço https.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(cfg)),
  );

  return JSON.stringify(
    {
      ...base,
      encrypted: true,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 250000, salt: toB64(salt) },
      cipher: { name: 'AES-GCM', iv: toB64(iv) },
      data: toB64(cipherBuf),
    },
    null,
    2,
  );
};

/** Lê o arquivo de backup; pede a senha somente quando ele está protegido. */
export const parseKeyFile = async (text: string, password?: string): Promise<AIConfig> => {
  let file: KeyFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('Arquivo inválido: não é um backup de chaves do Labirinto.');
  }

  if (!file || file.type !== FILE_TYPE) {
    throw new Error('Arquivo inválido: não é um backup de chaves do Labirinto.');
  }

  if (!file.encrypted) {
    if (!file.config || typeof file.config !== 'object') {
      throw new Error('Arquivo de backup sem conteúdo.');
    }
    return { active: file.config.active || 'free', providers: file.config.providers || {} };
  }

  if (!password) throw new Error('SENHA_NECESSARIA');
  if (!cryptoAvailable()) throw new Error('Este navegador não consegue abrir arquivos protegidos por senha.');

  try {
    const key = await deriveKey(password, fromB64(file.kdf!.salt));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(file.cipher!.iv) },
      key,
      fromB64(file.data!),
    );
    const cfg = JSON.parse(decoder.decode(plain));
    return { active: cfg.active || 'free', providers: cfg.providers || {} };
  } catch (e: any) {
    if (String(e?.message) === 'SENHA_NECESSARIA') throw e;
    throw new Error('Senha incorreta ou arquivo corrompido.');
  }
};

/** Aplica o backup: "merge" mantém as chaves atuais que não vierem no arquivo. */
export const applyImportedConfig = (incoming: AIConfig, mode: 'merge' | 'replace' = 'merge'): AIConfig => {
  const current = loadConfig();
  const next: AIConfig =
    mode === 'replace'
      ? { active: incoming.active, providers: incoming.providers }
      : {
          active: incoming.active || current.active,
          providers: { ...current.providers, ...incoming.providers },
        };
  saveConfig(next);
  return next;
};

/** Bloco pronto para colar no index.html e já distribuir o app configurado. */
export const buildBakedSnippet = (): string => {
  const cfg = loadConfig();
  return `<script>window.__AI_CONFIG__ = ${JSON.stringify(cfg, null, 2)};</script>`;
};
