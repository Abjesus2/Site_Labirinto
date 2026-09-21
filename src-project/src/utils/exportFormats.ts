/**
 * Exportação para outros aplicativos (.drawio, .bpmn).
 * ------------------------------------------------------
 * A versão anterior gerava toda forma como um retângulo 140x70 e toda
 * aresta sem lado de saída/entrada nem traçado — o resultado abria
 * desorganizado em qualquer outro programa (Draw.io incluso), sem nenhuma
 * relação com o que se via no site. Este módulo usa o tamanho real de cada
 * nó, mapeia cada tipo para a forma nativa mais parecida do mxGraph/BPMN, e
 * carrega o lado da conexão e os pontos de dobra manuais das arestas — para
 * abrir o mais parecido possível com a visualização do app, dentro do que o
 * outro formato permite representar.
 */
import { getNodeDimensions } from '../components/CustomNodes';

interface Point {
  x: number;
  y: number;
}

interface Box extends Point {
  width: number;
  height: number;
}

const xmlEscape = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const getNodeBox = (node: any): Box => {
  const dim = getNodeDimensions(node.type);
  const width = node.measured?.width || node.width || node.style?.width || dim.width;
  const height = node.measured?.height || node.height || node.style?.height || dim.height;
  return { x: node.position.x, y: node.position.y, width, height };
};

/* ------------------------------------------------------------------ */
/* Draw.io (.drawio / mxGraph)                                          */
/* ------------------------------------------------------------------ */

/**
 * Estilo mxGraph por tipo de nó, usando as formas nativas do mxGraph (as
 * mesmas que o Draw.io já entende sem depender de nenhuma biblioteca de
 * stencil extra) mais próximas do desenho de cada forma no app.
 */
const DRAWIO_SHAPE_STYLES: Record<string, string> = {
  start: 'rounded=1;arcSize=50;whiteSpace=wrap;html=1;',
  end: 'rounded=1;arcSize=50;whiteSpace=wrap;html=1;',
  process: 'rounded=1;whiteSpace=wrap;html=1;',
  decision: 'rhombus;whiteSpace=wrap;html=1;',
  document: 'shape=document;whiteSpace=wrap;html=1;boundedLbl=1;',
  database: 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;',
  storeddata: 'rounded=1;whiteSpace=wrap;html=1;',
  internalstorage: 'shape=internalStorage;whiteSpace=wrap;html=1;',
  subprocess: 'shape=process;whiteSpace=wrap;html=1;',
  inputoutput: 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;',
  preparation: 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;',
  manualinput: 'shape=manualInput;whiteSpace=wrap;html=1;',
  manualoperation: 'shape=trapezoid;perimeter=trapezoidPerimeter;whiteSpace=wrap;html=1;',
  display: 'shape=display;whiteSpace=wrap;html=1;',
  delay: 'shape=delay;whiteSpace=wrap;html=1;',
  offpage: 'shape=offPageConnector;whiteSpace=wrap;html=1;',
  circle: 'ellipse;whiteSpace=wrap;html=1;',
  cloud: 'shape=cloud;whiteSpace=wrap;html=1;',
  sticky: 'shape=note;size=20;whiteSpace=wrap;html=1;',
  annotation: 'shape=callout;whiteSpace=wrap;html=1;perimeter=calloutPerimeter;',
  text: 'text;html=1;align=center;verticalAlign=middle;',
  swimlane: 'swimlane;whiteSpace=wrap;html=1;startSize=30;horizontal=1;fillColor=none;',
  frame: 'rounded=1;dashed=1;whiteSpace=wrap;html=1;verticalAlign=top;fontStyle=1;fillColor=none;',
};

const getDrawioNodeStyle = (node: any): string => {
  const base = DRAWIO_SHAPE_STYLES[node.type] || DRAWIO_SHAPE_STYLES.process;
  const override = node.data?.styleOverride || {};
  const parts = [base];
  if (override.backgroundColor) parts.push(`fillColor=${override.backgroundColor};`);
  if (override.borderColor) parts.push(`strokeColor=${override.borderColor};`);
  if (override.color) parts.push(`fontColor=${override.color};`);
  return parts.join('');
};

