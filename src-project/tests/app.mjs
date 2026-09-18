import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';

const EMBEDDED = process.argv.includes('--embedded');
let html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf-8');
html = html.replace('<script type="module" crossorigin>', '<script>').replace('<script type="module">', '<script>');
html = html.replace(/import\.meta\.url/g, '"https://exemplo.test/"');
if (EMBEDDED) html = html.replace('window.self!==window.top', '!0').replace('window.self === window.top', 'false');

const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', e => errors.push('JSDOM: ' + (e.message || e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ').slice(0, 220)));

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://app.exemplo.test/', virtualConsole: vc });
const w = dom.window;
w.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
w.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
w.matchMedia = q => ({ matches:false, media:q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, onchange:null });
w.scrollTo = () => {};
w.ReadableStream = ReadableStream; w.Response = Response; w.Headers = Headers;
w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
w.URL.createObjectURL = () => 'blob:https://app.exemplo.test/fake';
try { Object.defineProperty(w, 'crypto', { value: globalThis.crypto, configurable: true }); } catch (e) { console.log('crypto nao substituivel'); }
w.URL.revokeObjectURL = () => {};

const calls = [];
const pollCalls = [];
const sse = (chunks) => {
  const enc = new TextEncoder();
  const payload = chunks.map(c => 'data: ' + JSON.stringify(c) + '\n\n').join('') + 'data: [DONE]\n\n';
  return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(enc.encode(payload)); c.close(); } }) };
};
w.fetch = async (url, init) => {
  const u = String(url);
  calls.push({ url: u, init });
  if (u.includes('pollinations')) {
    pollCalls.push({ url: u, body: JSON.parse(init.body) });
    if (globalThis.forceFreeFail) {
      return { ok: false, status: 500, clone: () => ({ json: async () => ({ error: '402 Payment Required', status: 500, deprecation_notice: 'NOTE: The Pollinations legacy text API is being deprecated...' }), text: async () => 'erro' }), json: async () => ({}), text: async () => 'erro' };
    }
    if (pollCalls.length === 1) {
      // reproduz o erro real: cota publica esgotada no endpoint antigo
      return { ok: false, status: 500, clone: () => ({ json: async () => ({ error: '402 Payment Required', status: 500 }), text: async () => 'erro' }), json: async () => ({}), text: async () => 'erro' };
    }
    if (pollCalls.length === 2) {
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"progress": 10}\n{"progress": 100}\n' } }] }), text: async () => '' };
    }
    return { ok: true, status: 200, text: async () => '{"progress": 100}\n', body: null };
  }
  if (u.includes('openai.com') || u.includes('openrouter') || u.includes('models.github.ai') || u.includes('deepseek')) {
    return sse([
      { choices: [{ delta: { content: '{"progress": 10}\n' } }] },
      { choices: [{ delta: { content: '{"version": "simples", "node": {"id":"n1","label":"Início","type":"start"}}\n' } }] },
      { choices: [{ delta: { content: '{"progress": 100}\n' } }] },
    ]);
  }
  if (u.includes('api.anthropic.com')) {
    return sse([
      { type: 'content_block_delta', delta: { text: '{"progress": 10}\n' } },
      { type: 'content_block_delta', delta: { text: '{"progress": 100}\n' } },
    ]);
  }
  if (u.includes('generativelanguage')) {
    return sse([{ candidates: [{ content: { parts: [{ text: '{"progress": 100}\n' }] } }] }]);
  }
  throw new Error('fetch nao esperado: ' + u);
};

// simula chaves pre-embutidas no index.html
w.__AI_CONFIG__ = { active: 'openrouter', providers: { openrouter: { key: 'sk-or-EMBUTIDA', model: 'openai/gpt-4o-mini' } } };

