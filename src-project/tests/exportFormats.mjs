import { generateDrawioXml, generateBpmnXml } from '../.tmp-exportFormats.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

// Um decisão com um losango, um raia por trás (setor) e uma linha manual com
// cotovelo — o mesmo tipo de diagrama que quebrava ao abrir no Draw.io.
const nodes = [
  { id: 'lane1', type: 'swimlane', position: { x: 0, y: 0 }, style: { width: 800, height: 300 }, data: { label: 'Atendimento' } },
  { id: 'n1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Início' } },
  { id: 'n2', type: 'decision', position: { x: 100, y: 200 }, data: { label: 'Aprovado?', styleOverride: { backgroundColor: '#fef9c3', borderColor: '#eab308' } } },
  { id: 'n3', type: 'document', position: { x: 400, y: 200 }, data: { label: 'Emitir Nota Fiscal & Recibo' } },
  { id: 'j1', type: 'junction', position: { x: 250, y: 250 }, data: { anchorX: 250, anchorY: 250 } },
];

const edges = [
  {
    id: 'e1', source: 'n2', target: 'n3', label: 'Sim',
    sourceHandle: 'right', targetHandle: 'left',
    type: 'smoothstep', style: { stroke: '#0f172a', strokeWidth: 2 },
    data: { controlPoints: [{ x: 300, y: 200 }, { x: 300, y: 260 }] },
  },
  { id: 'e2', source: 'n1', target: 'n2', type: 'smoothstep', style: { stroke: '#0f172a' }, data: {} },
];

const drawio = generateDrawioXml(nodes, edges);

check('xml bem formado (abre e fecha mxfile)', drawio.startsWith('<?xml') && drawio.endsWith('</mxfile>'));
check('raia vira swimlane nativa do mxGraph', /id="lane1"[^>]*style="swimlane;/.test(drawio));
check('raia usa o tamanho real (800x300), nao 140x70', /id="lane1"[\s\S]*?<mxGeometry x="0" y="0" width="800" height="300"/.test(drawio));
check('raia aparece ANTES dos nos no xml (fica atras no mxGraph)', drawio.indexOf('id="lane1"') < drawio.indexOf('id="n1"'));
check('inicio vira forma arredondada (pilula)', /id="n1"[^>]*style="rounded=1;arcSize=50;/.test(drawio));
check('decisao vira losango (rhombus)', /id="n2"[^>]*style="rhombus;/.test(drawio));
check('decisao usa o tamanho real do losango (210x110)', /id="n2"[\s\S]*?width="210" height="110"/.test(drawio));
check('cor de fundo da decisao é preservada', /id="n2"[^>]*fillColor=#fef9c3;/.test(drawio));
check('documento vira a forma nativa "document"', /id="n3"[^>]*shape=document/.test(drawio));
check('label com & e aspas nao quebra o xml', (() => {
  const n = [{ id: 'nx', type: 'process', position: { x: 0, y: 0 }, data: { label: 'Receber & Conferir "Pedido"' } }];
  const xml = generateDrawioXml(n, []);
  return xml.includes('value="Receber &amp; Conferir &quot;Pedido&quot;"');
})());
check('junção vira um pontinho, não um retângulo', /id="j1"[^>]*style="ellipse;/.test(drawio));
check('aresta leva o lado de saida/entrada (exit/entry)', /id="e1"[^>]*style="[^"]*exitX=1;exitY=0.5;[^"]*entryX=0;entryY=0.5;/.test(drawio));
check('aresta manual leva os pontos de dobra (waypoints)', /id="e1".*?<mxPoint x="300" y="200"\/><mxPoint x="300" y="260"\/>/.test(drawio));
check('aresta sem controlPoints não gera Array de pontos vazio', !/id="e2".*?<Array as="points">/.test(drawio));

const bpmn = generateBpmnXml(nodes, edges);
check('bpmn bem formado', bpmn.startsWith('<?xml') && bpmn.endsWith('</bpmn:definitions>'));
check('bpmn tem a seção de diagrama (BPMN DI) com posição real', /<bpmndi:BPMNShape id="n2_di"[^>]*><dc:Bounds x="100" y="200" width="50" height="50"/.test(bpmn));
check('bpmn não inclui raia/quadro como elemento de processo', !bpmn.includes('id="lane1"'));
check('bpmn gateway para a decisão', /<bpmn:exclusiveGateway id="n2"/.test(bpmn));
check('bpmn edge tem waypoints', /<bpmndi:BPMNEdge id="e1_di"[^>]*><di:waypoint/.test(bpmn));

console.log(R.join('\n'));