/** Mapa dos 12 handles reais do app para exitX/exitY (0..1) do mxGraph. */
const HANDLE_TO_UNIT: Record<string, Point> = {
  top: { x: 0.5, y: 0 },
  'top-left-25': { x: 0.25, y: 0 },
  'top-right-75': { x: 0.75, y: 0 },
  bottom: { x: 0.5, y: 1 },
  'bottom-left-25': { x: 0.25, y: 1 },
  'bottom-right-75': { x: 0.75, y: 1 },
  left: { x: 0, y: 0.5 },
  'left-top-25': { x: 0, y: 0.25 },
  'left-bottom-75': { x: 0, y: 0.75 },
  right: { x: 1, y: 0.5 },
  'right-top-25': { x: 1, y: 0.25 },
  'right-bottom-75': { x: 1, y: 0.75 },
};

const getDrawioEdgeStyle = (edge: any): string => {
  const style = edge.style || {};
  const type = edge.type || 'smoothstep';
  const parts = ['html=1;'];
  if (type === 'straight') parts.push('edgeStyle=none;');
  else if (type === 'default') parts.push('curved=1;rounded=0;');
  else parts.push('edgeStyle=orthogonalEdgeStyle;rounded=0;');
  if (style.strokeDasharray) parts.push('dashed=1;');
  parts.push(`strokeColor=${style.stroke || '#0f172a'};`);
  parts.push(`strokeWidth=${style.strokeWidth || 2};`);
  parts.push('endArrow=classic;');

  const exit = edge.sourceHandle ? HANDLE_TO_UNIT[edge.sourceHandle] : null;
  if (exit) parts.push(`exitX=${exit.x};exitY=${exit.y};exitDx=0;exitDy=0;`);
  const entry = edge.targetHandle ? HANDLE_TO_UNIT[edge.targetHandle] : null;
  if (entry) parts.push(`entryX=${entry.x};entryY=${entry.y};entryDx=0;entryDy=0;`);

  return parts.join('');
};

export function generateDrawioXml(nodes: any[], edges: any[]): string {
  // Raias e quadros ficam atrás visualmente no editor (zIndex -1), mas o
  // mxGraph só respeita a ORDEM das células no XML para decidir o que fica
  // por cima — por isso são sempre emitidos primeiro, não importa a posição
  // deles no array de nós.
  const containers = nodes.filter((n) => n.type === 'swimlane' || n.type === 'frame');
  const others = nodes.filter((n) => n.type !== 'swimlane' && n.type !== 'frame');

  let xml = '<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram name="Diagrama" id="diagram-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>';

  const emitNode = (n: any) => {
    if (n.type === 'junction') {
      const p = n.position || { x: 0, y: 0 };
      xml += `<mxCell id="${xmlEscape(n.id)}" value="" vertex="1" parent="1" style="ellipse;fillColor=#0f172a;strokeColor=none;"><mxGeometry x="${p.x - 3}" y="${p.y - 3}" width="6" height="6" as="geometry"/></mxCell>`;
      return;
    }
    const box = getNodeBox(n);
    const label = xmlEscape(n.data?.label || '');
    const style = getDrawioNodeStyle(n);
    xml += `<mxCell id="${xmlEscape(n.id)}" value="${label}" vertex="1" parent="1" style="${style}"><mxGeometry x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" as="geometry"/></mxCell>`;
  };

  containers.forEach(emitNode);
  others.forEach(emitNode);

  edges.forEach((e) => {
    const label = xmlEscape(e.label || '');
    const style = getDrawioEdgeStyle(e);
    // Só grava os pontos de dobra (waypoints absolutos) de arestas que o
    // usuário ajustou manualmente no app (data.manualRouting === true). Para
    // as demais — a maioria, roteadas automaticamente pelo próprio app ao
    // mover formas — gravar esses pontos travava o traçado: como são
    // coordenadas absolutas congeladas no momento da exportação, ao mover
    // qualquer forma dentro do Draw.io a linha passava a ir direto (em
    // diagonal, cortando por cima de tudo) da nova borda da forma até o
    // ponto antigo, em vez de se re-rotear. Sem os pontos, o Draw.io usa só
    // edgeStyle=orthogonalEdgeStyle e os exitX/exitY/entryX/entryY (que são
    // relativos à própria forma, então acompanham ela) para recalcular um
    // traçado ortogonal do zero sempre que algo se move — se comportando
    // como qualquer conector desenhado direto no Draw.io.
    const isManual = e.data?.manualRouting === true;
    const controlPoints: Point[] = isManual && Array.isArray(e.data?.controlPoints) ? e.data.controlPoints : [];
    let geometry = '<mxGeometry relative="1" as="geometry">';
    if (controlPoints.length > 0) {
      geometry +=
        '<Array as="points">' +
        controlPoints.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('') +
        '</Array>';
    }
    geometry += '</mxGeometry>';
    xml += `<mxCell id="${xmlEscape(e.id)}" value="${label}" edge="1" parent="1" source="${xmlEscape(e.source)}" target="${xmlEscape(e.target)}" style="${style}">${geometry}</mxCell>`;
  });

  xml += '</root></mxGraphModel></diagram></mxfile>';
  return xml;
}