// espia a leitura da area de transferencia: ela e que dispara o pedido de permissao
let leiturasClipboard = 0;
let escritasClipboard = 0;
try {
  Object.defineProperty(w.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async () => { escritasClipboard++; },
      readText: async () => { leiturasClipboard++; return ''; },
    },
  });
} catch (e) { console.log('clipboard nao substituivel'); }

let alertNativo = 0;
w.alert = () => { alertNativo++; };

for (const s of [...w.document.querySelectorAll('script:not([src])')]) {
  try { w.eval(s.textContent); } catch (e) { errors.push('EXEC: ' + e.message); }
}
await new Promise(r => setTimeout(r, 1500));

const R = [];
const check = (n, ok, extra='') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);
const byText = (sel, re) => [...w.document.querySelectorAll(sel)].filter(e => re.test((e.textContent || '').trim()));
const click = async (el, ms = 700) => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, ms)); };

// ---- painel inicial
check('app renderiza', w.document.getElementById('root').children.length > 0);
const cfgInicial = w.LabirintoAI.getConfig();
check('chaves embutidas no index.html sao lidas', cfgInicial.providers?.openrouter?.key === 'sk-or-EMBUTIDA' && cfgInicial.active === 'openrouter');
const entrar = byText('button, a', /Acessar o App/i)[0];
if (entrar) await click(entrar, 1200);

const textoPainel = w.document.body.textContent || '';
check('login Google removido', !/Entrar com Google/i.test(textoPainel) && !w.document.body.innerHTML.includes('M22.56 12.25'));
check('botao "Configurar IA" no cabecalho', byText('button', /Configurar IA/i).length > 0);
check('sem login e sem nuvem no painel', !/Entrar com|OneDrive|Drive Vinculado/i.test(textoPainel) && byText('button', /^Entrar$/).length === 0);

// ---- configuracao de IA
const cfgBtn = byText('button', /Configurar IA/i)[0];
await click(cfgBtn, 500);
const radios = [...w.document.querySelectorAll('input[type=radio][name="labirinto-ai-provider"]')];
check('modal lista provedores', radios.length >= 9, radios.length + ' provedores');
const modalTxt = w.document.body.textContent || '';
check('provedores pedidos presentes', ['Gemini','ChatGPT','Claude','DeepSeek','OpenRouter','Copilot','Gratuito'].every(n => modalTxt.includes(n)));
check('passo a passo visivel', /Como obter o acesso/.test(modalTxt));

// nada expandido ao abrir
const detalhesVisiveis = () => [...w.document.querySelectorAll('button')].filter(b => /^Ocultar/.test(b.textContent || '')).length;
check('nenhum provedor expandido ao abrir', detalhesVisiveis() === 0);

// seleciona Claude: seleciona sem expandir
const linhaClaude = [...w.document.querySelectorAll('div')].filter(d => /^Anthropic \(Claude\)/.test((d.textContent||'').trim()))[0];
if (linhaClaude) await click(linhaClaude, 300);
check('selecionar nao expande', linhaClaude.querySelector('input[type=radio]').checked === true && detalhesVisiveis() === 0);
check('linha mostra o modelo fechada', /Modelo: claude/.test(linhaClaude.textContent || ''));

// botao Detalhes expande e oculta
const btnDetalhes = [...linhaClaude.querySelectorAll('button')].find(b => /Detalhes/.test(b.textContent || ''));
if (btnDetalhes) await click(btnDetalhes, 300);
const painelClaude = linhaClaude.querySelector('input[type=password]').parentElement.parentElement;
check('botao "Detalhes" expande os campos', detalhesVisiveis() === 1 && painelClaude.style.display === 'block');
const btnOcultar = [...linhaClaude.querySelectorAll('button')].find(b => /Ocultar/.test(b.textContent || ''));
check('botao vira "Ocultar" quando aberto', !!btnOcultar);
if (btnOcultar) await click(btnOcultar, 300);
check('botao "Ocultar" fecha os campos', detalhesVisiveis() === 0);
if (btnDetalhes) await click(btnDetalhes, 300);
const campoChave = linhaClaude ? linhaClaude.querySelector('input[type=password]') : null;
if (campoChave) { campoChave.value = 'sk-ant-TESTE'; campoChave.dispatchEvent(new w.Event('input', { bubbles: true })); }
const salvar = byText('button', /^Salvar$/)[0];
if (salvar) await click(salvar, 400);
const saved = JSON.parse(w.localStorage.getItem('labirinto_ai_config_v1') || '{}');
check('chave salva no navegador', saved?.providers?.anthropic?.key === 'sk-ant-TESTE', saved?.active);
check('provedor ativo gravado', saved?.active === 'anthropic');

