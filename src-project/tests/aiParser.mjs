import { applyGeneratedJsonlLine, parseGeneratedBlock } from '../.tmp-aiParser.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const fallbackMap = (requestedType, allowed) => allowed[0] || 'process';

// 1. Resposta "limpa" de streaming, linha a linha
{
  const rawGenerated = { normal: { nodes: [], edges: [] } };
  const p1 = applyGeneratedJsonlLine('{"progress": 10}', rawGenerated, ['start', 'process', 'end'], fallbackMap);
  applyGeneratedJsonlLine('{"version": "normal", "node": {"id": "n1", "label": "Início", "type": "start"}}', rawGenerated, ['start', 'process', 'end'], fallbackMap);
  applyGeneratedJsonlLine('{"version": "normal", "node": {"id": "n2", "label": "Processar Pedido", "type": "process", "department": "Vendas"}}', rawGenerated, ['start', 'process', 'end'], fallbackMap);
  applyGeneratedJsonlLine('{"version": "normal", "edge": {"source": "n1", "target": "n2"}}', rawGenerated, ['start', 'process', 'end'], fallbackMap);
  check('progress da linha volta certo', p1 === 10);
  check('nos da versao certa entram', rawGenerated.normal.nodes.length === 2);
  check('aresta entra', rawGenerated.normal.edges.length === 1);
  check('department preservado no node', rawGenerated.normal.nodes[1].data.timing.department === 'Vendas');
}

// 2. Texto colado de um chat de IA qualquer: cercas de bloco de código,
//    frase de abertura/fechamento e uma vírgula sobrando não podem quebrar o resto.
{
  const colado = [
    'Claro! Aqui está o fluxograma que você pediu:',
    '```json',
    '{"progress": 10}',
    '{"version": "normal", "node": {"id": "n1", "label": "Início", "type": "start"}}',
    '{"version": "normal", "node": {"id": "n2", "label": "Aprovar Solicitação", "type": "decision"}}',
    '{"version": "normal", "edge": {"source": "n1", "target": "n2", "label": "Sim"}}',
    'isso não é json nenhum, só uma frase solta no meio',
    '{"progress": 100}',
    '```',
    'Espero que ajude!',
  ].join('\n');

  const { rawGenerated, nodeCount, edgeCount } = parseGeneratedBlock(colado, ['normal'], ['start', 'decision', 'process'], fallbackMap);
  check('ignora cercas de bloco de codigo e frases soltas', nodeCount === 2 && edgeCount === 1);
  check('losango recebe cor padrao de decisao', rawGenerated.normal.nodes[1].data.styleOverride.backgroundColor === '#fef9c3');
}

// 3. Forma que a IA inventou (não existe em lugar nenhum do app) cai no mapa
//    de substituição, não quebra o parsing.
{
  const rawGenerated = { normal: { nodes: [], edges: [] } };
  applyGeneratedJsonlLine('{"version": "normal", "node": {"id": "n1", "label": "Consultar Banco Externo", "type": "forma_que_nao_existe"}}', rawGenerated, ['start', 'process', 'end'], fallbackMap);
  check('forma desconhecida cai no mapa de substituição', rawGenerated.normal.nodes[0].type === 'start');
}

// 4. Versão que não foi pedida é ignorada silenciosamente, sem lançar erro
{
  const rawGenerated = { normal: { nodes: [], edges: [] } };
  applyGeneratedJsonlLine('{"version": "detalhado", "node": {"id": "n1", "label": "x", "type": "process"}}', rawGenerated, ['process'], fallbackMap);
  check('versao nao selecionada nao aparece em lugar nenhum', Object.keys(rawGenerated).length === 1 && rawGenerated.normal.nodes.length === 0);
}

console.log(R.join('\n'));
