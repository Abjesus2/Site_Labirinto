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

const getDrawioEdgeStyle = (edge: any, isManual: boolean): string => {
  const style = edge.style || {};
  const type = edge.type || 'smoothstep';
  const parts = ['html=1;'];
  if (type === 'straight') parts.push('edgeStyle=none;');
  else if (type === 'default') parts.push('curved=1;rounded=0;');
  else parts.push('edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;');
  if (style.strokeDasharray) parts.push('dashed=1;');
  parts.push(`strokeColor=${style.stroke || '#0f172a'};`);
  parts.push(`strokeWidth=${style.strokeWidth || 2};`);
  parts.push('endArrow=classic;');

  // Pontos de saída/entrada fixos (exitX/exitY/entryX/entryY) são um dos
  // gatilhos conhecidos do mxGraph (motor do Draw.io) para o roteamento
  // ortogonal "degradar" para uma linha reta direto entre os dois pontos
  // fixos — em vez de recalcular ângulos retos — quando não há waypoints
  // explícitos e a forma se move para uma posição bem diferente da
  // original. Para arestas roteadas automaticamente (a maioria), deixamos
  // sem ponto fixo (conexão "flutuante" — o Draw.io escolhe o lado mais
  // próximo do perímetro sozinho, recalculado a cada movimento), que é
  // exatamente o modo mais testado/robusto do Draw.io (o mesmo usado
  // quando alguém desenha uma seta direto nele sem prender num ponto
  // específico). Arestas ajustadas manualmente no app mantêm o ponto fixo,
  // já que o usuário escolheu esse lado de propósito.
  if (isManual) {
    const exit = edge.sourceHandle ? HANDLE_TO_UNIT[edge.sourceHandle] : null;
    if (exit) parts.push(`exitX=${exit.x};exitY=${exit.y};exitDx=0;exitDy=0;`);
    const entry = edge.targetHandle ? HANDLE_TO_UNIT[edge.targetHandle] : null;
    if (entry) parts.push(`entryX=${entry.x};entryY=${entry.y};entryDx=0;entryDy=0;`);
  }

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
    // Só grava os pontos de dobra (waypoints absolutos) — e só usa ponto de
    // saída/entrada fixo — em arestas que o usuário ajustou manualmente no
    // app (data.manualRouting === true). Para as demais, coordenadas
    // absolutas congeladas no momento da exportação travavam o traçado: ao
    // mover qualquer forma no Draw.io, a linha ia direto (em diagonal,
    // cortando por cima de tudo) até o ponto antigo, em vez de se
    // re-rotear. Ver getDrawioEdgeStyle para o motivo de também soltar o
    // ponto fixo de saída/entrada nesse caso.
    const isManual = e.data?.manualRouting === true;
    const style = getDrawioEdgeStyle(e, isManual);
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

/* ------------------------------------------------------------------ */
/* Bizagi Modeler (.bpm)                                                */
/* ------------------------------------------------------------------ */
/**
 * O Bizagi Modeler NÃO abre um .bpmn (BPMN 2.0 XML padrão) como modelo
 * nativo — ele salva/abre no próprio formato .bpm: um ZIP contendo um
 * "Diagram.xml" em XPDL 2.2 (o dialeto XML que o Bizagi usa por baixo,
 * declarado com o namespace http://www.wfmc.org/2009/XPDL2.2), dentro de
 * OUTRO zip (o arquivo "<guid>.diag"), mais alguns arquivos auxiliares que o
 * Bizagi sempre espera encontrar. Essa estrutura foi obtida abrindo um
 * arquivo .bpm real exportado pelo próprio Bizagi Modeler e inspecionando
 * seu conteúdo — os arquivos auxiliares (ModelInfo.xml, Participants.xml,
 * Preferences.bpp, Actions.xml, BPSimData.xml, BPSimDataResult.xml e as
 * preferências de usuário) são só metadados/boilerplate que o Bizagi grava
 * sempre da mesma forma, reproduzidos aqui como estão.
 */

interface BizagiBox extends Box {}

// Formato de cor do Bizagi: inteiro ARGB (alpha sempre 0xFF) interpretado
// como int32 COM SINAL — por isso os valores gravados no arquivo real são
// sempre negativos (o bit de alpha ligado vira o bit de sinal).
const hexToBizagiColor = (hex: string): number => {
  const clean = (hex || '#000000').replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return ((0xff << 24) | (r << 16) | (g << 8) | b) | 0;
};

const BIZAGI_COLORS: Record<string, { fill: string; border: string }> = {
  start: { fill: '#E6FF97', border: '#62A716' },
  end: { fill: '#FADBD8', border: '#C0392B' },
  decision: { fill: '#FFFFCC', border: '#A6A61D' },
  task: { fill: '#ECEFFF', border: '#03689A' },
};

const uuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }
  // Fallback (só entra em uso em navegadores muito antigos sem crypto.randomUUID).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Lado mais próximo de "box" na direção de "otherBox" — mesma convenção de
 * porta observada no arquivo de exemplo real do Bizagi (1=Cima, 2=Baixo,
 * 4=Direita; 3=Esquerda por simetria com o par 1/2). Devolve também o
 * ponto exato na borda daquele lado, pra não desenhar a linha saindo do
 * CENTRO da forma (que sem FromPort/ToPort o Bizagi cruza direto por cima
 * de qualquer forma no caminho, em vez de recortar na borda).
 */