// ---- geracao com Claude
const gerar = async () => {
  const resp = await w.fetch('/api/generate-diagram', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'processo de compras', complexities: ['simples'], allowedShapeTypes: ['start','process','end'] }),
  });
  const rd = resp.body.getReader(); const dec = new TextDecoder(); let out = '';
  for (;;) { const { done, value } = await rd.read(); if (done) break; out += dec.decode(value, { stream: true }); }
  return out.trim().split('\n').filter(Boolean);
};
let linhas = await gerar();
const claudeCall = calls.filter(c => c.url.includes('anthropic')).pop();
check('Claude: endpoint e cabecalhos corretos', !!claudeCall && claudeCall.init.headers['x-api-key'] === 'sk-ant-TESTE' && claudeCall.init.headers['anthropic-dangerous-direct-browser-access'] === 'true');
check('Claude: streaming vira JSONL', linhas.length === 2 && linhas.every(l => { try { JSON.parse(l); return true; } catch { return false; } }));

// ---- troca para o modo gratuito (sem chave) e gera de novo
w.LabirintoAI.setActive('free');
linhas = await gerar();
const freeCall = calls.filter(c => c.url.includes('pollinations')).pop();
check('modo gratuito nao envia Authorization', !!freeCall && !freeCall.init.headers.Authorization);
check('cota esgotada: cai para a alternativa automatica', pollCalls.length >= 2, pollCalls.length + ' tentativas');
check('modo gratuito ainda devolve JSONL', linhas.length === 2, linhas.join(' | '));
const corpo = pollCalls[0] ? pollCalls[0].body : {};
const promptEnviado = JSON.stringify(corpo);
check('prompt do servidor preservado', promptEnviado.includes('JSON Lines'));
check('regra do losango vai fixa no prompt', /losango/i.test(promptEnviado) && /pelo menos duas arestas|NO M\\u00cdNIMO 2 arestas|MÍNIMO 2 arestas/i.test(promptEnviado), 'ok');
check('par padrao Sim/Nao no prompt', promptEnviado.includes('"Sim" e "Não"') || promptEnviado.includes('Sim') && promptEnviado.includes('Não'));

// ---- editor: versoes
const novo = byText('button', /Novo Fluxo/i)[0];
if (novo) await click(novo, 2500);
const pills = byText('button', /^(simples|normal|detalhado)$/i);
check('as tres versoes aparecem no editor', pills.length === 3, pills.map(p => p.textContent).join(', '));
const simples = pills.find(p => /simples/i.test(p.textContent));
if (simples) await click(simples, 900);
const ativo = byText('button', /^(simples|normal|detalhado)$/i).find(p => /bg-white text-blue-700/.test(p.className));
check('troca de versao funciona', !!ativo && /simples/i.test(ativo.textContent || ''), ativo?.textContent);

const abrirMenuExport = async () => { const b = byText('button', /^Exportar$/i)[0]; if (b) await click(b, 500); };

