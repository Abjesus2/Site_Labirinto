import { applyGeneratedJsonlLine, parseGeneratedBlock, repairGeneratedVersion, fixDecisionExits } from '../.tmp-aiParser.mjs';

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

// 4b. Campo "notes" (contexto extra do nível 'detalhado': sistema usado,
//     responsável, critério da decisão, entradas/saídas) é preservado no
//     timing do nó, igual ao "department" já era.
{
  const rawGenerated = { detalhado: { nodes: [], edges: [] } };
  applyGeneratedJsonlLine(
    '{"version": "detalhado", "node": {"id": "d1", "label": "Conferência Fiscal", "type": "process", "department": "Faturamento", "notes": "Sistema: ERP Fiscal. Responsável: Analista. Critério: divergência acima de 5% escala para o supervisor."}}',
    rawGenerated,
    ['process'],
    fallbackMap,
  );
  check(
    'notes do nó detalhado chega no timing',
    rawGenerated.detalhado.nodes[0].data.timing.notes === 'Sistema: ERP Fiscal. Responsável: Analista. Critério: divergência acima de 5% escala para o supervisor.',
  );
}
{
  const rawGenerated = { normal: { nodes: [], edges: [] } };
  applyGeneratedJsonlLine('{"version": "normal", "node": {"id": "n1", "label": "Sem notes", "type": "process"}}', rawGenerated, ['process'], fallbackMap);
  check('nó sem notes vira string vazia (não undefined)', rawGenerated.normal.nodes[0].data.timing.notes === '');
}

// 4. Versão que não foi pedida é ignorada silenciosamente, sem lançar erro
{
  const rawGenerated = { normal: { nodes: [], edges: [] } };
  applyGeneratedJsonlLine('{"version": "detalhado", "node": {"id": "n1", "label": "x", "type": "process"}}', rawGenerated, ['process'], fallbackMap);
  check('versao nao selecionada nao aparece em lugar nenhum', Object.keys(rawGenerated).length === 1 && rawGenerated.normal.nodes.length === 0);
}

// 5. Variações de formato que modelos mais fracos costumam mandar
{
  const rawGenerated = { detalhado: { nodes: [], edges: [] } };
  applyGeneratedJsonlLine('{"version": "Detalhado", "node": {"id": "d1", "label": "A", "type": "process"}}', rawGenerated, ['process'], fallbackMap);
  applyGeneratedJsonlLine('{"version": "detailed", "edge": {"from": "d1", "to": "d2"}}', rawGenerated, ['process'], fallbackMap);
  check('versao com maiuscula/ingles cai na versao certa', rawGenerated.detalhado.nodes.length === 1 && rawGenerated.detalhado.edges.length === 1);
  check('aresta com from/to vira source/target', rawGenerated.detalhado.edges[0].source === 'd1' && rawGenerated.detalhado.edges[0].target === 'd2');
}

// 6. IA que marca isDubious em quase tudo (cópia do exemplo): marcação removida
{
  const nodes = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, type: 'process', data: {} }));
  const mk = (s, t) => ({ id: s + t, source: s, target: t, label: 'Analise Conexão', style: { stroke: '#ef4444' }, data: { isDubious: true } });
  const out = repairGeneratedVersion({ nodes, edges: [mk('a', 'b'), mk('b', 'c'), mk('c', 'd'), mk('d', 'e')] });
  check('dubious em massa é desmarcado', out.edges.every((e) => !e.data.isDubious && e.style.stroke === '#0f172a' && e.label === ''), JSON.stringify(out.edges[0]));
  check('relata quantas foram desmarcadas', out.report.clearedDubious === 4);

  const poucas = repairGeneratedVersion({
    nodes,
    edges: [mk('a', 'b'), { id: 'x', source: 'b', target: 'c', data: {} }, { id: 'y', source: 'c', target: 'd', data: {} }, { id: 'z', source: 'd', target: 'e', data: {} }],
  });
  check('uma duvida real isolada continua marcada', poucas.edges[0].data.isDubious === true && poucas.report.clearedDubious === 0);

  const semLigacao = repairGeneratedVersion({ nodes, edges: [{ id: 'q', source: 'a', target: 'nao_existe', data: {} }] });
  check('detecta versao sem nenhuma ligacao valida (resposta cortada)', semLigacao.report.missingEdges === true && semLigacao.report.droppedEdges === 1);

  const caixa = repairGeneratedVersion({ nodes, edges: [{ id: 'k', source: 'A ', target: 'b', data: {} }] });
  check('id que so difere em maiuscula/espaco e casado', caixa.edges.length === 1 && caixa.edges[0].source === 'a');
}

// 7. Losango com uma saída só ganha "Sim" + "Não" (vermelho, para validar)
{
  const nodes = [
    { id: 'p1', type: 'process' },
    { id: 'q', type: 'decision' },
    { id: 'p2', type: 'process' },
    { id: 'fim', type: 'end' },
  ];
  const edges = [
    { id: '1', source: 'p1', target: 'q', label: '' },
    { id: '2', source: 'q', target: 'p2', label: '' },
    { id: '3', source: 'p2', target: 'fim', label: '' },
  ];
  const out = fixDecisionExits(nodes, edges);
  const saidas = out.filter((e) => e.source === 'q');
  check('losango passa a ter 2 saídas', saidas.length === 2);
  check('saída existente vira "Sim"', saidas.some((e) => e.target === 'p2' && e.label === 'Sim'));
  check('nova saída "Não" volta para a etapa anterior, marcada para validar', saidas.some((e) => e.target === 'p1' && e.label === 'Não' && e.data.isDubious === true));

  const ok = fixDecisionExits(nodes, [...edges, { id: '4', source: 'q', target: 'fim', label: 'Não' }]);
  check('losango que já tem 2 saídas não é mexido', ok.length === 4);
}

console.log(R.join('\n'));