const getBizagiPort = (box: BizagiBox, otherBox: BizagiBox): { port: number; point: Point } => {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = otherBox.x + otherBox.width / 2 - cx;
  const dy = otherBox.y + otherBox.height / 2 - cy;

  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0
      ? { port: 2, point: { x: cx, y: box.y + box.height } } // sai pela base
      : { port: 1, point: { x: cx, y: box.y } }; // sai pelo topo
  }
  return dx >= 0
    ? { port: 4, point: { x: box.x + box.width, y: cy } } // sai pela direita
    : { port: 3, point: { x: box.x, y: cy } }; // sai pela esquerda
};

const bizagiActivityBody = (node: any, box: BizagiBox): string => {
  const override = node.data?.styleOverride || {};
  let colorKey = 'task';
  if (node.type === 'start') colorKey = 'start';
  else if (node.type === 'end') colorKey = 'end';
  else if (node.type === 'decision') colorKey = 'decision';
  const defaults = BIZAGI_COLORS[colorKey];
  const fillColor = hexToBizagiColor(override.backgroundColor || defaults.fill);
  const borderColor = hexToBizagiColor(override.borderColor || defaults.border);

  // TextX/TextY/TextWidth/TextHeight ausentes fazem o Bizagi jogar o rótulo
  // pra FORA da forma (abaixo dela) em vez de centralizado dentro — visto
  // no arquivo de exemplo real, onde o evento de início trazia esses
  // atributos apontando pra cima da própria área da forma (mesmo
  // X/Y/Width/Height do NodeGraphicsInfo).
  const graphics =
    `<NodeGraphicsInfos><NodeGraphicsInfo ToolId="BizAgi_Process_Modeler" Height="${Math.round(box.height)}" Width="${Math.round(box.width)}" BorderColor="${borderColor}" FillColor="${fillColor}" BorderVisible="false" TextX="${Math.round(box.x)}" TextY="${Math.round(box.y)}" TextWidth="${Math.round(box.width)}" TextHeight="${Math.round(box.height)}">` +
    `<Coordinates XCoordinate="${Math.round(box.x)}" YCoordinate="${Math.round(box.y)}" />` +
    '<Formatting><Alignment>Center</Alignment><FontName>Segoe UI</FontName><SizeFont>8</SizeFont><Bold>false</Bold><Italic>false</Italic><Strikeout>false</Strikeout><Underline>false</Underline><ColorFont>-16777216</ColorFont></Formatting>' +
    '<TextDirection xsi:nil="true" /></NodeGraphicsInfo></NodeGraphicsInfos>';

  if (node.type === 'start') {
    return `<Description /><Event><StartEvent Trigger="None" /></Event><Documentation />${graphics}<ExtendedAttributes><ExtendedAttribute Name="RuntimeProperties" Value="{}" /></ExtendedAttributes>`;
  }
  if (node.type === 'end') {
    return `<Description /><Event><EndEvent Result="None" /></Event><Documentation />${graphics}<ExtendedAttributes><ExtendedAttribute Name="RuntimeProperties" Value="{}" /></ExtendedAttributes>`;
  }
  if (node.type === 'decision') {
    return `<Description /><Route /><Documentation />${graphics}<ExtendedAttributes />`;
  }
  // Qualquer outra forma (processo, documento, banco de dados, subprocesso,
  // etc.) vira uma Tarefa genérica — o Bizagi não tem paleta nativa
  // equivalente a todas as formas de fluxograma que o app suporta.
  return `<Description /><Implementation><Task /></Implementation><Performers /><Documentation /><Loop LoopType="None" />${graphics}<ExtendedAttributes />`;
};