// ---- copiar fluxo de outro arquivo e colar aqui
const FLUXO = JSON.stringify({
  app: 'Labirinto Fluxogramas', type: 'labirinto-flow-clip', version: 1, copiedAt: new Date().toISOString(),
  source: { title: 'Fluxo de Compras', version: 'normal' },
  nodes: [
    { id: 'a1', type: 'process', position: { x: 0, y: 0 }, data: { label: 'Etapa Importada Alfa' } },
    { id: 'a2', type: 'process', position: { x: 0, y: 160 }, data: { label: 'Etapa Importada Beta' } },
  ],
  edges: [{ id: 'e1', source: 'a1', target: 'a2' }],
});
const setReactValue = (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
};
const contarLabel = (txt) => (w.document.body.textContent.match(new RegExp(txt, 'g')) || []).length;

await abrirMenuExport();
const itemTrazer = byText('button', /Trazer fluxo de outro arquivo/i)[0];
check('menu tem "Trazer fluxo de outro arquivo"', !!itemTrazer);
if (itemTrazer) await click(itemTrazer, 700);
check('janela de trazer fluxo abre com as tres origens', /Diagramas salvos/.test(w.document.body.textContent) && /Colar texto/.test(w.document.body.textContent));
const abaTexto = byText('button', /^Colar texto$/i)[0];
if (abaTexto) await click(abaTexto, 400);
const area = w.document.querySelector('textarea');
if (area) setReactValue(area, FLUXO);
await new Promise(r => setTimeout(r, 200));
const btnLer = byText('button', /Ler fluxo do texto/i)[0];
if (btnLer) await click(btnLer, 500);
const versaoBtn = byText('button', /conteúdo colado/i)[0];
check('fluxo lido mostra a versao com contagem', !!versaoBtn && /2 etapas/.test(versaoBtn.textContent || ''), versaoBtn?.textContent?.trim());
if (versaoBtn) await click(versaoBtn, 1200);
check('fluxo trazido aparece no canvas', contarLabel('Etapa Importada Alfa') >= 1, 'ocorrencias: ' + contarLabel('Etapa Importada Alfa'));

// Ctrl+C copia a versao inteira para a area compartilhada
w.document.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
await new Promise(r => setTimeout(r, 500));
const clip = JSON.parse(w.localStorage.getItem('labirinto_flow_clip_v1') || '{}');
check('Ctrl+C grava o fluxo na area compartilhada', clip.type === 'labirinto-flow-clip' && clip.nodes.length === 2, (clip.nodes || []).length + ' etapas');
check('recorte guarda a origem', clip.source && /Sem Título|Diagrama/.test(clip.source.title || ''), clip.source?.version);

// colar pelo evento nativo (sem pedir permissao de leitura)
const antesEvento = contarLabel('Etapa Importada Alfa');
const evPaste = new w.Event('paste', { bubbles: true, cancelable: true });
evPaste.clipboardData = { getData: () => FLUXO };
w.document.body.dispatchEvent(evPaste);
await new Promise(r => setTimeout(r, 1200));
check('evento nativo de colar traz o fluxo', contarLabel('Etapa Importada Alfa') > antesEvento, antesEvento + ' -> ' + contarLabel('Etapa Importada Alfa'));

// Ctrl+V cola de volta, com IDs novos e sem sobrepor
const antesAlfa = contarLabel('Etapa Importada Alfa');
w.document.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }));
await new Promise(r => setTimeout(r, 1200));
check('Ctrl+V cola o fluxo copiado', contarLabel('Etapa Importada Alfa') > antesAlfa, antesAlfa + ' -> ' + contarLabel('Etapa Importada Alfa'));
check('colar nao pede permissao de leitura do clipboard', leiturasClipboard === 0, leiturasClipboard + ' leituras');