/* ------------------------------------------------------------------ */
/* BPMN 2.0 (.bpmn)                                                     */
/* ------------------------------------------------------------------ */

const BPMN_SIZE: Record<string, { width: number; height: number }> = {
  start: { width: 36, height: 36 },
  end: { width: 36, height: 36 },
  decision: { width: 50, height: 50 },
};
const DEFAULT_TASK_SIZE = { width: 140, height: 70 };

function getBpmnElement(node: any): { tag: string; width: number; height: number } {
  if (node.type === 'start') return { tag: 'startEvent', ...BPMN_SIZE.start };
  if (node.type === 'end') return { tag: 'endEvent', ...BPMN_SIZE.end };
  if (node.type === 'decision') return { tag: 'exclusiveGateway', ...BPMN_SIZE.decision };
  return { tag: 'task', ...DEFAULT_TASK_SIZE };
}

export function generateBpmnXml(nodes: any[], edges: any[]): string {
  const flowNodes = nodes.filter((n) => n.type !== 'swimlane' && n.type !== 'frame' && n.type !== 'junction');
  const elements = flowNodes.map((n) => ({ node: n, ...getBpmnElement(n) }));
  const nodeById = new Map(flowNodes.map((n) => [n.id, n]));

  let process = '';
  elements.forEach(({ node, tag }) => {
    process += `<bpmn:${tag} id="${xmlEscape(node.id)}" name="${xmlEscape(node.data?.label)}"/>`;
  });
  edges.forEach((e) => {
    // Uma ponta na raia/quadro/junção (ex.: linha independente, sem forma
    // nenhuma) não tem elemento BPMN correspondente — emitir o
    // sequenceFlow mesmo assim gerava um sourceRef/targetRef apontando para
    // um ID que não existe no processo, um XML BPMN inválido que Bizagi e
    // outros validadores rejeitam ou recusam abrir corretamente.
    if (!nodeById.has(e.source) || !nodeById.has(e.target)) return;
    process += `<bpmn:sequenceFlow id="${xmlEscape(e.id)}" sourceRef="${xmlEscape(e.source)}" targetRef="${xmlEscape(e.target)}" name="${xmlEscape(e.label || '')}"/>`;
  });

  // Sem esta seção de diagrama (BPMN DI), o arquivo é um XML de processo
  // válido mas SEM NENHUMA informação visual — todo app BPMN (bpmn.io,
  // Camunda Modeler etc.) abriria os elementos empilhados ou os
  // reorganizaria do zero, perdendo o layout inteiro.
  let shapes = '';
  elements.forEach(({ node, width, height }) => {
    const box = getNodeBox(node);
    shapes += `<bpmndi:BPMNShape id="${xmlEscape(node.id)}_di" bpmnElement="${xmlEscape(node.id)}"><dc:Bounds x="${box.x}" y="${box.y}" width="${width}" height="${height}"/></bpmndi:BPMNShape>`;
  });

  let bpmnEdges = '';
  edges.forEach((e) => {
    const source = nodeById.get(e.source);
    const target = nodeById.get(e.target);
    if (!source || !target) return; // ponta presa numa raia/quadro/junção — sem elemento BPMN correspondente

    const controlPoints: Point[] = Array.isArray(e.data?.controlPoints) ? e.data.controlPoints : [];
    const sBox = getNodeBox(source);
    const tBox = getNodeBox(target);
    const sCenter = { x: sBox.x + sBox.width / 2, y: sBox.y + sBox.height / 2 };
    const tCenter = { x: tBox.x + tBox.width / 2, y: tBox.y + tBox.height / 2 };
    const waypoints = [sCenter, ...controlPoints, tCenter];

    bpmnEdges += `<bpmndi:BPMNEdge id="${xmlEscape(e.id)}_di" bpmnElement="${xmlEscape(e.id)}">${waypoints
      .map((p) => `<di:waypoint x="${p.x}" y="${p.y}"/>`)
      .join('')}</bpmndi:BPMNEdge>`;
  });

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">' +
    `<bpmn:process id="Process_1" isExecutable="false">${process}</bpmn:process>` +
    `<bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">${shapes}${bpmnEdges}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>` +
    '</bpmn:definitions>'
  );
}