export async function generateBizagiBpm(nodes: any[], edges: any[], title: string): Promise<Blob> {
  const JSZipModule: any = await import('jszip');
  const JSZip = JSZipModule.default || JSZipModule;

  const flowNodes = nodes.filter((n) => n.type !== 'swimlane' && n.type !== 'frame' && n.type !== 'junction');
  const idMap = new Map<string, string>();
  flowNodes.forEach((n) => idMap.set(n.id, uuid()));

  // XPDL grava as formas em coordenadas absolutas dentro do espaço do
  // próprio "pool" que as contém — desloca tudo para caber com uma margem
  // pequena a partir de (30,30), igual ao que o Bizagi Modeler grava.
  const boxes = flowNodes.map((n) => getNodeBox(n));
  const minX = boxes.length ? Math.min(...boxes.map((b) => b.x)) : 0;
  const minY = boxes.length ? Math.min(...boxes.map((b) => b.y)) : 0;
  const maxX = boxes.length ? Math.max(...boxes.map((b) => b.x + b.width)) : 700;
  const maxY = boxes.length ? Math.max(...boxes.map((b) => b.y + b.height)) : 350;
  const MARGIN = 50;
  const offsetX = (v: number) => v - minX + MARGIN;
  const offsetY = (v: number) => v - minY + MARGIN;

  const poolWidth = Math.max(200, maxX - minX + MARGIN * 2);
  const poolHeight = Math.max(150, maxY - minY + MARGIN * 2);

  let activitiesXml = '';
  flowNodes.forEach((n) => {
    const box = getNodeBox(n);
    const offsetBox: BizagiBox = { x: offsetX(box.x), y: offsetY(box.y), width: box.width, height: box.height };
    const label = xmlEscape(n.data?.label || '');
    activitiesXml += `<Activity Id="${idMap.get(n.id)}" Name="${label}">${bizagiActivityBody(n, offsetBox)}</Activity>`;
  });

  const nodeById = new Map(flowNodes.map((n) => [n.id, n]));
  let transitionsXml = '';
  edges.forEach((e) => {
    const sourceId = idMap.get(e.source);
    const targetId = idMap.get(e.target);
    // Ponta numa raia/quadro/junção não tem Activity correspondente — sem
    // isso o From/To apontaria pra um Id inexistente, o mesmo tipo de XML
    // inválido que quebrava a importação BPMN.
    if (!sourceId || !targetId) return;

    const source = nodeById.get(e.source);
    const target = nodeById.get(e.target);
    const sBox = getNodeBox(source);
    const tBox = getNodeBox(target);
    const sOff: BizagiBox = { x: offsetX(sBox.x), y: offsetY(sBox.y), width: sBox.width, height: sBox.height };
    const tOff: BizagiBox = { x: offsetX(tBox.x), y: offsetY(tBox.y), width: tBox.width, height: tBox.height };

    // Sem FromPort/ToPort, o Bizagi não recorta a linha na borda da forma —
    // ele desenha reto de ponto a ponto, então um waypoint no CENTRO
    // atravessa a forma inteira (visível no teste real: uma coluna de
    // formas empilhadas verticalmente virava uma única linha reta
    // cruzando por dentro de todas elas). getBizagiPort calcula o lado
    // mais próximo pela posição relativa entre origem e destino (a mesma
    // convenção 1=Cima/2=Baixo/3=Esquerda/4=Direita vista no arquivo de
    // exemplo real) e devolve o ponto exato na BORDA daquele lado.
    const { port: fromPort, point: fromPoint } = getBizagiPort(sOff, tOff);
    const { port: toPort, point: toPoint } = getBizagiPort(tOff, sOff);

    const controlPoints: Point[] = Array.isArray(e.data?.controlPoints)
      ? e.data.controlPoints.map((p: Point) => ({ x: offsetX(p.x), y: offsetY(p.y) }))
      : [];
    const waypoints = [fromPoint, ...controlPoints, toPoint];
    const coords = waypoints.map((p) => `<Coordinates XCoordinate="${Math.round(p.x)}" YCoordinate="${Math.round(p.y)}" />`).join('');

    const nameAttr = e.label ? ` Name="${xmlEscape(e.label)}"` : '';
    transitionsXml +=
      `<Transition Id="${uuid()}" From="${sourceId}" To="${targetId}"${nameAttr}><Condition /><Description />` +
      `<ConnectorGraphicsInfos><ConnectorGraphicsInfo FromPort="${fromPort}" ToPort="${toPort}" ToolId="BizAgi_Process_Modeler" BorderColor="-16777216">` +
      '<Formatting><Alignment>Center</Alignment><FontName>Segoe UI</FontName><SizeFont>8</SizeFont><Bold>false</Bold><Italic>false</Italic><Strikeout>false</Strikeout><Underline>false</Underline><ColorFont>-16777216</ColorFont></Formatting>' +
      `<TextDirection xsi:nil="true" />${coords}</ConnectorGraphicsInfo></ConnectorGraphicsInfos><ExtendedAttributes /></Transition>`;
  });

  const mainProcessId = uuid();
  const mainPoolId = uuid();
  const visibleProcessId = uuid();
  const visiblePoolId = uuid();
  const diagramId = uuid();
  const now = new Date().toISOString();
  const safeTitle = xmlEscape(title || 'Fluxograma');

  const diagramXml =
    '<?xml version="1.0"?>' +
    `<Package xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" OnlyOneProcess="false" Id="${diagramId}" Name="${safeTitle}" xmlns="http://www.wfmc.org/2009/XPDL2.2">` +
    `<PackageHeader><XPDLVersion>2.2</XPDLVersion><Vendor>Bizagi Process Modeler.</Vendor><Created>${now}</Created><ModificationDate>${now}</ModificationDate><Description>${safeTitle}</Description><Documentation /><CreationVersion>4.0.0.014</CreationVersion><Version>4.0.0.014</Version><Modifications /></PackageHeader>` +
    '<RedefinableHeader><Author>Labirinto</Author><Version>1.0</Version><Countrykey>BR</Countrykey></RedefinableHeader>' +
    '<ExternalPackages />' +
    '<Pools>' +
    `<Pool Id="${mainPoolId}" Name="Processo principal" Process="${mainProcessId}" BoundaryVisible="false"><Lanes /><NodeGraphicsInfos><NodeGraphicsInfo ToolId="BizAgi_Process_Modeler" Height="0" Width="0" BorderColor="-16777216" FillColor="-1"><Coordinates XCoordinate="30" YCoordinate="30" /><Formatting><Alignment>Center</Alignment><FontName>Segoe UI</FontName><SizeFont>10</SizeFont><Bold>true</Bold><Italic>false</Italic><Strikeout>false</Strikeout><Underline>false</Underline><ColorFont>-16777216</ColorFont></Formatting><TextDirection xsi:nil="true" /></NodeGraphicsInfo></NodeGraphicsInfos></Pool>` +
    `<Pool Id="${visiblePoolId}" Name="${safeTitle}" Process="${visibleProcessId}" BoundaryVisible="true"><Lanes /><NodeGraphicsInfos><NodeGraphicsInfo ToolId="BizAgi_Process_Modeler" Height="${Math.round(poolHeight)}" Width="${Math.round(poolWidth)}" BorderColor="-16777216" FillColor="-1"><Coordinates XCoordinate="30" YCoordinate="30" /><Formatting><Alignment>Center</Alignment><FontName>Segoe UI</FontName><SizeFont>10</SizeFont><Bold>true</Bold><Italic>false</Italic><Strikeout>false</Strikeout><Underline>false</Underline><ColorFont>-16777216</ColorFont></Formatting><TextDirection xsi:nil="true" /></NodeGraphicsInfo></NodeGraphicsInfos></Pool>` +
    '</Pools>' +
    '<WorkflowProcesses>' +
    `<WorkflowProcess Id="${mainProcessId}" Name="Processo principal"><ProcessHeader><Created>${now}</Created><Description /></ProcessHeader><RedefinableHeader><Author /><Version /><Countrykey>BR</Countrykey></RedefinableHeader><ActivitySets /><DataInputOutputs /><ExtendedAttributes /></WorkflowProcess>` +
    `<WorkflowProcess Id="${visibleProcessId}" Name="${safeTitle}"><ProcessHeader><Created>${now}</Created><Description /></ProcessHeader><RedefinableHeader><Author /><Version /><Countrykey>BR</Countrykey></RedefinableHeader><ActivitySets /><DataInputOutputs /><Activities>${activitiesXml}</Activities><Transitions>${transitionsXml}</Transitions><ExtendedAttributes /></WorkflowProcess>` +
    '</WorkflowProcesses>' +
    '<ExtendedAttributes />' +
    '</Package>';

  // O .diag interno é um ZIP à parte com o Diagram.xml de verdade mais três
  // arquivos auxiliares que o Bizagi sempre espera encontrar (mesmo vazios).
  const diagZip = new JSZip();
  diagZip.file('Diagram.xml', diagramXml);
  diagZip.file(
    'Actions.xml',
    '<?xml version="1.0"?><DiagramActions xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" />'
  );
  diagZip.file(
    'BPSimData.xml',
    `<?xml version="1.0"?><ns1:BPSimData simulationLevel="LevelOne" xmlns:ns1="http://www.bpsim.org/schemas/1.0"><ns1:Scenario id="Scenario_${uuid()}" name="Cenário 1" author="Labirinto" version="1.0"><ns1:ScenarioParameters /></ns1:Scenario></ns1:BPSimData>`
  );
  diagZip.file('BPSimDataResult.xml', '<?xml version="1.0" encoding="utf-8"?><ScenarioResults />');
  const diagBlob = await diagZip.generateAsync({ type: 'blob' });

  const bpmZip = new JSZip();
  bpmZip.file(`${diagramId}.diag`, diagBlob);
  bpmZip.file(
    'ModelInfo.xml',
    `<?xml version="1.0"?><BizAgiModelInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" CreationVersion="4.0.0.014" FilePersistenceVersion="5" ModifiedVersion="4.0.0.014" ModifiedDate="${now}" IsInCollaboration="false" />`
  );
  bpmZip.file(
    'Participants.xml',
    '<?xml version="1.0"?><Participants xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.wfmc.org/2009/XPDL2.2" />'
  );
  bpmZip.file('Preferences.bpp', '<?xml version="1.0" encoding="utf-8"?><ProjectPreferences><VersionFile version="3" /></ProjectPreferences>');
  bpmZip.file(
    'Users/Default/DocumentationSettings.xml',
    '<?xml version="1.0"?><DocumentationSettings xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><SourceType>User</SourceType><ExportBPMNAttachments>false</ExportBPMNAttachments><ShapeFilters /><RoleFiltersString>{}</RoleFiltersString><SelectedDiagrams /><htmlFolderHierarchy xsi:nil="true" /><Settings /></DocumentationSettings>'
  );
  bpmZip.file(
    'Users/Default/PrintingPreferences.xml',
    '<?xml version="1.0"?><PrintingPreferences xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" AutoFitToPagesWidth="0" ScaleFactor="1"><Margins Bottom="0" Top="0" Left="0" Right="0" /><Watermark ImageTiling="false" ImageTransparency="0" TextTransparency="0" ShowBehind="false" /></PrintingPreferences>'
  );
  bpmZip.file(
    'Users/Default/UserPreferences.xml',
    `<?xml version="1.0"?><UserPreferences xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><OpenedItems><ModelItem ItemType="Diagram" DiagramId="${diagramId}" IsSelected="true" /></OpenedItems></UserPreferences>`
  );

  return bpmZip.generateAsync({ type: 'blob' });
}