// evento nativo de colar (Ctrl+V do sistema) tambem funciona, sem permissao
const antesGama = contarLabel('Etapa Externa Gama');
const evtPaste = new w.Event('paste', { bubbles: true, cancelable: true });
evtPaste.clipboardData = { getData: () => JSON.stringify({
  type: 'labirinto-flow-clip', app: 'x', version: 1, copiedAt: '',
  nodes: [{ id: 'g1', type: 'process', position: { x: 0, y: 0 }, data: { label: 'Etapa Externa Gama' } }],
  edges: [],
}) };
w.document.body.dispatchEvent(evtPaste);
await new Promise(r => setTimeout(r, 1200));
check('evento nativo de colar traz fluxo de fora', contarLabel('Etapa Externa Gama') > antesGama);
check('ainda sem permissao de clipboard', leiturasClipboard === 0);

const idsUnicos = new Set([...w.document.querySelectorAll('.react-flow__node')].map(n => n.getAttribute('data-id')));
check('nenhum ID repetido depois da colagem', idsUnicos.size === [...w.document.querySelectorAll('.react-flow__node')].length, idsUnicos.size + ' nos');

check('nunca le a area de transferencia (sem pedido de permissao)', leiturasClipboard === 0, leiturasClipboard + ' leituras');
check('copiar usa a escrita do clipboard', escritasClipboard > 0, escritasClipboard + ' escritas');

// ---- redimensionar nao deve deformar a forma
const nodeEls = [...w.document.querySelectorAll('.react-flow__node')];
const alvoId = nodeEls[0]?.getAttribute('data-id');
const lerNo = (id) => {
  const diags = JSON.parse(w.localStorage.getItem('labirinto_local_diagrams') || '[]');
  for (const d of diags) {
    for (const v of Object.values(d.versions || {})) {
      const achado = (v.nodes || []).find((n) => n.id === id);
      if (achado) return achado;
    }
  }
  return null;
};
w.dispatchEvent(new w.CustomEvent('flow-node-resize-end', { detail: { id: alvoId, width: 320, height: 260 } }));
await new Promise(r => setTimeout(r, 1200));
const noRedim = lerNo(alvoId);
check('redimensionar guarda o tamanho no no', !!noRedim && noRedim.style?.width === 320 && noRedim.style?.height === 260, JSON.stringify(noRedim?.style || {}));
check('tamanho nao entra em styleOverride', !!noRedim && noRedim.data.styleOverride.width === undefined && noRedim.data.styleOverride.height === undefined, JSON.stringify(noRedim?.data?.styleOverride || {}));
const rotuloComTamanho = [...w.document.querySelectorAll('.react-flow__node [style*="width: 320px"], .react-flow__node [style*="height: 260px"]')].length;
check('rotulo nao vira bloco do tamanho da forma', rotuloComTamanho === 0, rotuloComTamanho + ' elementos');

// ---- copiar estilo nao pode carregar o tamanho junto
w.dispatchEvent(new w.CustomEvent('flow-copy-style', { detail: { style: { backgroundColor: '#fde68a', borderColor: '#f59e0b', width: 999, height: 999 } } }));
const outroId = nodeEls[1]?.getAttribute('data-id') || alvoId;
w.dispatchEvent(new w.CustomEvent('flow-paste-style', { detail: { nodeId: outroId } }));
await new Promise(r => setTimeout(r, 1200));
const noEstilo = lerNo(outroId);
check('colar estilo aplica as cores', noEstilo?.data?.styleOverride?.backgroundColor === '#fde68a');
check('colar estilo nao redimensiona a forma', noEstilo?.data?.styleOverride?.width === undefined, JSON.stringify(noEstilo?.data?.styleOverride || {}));

// ---- assistente mostra qual IA esta selecionada
const botaoIA = w.document.querySelector('button[title="Assistente IA - Geração de Fluxos"]');
if (botaoIA) await click(botaoIA, 900);
let modalIA = w.document.body.textContent || '';
check('assistente mostra a IA selecionada', /IA selecionada: Gratuito \(Pollinations\)/.test(modalIA), (modalIA.match(/IA selecionada: [^•]{0,40}/) || [''])[0].trim());
check('assistente mostra o modelo', /Modelo: openai/.test(modalIA));
const seletorArquivos = w.document.getElementById('ai-file-upload');
const aceita = seletorArquivos ? seletorArquivos.getAttribute('accept') : '';
check('anexo aceita planilhas do Excel', /\.xlsx/.test(aceita) && /\.csv/.test(aceita), aceita);
const btnTrocar = [...w.document.querySelectorAll('button')].find(b => /^Trocar$/.test(b.textContent || ''));
check('botao "Trocar" no assistente', !!btnTrocar);

