import { compactTextToJsonl, compactLineToJsonl, newCompactState, compactStreamToJsonl, toCompactReference } from '../.tmp-compactFormat.mjs';
import { applyGeneratedJsonlLine } from '../.tmp-aiParser.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const compacto = [
  'V|normal',
  'N|n1|start|Início do Recebimento|0|Recebimento',
  'N|n2|process|Conferir a Nota Fiscal|15|Recebimento|2|5',
  'N|n3|decision|Nota confere?|0|Recebimento',
  'N|n4|process|Armazenar os Volumes|20,5|Estoque',
  'N|n5|process|Lançar no Financeiro|10|Financeiro||||3|Conferir CFOP antes de lançar',
  'E|n1|n2|',
  'E|n2|n3',
  'E|n3|n4|Sim',
  'E|n3|n2|Não|?',
  'texto solto que a IA escreveu',
].join('\n');
const jsonl = compactTextToJsonl(compacto).split('\n').map((l) => JSON.parse(l));
const nos = jsonl.filter((l) => l.node).map((l) => l.node);
const ligs = jsonl.filter((l) => l.edge).map((l) => l.edge);
check('converte etapas com todos os campos (inclusive outros tempos e observações)', nos.length === 5 && nos[4].otherExtraTime === 3 && nos[4].notes === 'Conferir CFOP antes de lançar' && nos[1].setupTime === 2 && nos[1].waitTime === 5 && nos[1].department === 'Recebimento' && nos[3].duration === 20.5, JSON.stringify(nos[1]));
check('converte ligações com rótulo', ligs.length === 4 && ligs[2].label === 'Sim' && !ligs[0].label && !ligs[1].label);
check('"?" no fim marca a ligação para validar (isDubious)', ligs[3].isDubious === true && ligs[3].label === 'Não' && !ligs[2].isDubious);
check('todas as linhas na versão certa; texto solto ignorado', jsonl.every((l) => l.version === 'normal') && jsonl.length === 9);
const st = newCompactState(); st.version = 'simples';
check('linha que já vem em JSON passa direto', compactLineToJsonl('{"version":"simples","node":{"id":"a"}}', st) === '{"version":"simples","node":{"id":"a"}}');
check('sem "V|" antes, nada é inventado', compactTextToJsonl('N|x|process|Etapa|1') === '');

// Mesmo resultado no parser do app que o JSONL normal.
const buckets = { normal: { nodes: [], edges: [] } };
compactTextToJsonl(compacto).split('\n').forEach((l) => applyGeneratedJsonlLine(l, buckets, ['start', 'end', 'process', 'decision'], (t) => 'process'));
check('o app lê o resultado igual ao formato normal', buckets.normal.nodes.length === 5 && buckets.normal.edges.length === 4 && buckets.normal.nodes[4].data.timing.notes === 'Conferir CFOP antes de lançar' && buckets.normal.nodes[3].data.timing.department === 'Estoque' && buckets.normal.edges[3].data.isDubious === true);

// Streaming em pedaços que cortam linhas no meio.
const partes = [compacto.slice(0, 37), compacto.slice(37, 120), compacto.slice(120)];
const enc = new TextEncoder();
const entrada = new ReadableStream({ start(c) { partes.forEach((p) => c.enqueue(enc.encode(p))); c.close(); } });
const saida = await new Response(compactStreamToJsonl(entrada)).text();
check('streaming em pedaços dá o mesmo resultado', saida.trim() === compactTextToJsonl(compacto).trim());

// Referência compacta das versões já geradas.
const ref = toCompactReference({ detalhado: { nodes: [{ id: 'd1', type: 'start', data: { label: 'Início', timing: { duration: 0, department: 'Recebimento' } } }, { id: 'L', type: 'swimlane', data: {} }], edges: [{ source: 'd1', target: 'd2', label: 'Sim' }] }, normal: { nodes: [], edges: [] } });
check('referência compacta (sem raias, sem versão vazia)', ref === 'V|detalhado\nN|d1|start|Início|0|Recebimento\nE|d1|d2|Sim', JSON.stringify(ref));
const tam = (s) => s.length;
const jsonlNormal = compactTextToJsonl(compacto);
check('formato compacto bem menor que o JSONL', tam(compacto) < tam(jsonlNormal) * 0.5, `${tam(compacto)} vs ${tam(jsonlNormal)}`);

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
