import { Node, Edge, MarkerType } from '@xyflow/react';

export interface ConnectivityResult {
  nodes: Node[];
  edges: Edge[];
  dubiousCount: number;
}

export function ensureConnectedGraph(inputNodes: Node[], inputEdges: Edge[]): ConnectivityResult {
  if (!inputNodes || inputNodes.length === 0) {
    return { nodes: [], edges: [], dubiousCount: 0 };
  }

  const nodes = [...inputNodes];
  const edges = [...inputEdges];

  const incomingMap = new Map<string, string[]>();
  const outgoingMap = new Map<string, string[]>();

  nodes.forEach((n) => {
    incomingMap.set(n.id, []);
    outgoingMap.set(n.id, []);
  });

  edges.forEach((e) => {
    if (incomingMap.has(e.target)) {
      incomingMap.get(e.target)!.push(e.source);
    }
    if (outgoingMap.has(e.source)) {
      outgoingMap.get(e.source)!.push(e.target);
    }
  });

  // Find start and end nodes (ignoring infrastructure junction nodes)
  const startNode = nodes.find((n) => n.type === 'start') || nodes.find((n) => n.type !== 'junction') || nodes[0];
  const endNode = nodes.find((n) => n.type === 'end') || nodes.slice().reverse().find((n) => n.type !== 'junction') || nodes[nodes.length - 1];

  // Helper to create a dubious red line
  const createDubiousEdge = (sourceId: string, targetId: string, label = 'Analise Conexão'): Edge => {
    const src = nodes.find(n => n.id === sourceId);
    const tgt = nodes.find(n => n.id === targetId);

    let edgeType: 'straight' | 'smoothstep' = 'smoothstep';
    if (src && tgt && src.position && tgt.position) {
      const isBothZero = src.position.x === 0 && tgt.position.x === 0 && src.position.y === 0 && tgt.position.y === 0;
      if (!isBothZero) {
        const srcCx = src.position.x + ((src.width as number) || 200) / 2;
        const tgtCx = tgt.position.x + ((tgt.width as number) || 200) / 2;
        if (Math.abs(srcCx - tgtCx) <= 1) {
          edgeType = 'straight';
        }
      }
    }

    return {
      id: `e_dubious_${sourceId}_${targetId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      source: sourceId,
      target: targetId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      label,
      type: edgeType,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
      style: { stroke: '#ef4444', strokeWidth: 3 },
      data: { isDubious: true }
    };
  };

  // 1. Check all intermediate & end nodes: must have at least 1 incoming edge (except startNode)
  nodes.forEach((node, idx) => {
    if (node.id === startNode.id || node.type === 'junction') return;

    const inc = incomingMap.get(node.id) || [];
    if (inc.length === 0) {
      // Find suitable predecessor: preceding node in array or startNode
      const predNode = idx > 0 ? nodes[idx - 1] : startNode;
      if (predNode && predNode.id !== node.id && predNode.type !== 'junction') {
        const newEdge = createDubiousEdge(predNode.id, node.id, 'Analise Conexão');
        edges.push(newEdge);
        incomingMap.get(node.id)!.push(predNode.id);
        if (!outgoingMap.has(predNode.id)) outgoingMap.set(predNode.id, []);
        outgoingMap.get(predNode.id)!.push(node.id);
      }
    }
  });

  // 2. Check all intermediate & start nodes: must have at least 1 outgoing edge (except endNode)
  nodes.forEach((node, idx) => {
    if (node.id === endNode.id || node.type === 'junction') return;

    const out = outgoingMap.get(node.id) || [];
    if (out.length === 0) {
      // Find suitable successor: next node in array or endNode
      const succNode = idx < nodes.length - 1 ? nodes[idx + 1] : endNode;
      if (succNode && succNode.id !== node.id) {
        const newEdge = createDubiousEdge(node.id, succNode.id, 'Analise Conexão');
        edges.push(newEdge);
        outgoingMap.get(node.id)!.push(succNode.id);
        if (!incomingMap.has(succNode.id)) incomingMap.set(succNode.id, []);
        incomingMap.get(succNode.id)!.push(node.id);
      }
    }
  });

  // 3. Count total dubious edges
  const dubiousCount = edges.filter(
    (e) => e.data?.isDubious === true || e.style?.stroke === '#ef4444' || e.style?.stroke === '#dc2626'
  ).length;

  return { nodes, edges, dubiousCount };
}