// troca de provedor e reabre: a faixa acompanha
const cancelar = [...w.document.querySelectorAll('button')].find(b => /^Cancelar$/.test(b.textContent || ''));
if (cancelar) await click(cancelar, 500);
w.LabirintoAI.setActive('anthropic');
if (botaoIA) await click(botaoIA, 900);
modalIA = w.document.body.textContent || '';
check('faixa acompanha a troca de provedor', /IA selecionada: Anthropic \(Claude\)/.test(modalIA));
check('provedor com chave aparece como pronto', !/Sem chave cadastrada/.test(modalIA));
w.LabirintoAI.setActive('free');
const cancelar2 = [...w.document.querySelectorAll('button')].find(b => /^Cancelar$/.test(b.textContent || ''));
if (cancelar2) await click(cancelar2, 500);

// ---- exportacoes e fallback de download
const downloads = [];
const prevClick = w.HTMLAnchorElement.prototype.click;
w.HTMLAnchorElement.prototype.click = function (...a) {
  if (this.hasAttribute('download') && !this.dataset.labirintoFallback) downloads.push(this.getAttribute('download'));
  return prevClick.apply(this, a);
};
const abrirMenu = abrirMenuExport;
const opcao = async (re) => { const o = byText('button', re)[0]; if (o) await click(o, 800); };
await abrirMenu(); await opcao(/Exportar Backup/i);
await abrirMenu(); await opcao(/Diagrams\.net|Draw\.io/i);
await abrirMenu(); await opcao(/BPMN/i);
check('exportacoes .json/.drawio/.bpmn baixam arquivo', ['json','drawio','bpmn'].every(ext => downloads.some(d => d.endsWith('.' + ext))), downloads.join(', ') || 'nenhum');
await new Promise(r => setTimeout(r, 800));
const fallbacks = w.document.querySelectorAll('[data-labirinto-toasts] a[download]').length;
check(EMBEDDED ? 'link alternativo de download no iframe' : 'sem link extra fora do iframe', EMBEDDED ? fallbacks === 3 : fallbacks === 0, String(fallbacks));

// ---- compartilhar sem Google
const compartilhar = byText('button', /^Compartilhar$/i)[0];
if (compartilhar) await click(compartilhar, 700);
const shareTxt = w.document.body.textContent || '';
check('compartilhamento sem nuvem/Google', /Sem conta e sem nuvem/.test(shareTxt) && !/Google Drive/i.test(shareTxt));
const htmlApp = w.document.body.innerHTML;
check('nenhuma opcao de salvar em nuvem sobrou', !/OneDrive|Google Drive/i.test(htmlApp));

// ---- backup das chaves
const btnBackup = (re) => [...w.document.querySelectorAll('button')].filter(b => re.test(b.textContent || ''));
w.LabirintoAI.openSettings();
await new Promise(r => setTimeout(r, 300));
check('secao de backup na janela', btnBackup(/Exportar sem senha/).length === 1 && btnBackup(/Importar arquivo/).length === 1 && btnBackup(/Exportar com senha/).length === 1);

// exportacao sem senha (round-trip)
const semSenha = await w.LabirintoAI.exportKeys();
const arq = JSON.parse(semSenha);
check('arquivo exportado tem as chaves', arq.type === 'labirinto-ai-keys' && arq.encrypted === false && arq.config.providers.anthropic.key === 'sk-ant-TESTE');

// apaga tudo e importa de volta
w.localStorage.removeItem('labirinto_ai_config_v1');
w.location.reload; // no-op: limpamos apenas o armazenamento
const antes = JSON.stringify(w.LabirintoAI.getConfig());
await w.LabirintoAI.importKeys(semSenha);
const depois = w.LabirintoAI.getConfig();
check('importacao restaura as chaves', depois.providers.anthropic.key === 'sk-ant-TESTE', 'ativo: ' + depois.active);

// exportacao com senha
let comSenha = null, erroCripto = '';
try { comSenha = await w.LabirintoAI.exportKeys('minhasenha123'); } catch (e) { erroCripto = String(e.message || e); }
if (comSenha) {
  const arq2 = JSON.parse(comSenha);
  check('arquivo com senha vem cifrado', arq2.encrypted === true && !comSenha.includes('sk-ant-TESTE') && !!arq2.kdf && !!arq2.cipher);
  let recusou = false;
  try { await w.LabirintoAI.importKeys(comSenha, 'senhaerrada'); } catch { recusou = true; }
  check('senha errada e recusada', recusou);
  await w.LabirintoAI.importKeys(comSenha, 'minhasenha123');
  check('senha certa restaura as chaves', w.LabirintoAI.getConfig().providers.anthropic.key === 'sk-ant-TESTE');
} else {
  check('criptografia indisponivel tratada com mensagem', /https|criptografar/i.test(erroCripto), erroCripto.slice(0, 60));
}
[...w.document.querySelectorAll('button')].filter(b => /^Fechar$/.test(b.textContent || '')).forEach(b => b.click());

// ---- todas as alternativas gratuitas falham: mensagem util + atalho
w.LabirintoAI.setActive('free');
globalThis.forceFreeFail = true;
let erroMsg = '';
try { await gerar(); } catch (e) { erroMsg = String(e.message || e); }
globalThis.forceFreeFail = false;
// o app avisa pela propria pagina, nunca pela caixa do navegador
const antesToasts = w.document.querySelectorAll('[data-labirinto-toasts] > div').length;
w.alert('Erro ao gerar com IA: A IA gratuita não conseguiu responder. Abra "Configurar IA".');
const depoisToasts = w.document.querySelectorAll('[data-labirinto-toasts] > div').length;
check('alert do navegador foi substituido', alertNativo === 0 && depoisToasts === antesToasts + 1);
const avisoTxt = [...w.document.querySelectorAll('[data-labirinto-toasts] > div')].pop().textContent || '';
check('aviso interno sem prefixo tecnico', !/^Erro ao gerar com IA:/.test(avisoTxt), avisoTxt.slice(0, 45));
check('aviso interno traz botao de acao', /Configurar IA/.test(avisoTxt));

check('erro sem JSON cru na tela', !!erroMsg && !/Payment Required|deprecation_notice/.test(erroMsg), erroMsg.slice(0, 70));
check('erro orienta a trocar de provedor', /Configurar IA/.test(erroMsg) && /Gemini|OpenRouter/.test(erroMsg));
check('erro informa quantas alternativas foram tentadas', /tentei \d+ alternativas/.test(erroMsg));
w.alert('Erro ao gerar com IA: ' + erroMsg);
await new Promise(r => setTimeout(r, 200));
const botaoAviso = [...w.document.querySelectorAll('[data-labirinto-toasts] button')].find(b => /Configurar IA/.test(b.textContent || ''));
check('aviso traz botao "Configurar IA"', !!botaoAviso);
if (botaoAviso) { await click(botaoAviso, 400); }
check('botao abre a janela de configuracao', w.document.querySelectorAll('input[type=radio][name="labirinto-ai-provider"]').length >= 9);

console.log((EMBEDDED ? '[MODO EMBUTIDO]' : '[MODO NORMAL]'));
console.log(R.join('\n'));
console.log('--- erros ---');
console.log(errors.slice(0, 6).join('\n') || '(nenhum)');
