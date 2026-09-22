import { getLocalDiagram, saveLocalDiagram } from '../lib/storage';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Connection,
  Edge,
  Node,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  MarkerType,
  useReactFlow,
  useStore,
  ConnectionMode,
  Panel,
  getViewportForBounds
} from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import jsPDF from 'jspdf';
import dagre from 'dagre';
import {
  ArrowLeft,
  Download,
  Sparkles,
  Loader2,
  FileJson,
  Plus,
  ChevronDown,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  LayoutGrid,
  Columns,
  Layers,
  ClipboardPaste,
  Copy,
  MapPin,
  HelpCircle,
  MousePointer2,
  Sliders,
  Check,
  AlignCenterVertical,
  AlignCenterHorizontal,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignEndVertical,
  SlidersHorizontal,
  Workflow,
  Wand2,
  X,
  FileSpreadsheet,
  Clock,
  Timer,
  Eye,
  EyeOff,
  History,
  Calendar,
  Layers2,
  AlertTriangle,
  Upload,
  Settings,
  FileText,
  Users,
  Paperclip,
  ChevronUp,
  ArrowUpToLine,
  ArrowDownToLine,
  CopyPlus,
  GitBranch,
  RotateCcw,
  PlusCircle,
  Spline
} from 'lucide-react';

import { customNodeTypes, getNodeDimensions, pickBoxStyle } from './CustomNodes';
import { AdjustableEdge } from './AdjustableEdge';
import { MiroToolbar } from './MiroToolbar';
import { MiroNodeToolbar, ALL_SHAPE_CATEGORIES } from './MiroNodeToolbar';
import { MANUAL_SHAPE_TYPES, validateGeneratedNodeType } from '../config/shapeRegistry';
import { buildSectorContainers, normalizeContainerZIndex, CONTAINER_BASE_Z_INDEX, rebuildAIContainers } from '../utils/sectorContainers';
import { generateDrawioXml, generateBpmnXml, generateBizagiBpm } from '../utils/exportFormats';
import { NavigationModeContext } from '../lib/navigationMode';
import { applyGeneratedJsonlLine, parseGeneratedBlock } from '../utils/aiGenerationParser';
import { buildPrompt as buildManualAIPrompt } from '../lib/aiBrowserBridge';
import { MiroEdgeToolbar } from './MiroEdgeToolbar';
import { MiroMixedSelectionToolbar } from './MiroMixedSelectionToolbar';
import { MiroTemplatesModal } from './MiroTemplatesModal';
import { MiroPresentationMode } from './MiroPresentationMode';
import { FlowDataTable } from './FlowDataTable';
import { TimingModal } from './TimingModal';
import { ShareModal } from './ShareModal';
import { showToast, copyText } from '../lib/embedCompat';
import { openAISettings } from '../lib/aiSettingsUI';
import { getActiveSummary } from '../lib/aiProviders';
import { ImportFlowModal } from './ImportFlowModal';
import {
  buildClip,
  collectSelection,
  describeClip,
  FlowClip,
  hasFlowClip,
  prepareForPaste,
  readFlowClip,
  readFlowClipFromEvent,
  writeFlowClip,
} from '../lib/flowClipboard';
import { FlowTemplate } from '../templates';
import { NodeTiming, APP_VERSION } from '../types';
import { calculateCumulativeTimes, exportTableToCSV, TimeSettings, defaultTimeSettings, TimeFormatStyle, TimePrecision } from '../utils/timingUtils';
import { deleteSelectionSafely, getActualEdgeEndpoint, getPositionFromHandleId, generateDefaultStepRoute } from '../utils/snapUtils';
import { getObstacles, routeOrthogonalAuto, getManhattanNormal, validateRouteAgainstObstacles } from '../utils/orthogonalRouter';
import { getShapeConnectionPoint } from '../utils/shapeGeometry';
import { ensureConnectedGraph } from '../utils/graphSanitizer';

const customEdgeTypes = {
  adjustable: AdjustableEdge,
  smoothstep: AdjustableEdge,
  default: AdjustableEdge,
  straight: AdjustableEdge,
  step: AdjustableEdge,
};

const AI_SHAPE_FALLBACK_MAP = (requestedType: string, allowed: string[]): string => {
  const t = (requestedType || '').toLowerCase();
  const pick = (preferred: string) =>
    allowed.includes(preferred) ? preferred : 'process';

  if (t.includes('trapez') || t.includes('manualinput') || (t.includes('manual') && t.includes('input')) || t === 'input')
    return pick('manualinput');
  if (t.includes('manualop') || (t.includes('manual') && t.includes('op')))
    return pick('manualoperation');
  if (t.includes('doc') || t.includes('report'))
    return pick('document');
  if (t.includes('db') || t.includes('database') || t.includes('storage'))
    return pick('database');
  if (t.includes('decision') || t.includes('diamond') || t === 'if')
    return pick('decision');
  if (t.includes('start') || t.includes('begin'))
    return pick('start');
  if (t.includes('end') || t.includes('stop') || t.includes('terminator'))
    return pick('end');
  if (t.includes('io') || t.includes('inputoutput') || t.includes('parallelogram'))
    return pick('inputoutput');
  if (t.includes('sub') || t.includes('predefined'))
    return pick('subprocess');
  if (t.includes('delay') || t.includes('wait'))
    return pick('delay');
  if (t.includes('display'))
    return pick('display');
  if (t.includes('cloud') || t.includes('api'))
    return pick('cloud');
  if (t.includes('circle') || t.includes('event'))
    return pick('circle');
  return 'process';
};

// Cursor customizado (ícone de seta) mostrado enquanto o usuário escolhe
// onde a próxima seta/linha independente vai nascer — ver isPlacingFreeEdge.
// Um ícone SVG embutido como data URI, com contorno branco para ficar
// visível em qualquer fundo do canvas; o hotspot (onde o clique realmente
// acontece) fica na ponta da seta.
const FREE_EDGE_CURSOR_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>
  <line x1='6' y1='22' x2='20' y2='8' stroke='white' stroke-width='5' stroke-linecap='round'/>
  <polygon points='20,4 25,9 15,9' fill='white'/>
  <line x1='6' y1='22' x2='20' y2='8' stroke='#0f172a' stroke-width='2.5' stroke-linecap='round'/>
  <polygon points='20,6 23,9 17,9' fill='#0f172a'/>
</svg>`;
const FREE_EDGE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(FREE_EDGE_CURSOR_SVG)}") 6 22, crosshair`;

const recomputeEdgeRoutingForNodes = (edges: Edge[], nodes: Node[], movedNodeIds: Set<string>): Edge[] => {
  if (movedNodeIds.size === 0) return edges;

  const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]));

  return edges.map(edge => {
    if (!movedNodeIds.has(edge.source) && !movedNodeIds.has(edge.target)) return edge;
    if (edge.data?.manualRouting) return edge;

    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (!srcNode || !tgtNode) return edge;

    const sDim = getNodeDimensions(srcNode.type);
    const tDim = getNodeDimensions(tgtNode.type);
    const sW = (srcNode.measured?.width as number) || (srcNode.width as number) || (srcNode.style?.width as number) || sDim.width;
    const sH = (srcNode.measured?.height as number) || (srcNode.height as number) || (srcNode.style?.height as number) || sDim.height;
    const tW = (tgtNode.measured?.width as number) || (tgtNode.width as number) || (tgtNode.style?.width as number) || tDim.width;
    const tH = (tgtNode.measured?.height as number) || (tgtNode.height as number) || (tgtNode.style?.height as number) || tDim.height;

    const sCenterX = srcNode.position.x + sW / 2;
    const sCenterY = srcNode.position.y + sH / 2;
    const tCenterX = tgtNode.position.x + tW / 2;
    const tCenterY = tgtNode.position.y + tH / 2;

    const dx = tCenterX - sCenterX;
    const dy = tCenterY - sCenterY;

    let sourceHandle = edge.sourceHandle;
    let targetHandle = edge.targetHandle;

    if (Math.abs(dy) >= Math.abs(dx)) {
      if (dy >= 0) {
        sourceHandle = 'bottom';
        targetHandle = 'top';
      } else {
        sourceHandle = 'top';
        targetHandle = 'bottom';
      }
    } else {
      if (dx >= 0) {
        sourceHandle = 'right';
        targetHandle = 'left';
      } else {
        sourceHandle = 'left';
        targetHandle = 'right';
      }
    }

    if (srcNode.type === 'decision' && Math.abs(dx) > 40 && dy > 20) {
      sourceHandle = dx >= 0 ? 'right' : 'left';
      targetHandle = 'top';
    }

    const isVerticalPair =
      (sourceHandle === 'bottom' && targetHandle === 'top') ||
      (sourceHandle === 'top' && targetHandle === 'bottom');
    const isHorizontalPair =
      (sourceHandle === 'right' && targetHandle === 'left') ||
      (sourceHandle === 'left' && targetHandle === 'right');

    let chosenType: 'straight' | 'smoothstep' = 'smoothstep';
    if (isVerticalPair && Math.abs(sCenterX - tCenterX) <= 8) {
      chosenType = 'straight';
    } else if (isHorizontalPair && Math.abs(sCenterY - tCenterY) <= 8) {
      chosenType = 'straight';
    }

    const hasControlPoints = Array.isArray(edge.data?.controlPoints) && edge.data.controlPoints.length > 0;

    if (
      edge.sourceHandle !== sourceHandle ||
      edge.targetHandle !== targetHandle ||
      edge.type !== chosenType ||
      hasControlPoints
    ) {
      const nextData = { ...edge.data };
      delete nextData.controlPoints;
      return {
        ...edge,
        sourceHandle,
        targetHandle,
        type: chosenType,
        data: nextData
      };
    }

    return edge;
  });
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'TB') => {
  if (nodes.length === 0) return { nodes, edges };
  
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    ranker: 'network-simplex',
    ranksep: direction === 'TB' ? 110 : 130,
    nodesep: 100,
    edgesep: 40,
    marginx: 40,
    marginy: 40,
  });

  const nodeDimMap = new Map<string, { width: number; height: number }>();

  nodes.forEach((node) => {
    if (node.type !== 'swimlane' && node.type !== 'frame' && node.type !== 'junction') {
      const dim = getNodeDimensions(node.type);
      nodeDimMap.set(node.id, dim);
      dagreGraph.setNode(node.id, { width: dim.width, height: dim.height });
    }
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // Position nodes with their exact centers and explicit style dimensions
  const positionedNodes = nodes.map((node) => {
    if (node.type === 'swimlane' || node.type === 'frame' || node.type === 'junction') return node;
    const dagreNode = dagreGraph.node(node.id);
    if (!dagreNode) return node;
    const dim = nodeDimMap.get(node.id) || { width: 200, height: 56 };
    return {
      ...node,
      position: {
        x: Math.round(dagreNode.x - dim.width / 2),
        y: Math.round(dagreNode.y - dim.height / 2),
      },
      width: dim.width,
      height: dim.height,
      style: {
        width: dim.width,
        height: dim.height,
        ...(node.style || {})
      }
    };
  });

  // Node lookup map with Dagre's mathematically balanced layout
  const nodeMap = new Map<string, Node>(positionedNodes.map(n => [n.id, n]));

  // Smart Handle & Collision-free routing with FROZEN control points
  const optimizedEdges = edges.map(edge => {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (!srcNode || !tgtNode) return edge;

    const sDim = nodeDimMap.get(edge.source) || { width: 200, height: 56 };
    const tDim = nodeDimMap.get(edge.target) || { width: 200, height: 56 };

    const sCenterX = srcNode.position.x + sDim.width / 2;
    const sCenterY = srcNode.position.y + sDim.height / 2;
    const tCenterX = tgtNode.position.x + tDim.width / 2;
    const tCenterY = tgtNode.position.y + tDim.height / 2;

    const dx = tCenterX - sCenterX;
    const dy = tCenterY - sCenterY;

    let sourceHandle = edge.sourceHandle;
    let targetHandle = edge.targetHandle;

    if (!sourceHandle || !targetHandle) {
      if (direction === 'TB') {
        if (dy > 20) {
          // Downward flow
          if (srcNode.type === 'decision') {
            const edgeLabel = ((edge.label as string) || '').toLowerCase();
            const isNegativeBranch = edgeLabel.includes('não') || edgeLabel.includes('nao') || edgeLabel.includes('false') || edgeLabel.includes('neg');
            if (isNegativeBranch || Math.abs(dx) > 40) {
              sourceHandle = dx >= 0 ? 'right' : 'left';
              targetHandle = 'top';
            } else {
              sourceHandle = 'bottom';
              targetHandle = 'top';
            }
          } else {
            sourceHandle = 'bottom';
            targetHandle = 'top';
          }
        } else {
          // Feedback Loop (target node is above or on the same level) - loop around outer sides
          if (dx >= -40) {
            sourceHandle = 'right';
            targetHandle = 'right';
          } else {
            sourceHandle = 'left';
            targetHandle = 'left';
          }
        }
      } else {
        // Horizontal LR flow
        if (dx > 20) {
          if (srcNode.type === 'decision' && Math.abs(dy) > 30) {
            sourceHandle = dy >= 0 ? 'bottom' : 'top';
            targetHandle = 'left';
          } else {
            sourceHandle = 'right';
            targetHandle = 'left';
          }
        } else {
          sourceHandle = 'bottom';
          targetHandle = 'bottom';
        }
      }
    }

    const chosenSourceHandle = sourceHandle || (direction === 'TB' ? 'bottom' : 'right');
    const chosenTargetHandle = targetHandle || (direction === 'TB' ? 'top' : 'left');

    const isVerticalPair =
      (chosenSourceHandle === 'bottom' && chosenTargetHandle === 'top') ||
      (chosenSourceHandle === 'top'    && chosenTargetHandle === 'bottom');
    const isHorizontalPair =
      (chosenSourceHandle === 'right' && chosenTargetHandle === 'left') ||
      (chosenSourceHandle === 'left'  && chosenTargetHandle === 'right');

    let chosenEdgeType: 'straight' | 'smoothstep' = 'smoothstep';
    if (isVerticalPair && Math.abs(sCenterX - tCenterX) <= 1) {
      chosenEdgeType = 'straight';
    } else if (isHorizontalPair && Math.abs(sCenterY - tCenterY) <= 1) {
      chosenEdgeType = 'straight';
    }

    return {
      ...edge,
      sourceHandle: chosenSourceHandle,
      targetHandle: chosenTargetHandle,
      type: chosenEdgeType,
      markerEnd: { type: MarkerType.ArrowClosed, color: (edge.style?.stroke as string) || '#0f172a' },
      style: {
        stroke: (edge.style?.stroke as string) || '#0f172a',
        strokeWidth: 2,
        ...edge.style
      },
      data: {
        ...(edge.data || {}),
        manualRouting: false,
        generatedByAI: true,
      }
    };
  });

  return { nodes: positionedNodes, edges: optimizedEdges };
};


function sanitizeForFirestore(data: any): any {
  if (data === undefined) return null;
  if (data === null) return null;
  if (Array.isArray(data)) {
    return data.filter(item => item !== undefined).map(sanitizeForFirestore);
  }
  if (typeof data === 'object') {
    const res: any = {};
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (val !== undefined) {
        res[key] = sanitizeForFirestore(val);
      }
    }
    return res;
  }
  return data;
}

interface FlowEditorProps {
  diagramId: string;
  onBack: () => void;
}

function FlowEditorContent({ diagramId, onBack }: FlowEditorProps) {
  const isConnecting = useStore((s) => s.connection.inProgress);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [title, setTitle] = useState("Carregando...");
  const [loading, setLoading] = useState(true);
  
  const { screenToFlowPosition, zoomIn, zoomOut, fitView, setCenter, flowToScreenPosition, getViewport, setViewport, getNodes, getNodesBounds } = useReactFlow();
  
  // Tool Modes & Floating Toolbars
  const [toolMode, setToolMode] = useState<'select' | 'pan'>('select');
  // Modo Navegação: fluxograma vira somente pan/zoom, sem nenhuma edição
  // ou seleção — para revisar o conteúdo sem risco de mexer em nada.
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  // Modo de posicionamento da seta/linha independente: fica true entre o
  // clique no botão da barra lateral e o clique no canvas que escolhe
  // onde a linha nasce.
  const [isPlacingFreeEdge, setIsPlacingFreeEdge] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [showMinimap, setShowMinimap] = useState(false);
  const [minimapSize, setMinimapSize] = useState<'sm' | 'md' | 'lg'>('sm');
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  // File Import Reference & Handler
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerImportFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) return;

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          let importedNodes: Node[] = [];
          let importedEdges: Edge[] = [];
          let importedVersions = versions;
          let importedTitle = title;

          if (parsed.versions) {
            importedVersions = parsed.versions;
            setVersions(importedVersions);
            const activeV = parsed.activeVersion || activeVersion || 'normal';
            setActiveVersion(activeV);
            if (parsed.versions[activeV]) {
              importedNodes = parsed.versions[activeV].nodes || [];
              importedEdges = parsed.versions[activeV].edges || [];
            }
          } else if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
            importedNodes = parsed.nodes;
            importedEdges = parsed.edges;
          } else if (Array.isArray(parsed)) {
            importedNodes = parsed;
          }

          if (parsed.title) {
            importedTitle = parsed.title;
            setTitle(importedTitle);
          }

          if (importedNodes.length > 0) {
            setNodes(importedNodes);
            setEdges(importedEdges);
            pushHistory(importedNodes, importedEdges, 'Importou arquivo JSON');
            saveToCloud(activeVersion, importedNodes, importedEdges, importedVersions);
            setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100);
            alert('Fluxograma e dados importados com sucesso!');
          } else {
            alert('O arquivo JSON não contém elementos de fluxograma válidos.');
          }
        } else {
          alert('Arquivo selecionado. Para restauração total de diagramas, recomendamos utilizar arquivos .json exportados pelo Labirinto.');
        }
      } catch (err) {
        console.error('Erro ao importar arquivo:', err);
        alert('Não foi possível ler o arquivo. Verifique se é um arquivo JSON válido.');
      }
    };
    reader.readAsText(file);
  };
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAlignMenu, setShowAlignMenu] = useState(false);
  const [reconnectingEndpoint, setReconnectingEndpoint] = useState<'source' | 'target' | null>(null);
  const edgeReconnectSuccessful = useRef(true);

  // Time Tracking & Spreadsheet State
  const [showTimingMode, setShowTimingMode] = useState<boolean>(false);
  const [isDataTableOpen, setIsDataTableOpen] = useState<boolean>(false);
  const [timingModalNodeId, setTimingModalNodeId] = useState<string | null>(null);
  const [isNodeToolbarVisible, setIsNodeToolbarVisible] = useState<boolean>(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<boolean>(false);

  // Progresso de exportação (PNG/SVG/PDF) — a captura da imagem é pesada e
  // trava a thread principal por um instante; este estado mostra um
  // indicador visível em vez de deixar a tela parecer congelada sem feedback.
  const [exportStatus, setExportStatus] = useState<{ label: string } | null>(null);
  const exportCancelledRef = useRef(false);

  // Undo / Redo History Stack with Timeline Tracking
  const [history, setHistory] = useState<{ id: string; action: string; timestamp: number; nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHistoryMenu, setShowHistoryMenu] = useState<boolean>(false);

  const historyIndexRef = useRef(-1);
  historyIndexRef.current = historyIndex;

  // AI Generation State
  const [prompt, setPrompt] = useState("");
  const [deriveFromExisting, setDeriveFromExisting] = useState(false);
  const [sourceVersion, setSourceVersion] = useState<string>('normal');
  const [overwriteMode, setOverwriteMode] = useState<boolean>(true);
  const [selectedComplexities, setSelectedComplexities] = useState<string[]>(['normal']);
  const [allowedShapeTypes, setAllowedShapeTypes] = useState<string[]>(ALL_SHAPE_CATEGORIES.flatMap(c => c.shapes.map(s => s.type)));
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [aiFiles, setAiFiles] = useState<{name: string, type: string, size: number, data: string}[]>([]);
  const [showAIOptions, setShowAIOptions] = useState(false);
  const [clearAIPref, setClearAIPref] = useState<'ask' | 'always' | 'never'>('ask');
  const [showAIClearConfirm, setShowAIClearConfirm] = useState(false);
  const [rememberClearChoice, setRememberClearChoice] = useState(false);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  const requestCloseAIModal = useCallback(() => {
    if (isGenerating) return;
    if (prompt.trim() === '' && aiFiles.length === 0) {
      setShowAIModal(false);
      return;
    }
    if (clearAIPref === 'always') {
      setPrompt('');
      setAiFiles([]);
      setShowAIModal(false);
    } else if (clearAIPref === 'never') {
      setShowAIModal(false);
    } else {
      setShowAIClearConfirm(true);
    }
  }, [isGenerating, prompt, aiFiles, clearAIPref]);
  
  // Time Settings
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(defaultTimeSettings);
  const [showTimeSettingsMenu, setShowTimeSettingsMenu] = useState(false);
  
  // Edge Z-Index Global Management
  const [globalEdgeZIndexConfirm, setGlobalEdgeZIndexConfirm] = useState<'front' | 'back' | null>(null);

  // AI Conflict Dialog State (Substituir vs Criar Nova Versão mantendo a antiga)
  const [showAIConflictModal, setShowAIConflictModal] = useState<boolean>(false);
  const [aiConflictChoice, setAiConflictChoice] = useState<'new_version' | 'replace' | 'append'>('new_version');
  const [newVersionCustomName, setNewVersionCustomName] = useState<string>('');

  // Gerar Manualmente com Outra IA: mostra o prompt pronto para copiar em
  // qualquer chat de IA (sem precisar cadastrar chave aqui) e lê de volta o
  // que a IA respondeu. pendingManualPasteRef diz ao modal de conflito
  // (reaproveitado dos dois fluxos) qual função terminar a geração ao confirmar.
  const [showManualAIModal, setShowManualAIModal] = useState<boolean>(false);
  const [manualPasteText, setManualPasteText] = useState<string>('');
  const pendingManualPasteRef = useRef<boolean>(false);

  // Versions
  const [activeVersion, setActiveVersion] = useState<string>('normal');
  const [versions, setVersions] = useState<Record<string, { nodes: Node[], edges: Edge[], viewport?: { x: number, y: number, zoom: number } }>>({
    normal: { nodes: [], edges: [] }
  });

  // Dynamic available versions list
  const availableVersions = useMemo(() => {
    // As três versões padrão ficam sempre visíveis, mesmo vazias: antes só
    // apareciam depois que a IA as criava, e o usuário não tinha como trocar.
    const defaultList = ['simples', 'normal', 'detalhado'];
    const allKeys = Object.keys(versions);
    return Array.from(new Set([...defaultList, ...allKeys.filter(k => !defaultList.includes(k))]));
  }, [versions]);

  // Sem nuvem: o compartilhamento é feito pelo arquivo .json
  const [showShareModal, setShowShareModal] = useState(false);
  const [showImportFlowModal, setShowImportFlowModal] = useState(false);
  // Provedor de IA em uso, mostrado no assistente para não gerar com a IA errada.
  const [aiProvider, setAiProvider] = useState(() => getActiveSummary());
  const openAIConfig = useCallback(() => {
    openAISettings({ onSaved: () => setAiProvider(getActiveSummary()) });
  }, []);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const isDeletingRef = useRef(false);

  // Load Diagram from Firebase
  const initialLoadedRef = useRef(false);

  useEffect(() => {
    const data = getLocalDiagram(diagramId);
    if (data) {
      setTitle(data.title || "Fluxograma Sem Título");
      if (data.driveLink) setDriveLink(data.driveLink);
      
      if (data.showTimingMode !== undefined) {
        setShowTimingMode(data.showTimingMode);
      }

      const rawVersions = data.versions || { normal: { nodes: data.nodes || [], edges: data.edges || [] } };
      // Corrige raias/quadros salvos com o zIndex no lugar errado (ver
      // normalizeContainerZIndex) — sem isso, diagramas já salvos antes
      // dessa correção continuariam com as raias na frente para sempre.
      const loadedVersions: typeof rawVersions = {};
      Object.keys(rawVersions).forEach((v) => {
        loadedVersions[v] = {
          ...rawVersions[v],
          nodes: normalizeContainerZIndex(rawVersions[v].nodes || []),
        };
      });
      const activeV = data.activeVersion || 'normal';

      setVersions(loadedVersions);
      setActiveVersion(activeV);
      
      if (loadedVersions[activeV] && !initialLoadedRef.current) {
        const initialNodes = loadedVersions[activeV].nodes || [];
        const initialEdges = loadedVersions[activeV].edges || [];
        setNodes(initialNodes);
        setEdges(initialEdges);
        setHistory([{
          id: 'init',
          action: 'Início do Fluxo',
          timestamp: Date.now(),
          nodes: initialNodes,
          edges: initialEdges
        }]);
        setHistoryIndex(0);
      }
      
      initialLoadedRef.current = true;
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [diagramId]);

  // Debounced Save to Firestore
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveToCloud = useCallback((vName: string, vNodes: Node[], vEdges: Edge[], allV = versions, timingMode = showTimingMode) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setIsSaving(true);
    setSaveError(false);
    
    saveTimeoutRef.current = setTimeout(() => {
      const newVersions = { ...allV, [vName]: { nodes: vNodes, edges: vEdges } };
      const data = getLocalDiagram(diagramId);
      if (data) {
        data.versions = newVersions;
        data.activeVersion = vName;
        data.showTimingMode = Boolean(timingMode);
        data.updatedAt = Date.now();
        saveLocalDiagram(data);
      }
      saveTimeoutRef.current = null;
      setIsSaving(false);
      setSaveError(false);
    }, 400);
  }, [diagramId, versions, showTimingMode, title]);

  // Prevent closing tab when save is pending or in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveTimeoutRef.current || isSaving) {
        e.preventDefault();
        e.returnValue = ''; // Required for some browsers
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaving]);

  // Push state to Undo History with descriptive action name
  const pushHistory = useCallback((newNodes: Node[], newEdges: Edge[], actionName = 'Alteração no Fluxo') => {
    const clonedNodes = JSON.parse(JSON.stringify(newNodes));
    const clonedEdges = JSON.parse(JSON.stringify(newEdges));

    setHistory((prev) => {
      const currentIdx = historyIndexRef.current;
      const sliced = prev.slice(0, currentIdx >= 0 ? currentIdx + 1 : prev.length);
      const updated = [
        ...sliced,
        {
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          action: actionName,
          timestamp: Date.now(),
          nodes: clonedNodes,
          edges: clonedEdges
        }
      ];
      setHistoryIndex(updated.length - 1);
      return updated;
    });
  }, []);

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    // Mover uma raia/quadro NÃO mexe mais nas outras automaticamente — o
    // usuário quer controle manual total aqui; o alinhamento garantido fica
    // só na geração por IA (buildSectorContainers), não como reação a
    // qualquer arraste.
    pushHistory(nodes, edges, 'Moveu elemento');
    saveToCloud(activeVersion, nodes, edges);
  }, [nodes, edges, activeVersion, pushHistory, saveToCloud]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevStep = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setNodes(prevStep.nodes);
      setEdges(prevStep.edges);
      saveToCloud(activeVersion, prevStep.nodes, prevStep.edges);
    }
  }, [history, historyIndex, activeVersion, saveToCloud]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextStep = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setNodes(nextStep.nodes);
      setEdges(nextStep.edges);
      saveToCloud(activeVersion, nextStep.nodes, nextStep.edges);
    }
  }, [history, historyIndex, activeVersion, saveToCloud]);

  // Jump to specific point in time in history
  const handleJumpToHistory = useCallback((index: number) => {
    if (index < 0 || index >= history.length) return;
    const targetStep = history[index];
    setHistoryIndex(index);
    setNodes(targetStep.nodes);
    setEdges(targetStep.edges);
    saveToCloud(activeVersion, targetStep.nodes, targetStep.edges);
    setShowHistoryMenu(false);
  }, [history, activeVersion, saveToCloud]);

  // Central independent deletion handler using deleteSelectionSafely
  const performIndependentDelete = useCallback(({
    nodeIds = [],
    edgeIds = [],
    historyMessage = 'Excluiu elemento(s)',
  }: {
    nodeIds?: string[];
    edgeIds?: string[];
    historyMessage?: string;
  }) => {
    if (isDeletingRef.current) return;
    isDeletingRef.current = true;

    try {
      let targetNodeIds = [...nodeIds];
      let targetEdgeIds = [...edgeIds];

      if (targetNodeIds.length === 0 && targetEdgeIds.length === 0) {
        targetNodeIds = nodes.filter(n => n.selected && n.type !== 'junction').map(n => n.id);
        targetEdgeIds = edges.filter(e => e.selected || e.id === selectedEdge?.id).map(e => e.id);
      }

      if (targetNodeIds.length === 0 && targetEdgeIds.length === 0) return;

      const { nextNodes, nextEdges } = deleteSelectionSafely({
        nodeIds: targetNodeIds,
        edgeIds: targetEdgeIds,
        currentNodes: nodes,
        currentEdges: edges,
      });

      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelectedEdge(null);
      pushHistory(nextNodes, nextEdges, historyMessage);
      saveToCloud(activeVersion, nextNodes, nextEdges);
    } finally {
      isDeletingRef.current = false;
    }
  }, [nodes, edges, selectedEdge, activeVersion, pushHistory, saveToCloud]);

  // Bulk Dimension update (for single node or multiple selected nodes)
  const handleBulkDimensions = useCallback((width: number, height: number) => {
    const selectedNodes = nodes.filter(n => n.selected);
    const targetIds = selectedNodes.map(n => n.id);
    
    if (targetIds.length === 0) return;

    const nextNodes = nodes.map(n => {
      if (targetIds.includes(n.id)) {
        const { width: _w, height: _h, ...prevStyle } = n.data?.styleOverride || {};
        return {
          ...n,
          style: { ...(n.style || {}), width, height },
          data: {
            ...n.data,
            width,
            height,
            styleOverride: prevStyle
          }
        };
      }
      return n;
    });

    setNodes(nextNodes);
    pushHistory(nextNodes, edges, targetIds.length > 1 ? `Redimensionou ${targetIds.length} elementos` : 'Redimensionou elemento');
    saveToCloud(activeVersion, nextNodes, edges);
  }, [nodes, edges, pushHistory, saveToCloud, activeVersion]);

  // Canvas Node Resizing End Handler
  const onNodeResizeEnd = useCallback((_: any, params: { id: string; width: number; height: number }) => {
    setNodes((currentNodes) => {
      const updatedNodes = currentNodes.map(n => {
        if (n.id === params.id) {
          const prevStyle = n.data?.styleOverride || {};
          return {
            ...n,
            data: {
              ...n.data,
              width: Math.round(params.width),
              height: Math.round(params.height),
              styleOverride: {
                ...prevStyle,
                width: Math.round(params.width),
                height: Math.round(params.height)
              }
            }
          };
        }
        return n;
      });
      pushHistory(updatedNodes, edges, 'Redimensionou elemento');
      saveToCloud(activeVersion, updatedNodes, edges);
      return updatedNodes;
    });
  }, [edges, pushHistory, saveToCloud, activeVersion]);

  // Calculate Real-Time Cumulative Lead Times for nodes
  const { nodeTimings, summary } = useMemo(() => {
    return calculateCumulativeTimes(nodes, edges, timeSettings);
  }, [nodes, edges, timeSettings]);

  // Inject timing metadata and clean hierarchical zIndex into nodes before rendering
  const enrichedNodes = useMemo(() => {
    const seenIds = new Set<string>();
    const uniqueNodes: Node[] = [];
    for (const node of nodes) {
      if (node && node.id && !seenIds.has(node.id)) {
        seenIds.add(node.id);
        uniqueNodes.push(node);
      }
    }

    return uniqueNodes.map((node) => {
      const timingCalc = nodeTimings[node.id];
      const isContainer = node.type === 'frame' || node.type === 'swimlane';
      const defaultZ = isContainer ? -10 : 10;
      const resolvedZ = node.zIndex !== undefined ? node.zIndex : defaultZ;
      return {
        ...node,
        zIndex: resolvedZ,
        // Raia/Quadro só arrasta pela barra superior (nome) ou pelas bordas
        // — nunca clicando no corpo/interior, pra não roubar clique de quem
        // está por dentro (outros nós ou o canvas).
        dragHandle: isContainer ? '.lane-drag-handle' : node.dragHandle,
        data: {
          ...node.data,
          calculatedTiming: timingCalc,
          showTimingMode: showTimingMode
        }
      };
    });
  }, [nodes, nodeTimings, showTimingMode]);

  // Derived Selection States
  const selectedNodesList = useMemo(() => nodes.filter(n => n.selected && n.type !== 'junction'), [nodes]);
  const selectedEdgesList = useMemo(() => edges.filter(e => e.selected || e.id === selectedEdge?.id), [edges, selectedEdge]);
  // Enquanto uma linha está selecionada (pronta pra reconectar), os pontos de
  // conexão "+" das formas ficam desativados: eles apareciam bem em cima da
  // alça de reconexão da linha e roubavam o clique, impedindo arrastar a
  // ponta da seta para outra forma.
  const hasSelectedEdge = edges.some(e => e.selected) || !!selectedEdge;
  const currentlySelectedNode = selectedNodesList.length > 0 ? selectedNodesList[0] : null;
  const hasActiveSelection = selectedNodesList.length > 0 || selectedEdgesList.length > 0;

  // Dynamic Z-Index / Overlap Layer Management:
  // - Por padrão as linhas passam por trás (zIndex: -1), ficando estritamente atrás do corpo e texto do nó.
  // - Se edge.data?.isFront === true, passa por cima das formas (zIndex: 1000).
  // - A linha NÃO é elevada artificialmente para cima do nó ao ser selecionada se configurada para ficar por trás.
  const enrichedEdges = useMemo(() => {
    const seenIds = new Set<string>();
    const uniqueEdges: Edge[] = [];
    for (const edge of edges) {
      if (edge && edge.id && !seenIds.has(edge.id)) {
        seenIds.add(edge.id);
        uniqueEdges.push(edge);
      }
    }
    return uniqueEdges.map((edge) => {
      const isFront = edge.data?.isFront === true;
      const effectiveZIndex = isFront ? 1000 : -1;
      return {
        ...edge,
        zIndex: effectiveZIndex
      };
    });
  }, [edges]);

  // Track dubious / unconfirmed connections marked for evaluation (independent of visual color)
  const dubiousEdges = useMemo(() => {
    return edges.filter(e => e.data?.needsEvaluation === true || e.data?.isDubious === true);
  }, [edges]);

  const handleFocusDubiousEdge = () => {
    if (dubiousEdges.length === 0) return;
    const targetEdge = dubiousEdges[0];
    setSelectedEdge(targetEdge);
    const targetNode = nodes.find(n => n.id === targetEdge.target || n.id === targetEdge.source);
    if (targetNode) {
      setCenter(targetNode.position.x + 100, targetNode.position.y + 30, { zoom: 1.2, duration: 400 });
    }
  };

  // Listen for global custom events from node components
  useEffect(() => {
    // Modo Navegação: não registra nenhum destes listeners — qualquer
    // evento disparado por um botão de edição num nó/linha (rótulo,
    // tempos, alinhar, travar, redimensionar, etc.) simplesmente não tem
    // quem escute e não faz nada.
    if (isNavigationMode) return;

    const handleUpdateLabel = (e: any) => {
      const { nodeId, label } = e.detail;
      updateNodeLabel(nodeId, label);
    };

    const handleOpenTiming = (e: any) => {
      const { nodeId } = e.detail;
      setTimingModalNodeId(nodeId);
    };

    const handleMiroQuickAdd = (e: any) => {
      const { nodeId, direction } = e.detail;
      const sourceNode = nodes.find(n => n.id === nodeId);
      if (!sourceNode) return;

      const sourceDim = getNodeDimensions(sourceNode.type);
      const sourceCenterX = sourceNode.position.x + sourceDim.width / 2;
      const sourceCenterY = sourceNode.position.y + sourceDim.height / 2;

      const newNodeType = sourceNode.type === 'start' ? 'process' : 'process';
      const newDim = getNodeDimensions(newNodeType);

      const newId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let newX = sourceNode.position.x;
      let newY = sourceNode.position.y;

      let sourceHandle = 'bottom';
      let targetHandle = 'top';

      if (direction === 'bottom') {
        newX = Math.round(sourceCenterX - newDim.width / 2);
        newY = sourceNode.position.y + sourceDim.height + 70;
        sourceHandle = 'bottom';
        targetHandle = 'top';
      } else if (direction === 'right') {
        newX = sourceNode.position.x + sourceDim.width + 80;
        newY = Math.round(sourceCenterY - newDim.height / 2);
        sourceHandle = 'right';
        targetHandle = 'left';
      } else if (direction === 'left') {
        newX = sourceNode.position.x - newDim.width - 80;
        newY = Math.round(sourceCenterY - newDim.height / 2);
        sourceHandle = 'left';
        targetHandle = 'right';
      } else if (direction === 'top') {
        newX = Math.round(sourceCenterX - newDim.width / 2);
        newY = sourceNode.position.y - newDim.height - 70;
        sourceHandle = 'top';
        targetHandle = 'bottom';
      }

      const newNode: Node = {
        id: newId,
        type: newNodeType,
        position: { x: newX, y: newY },
        data: {
          label: 'Próxima Etapa',
          styleOverride: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
          timing: { duration: 10, setupTime: 0, waitTime: 0, pauseTime: 0, otherExtraTime: 0, status: 'pending' }
        },
        selected: true
      };

      const newEdge: Edge = {
        id: `e_${sourceNode.id}_${newId}`,
        source: sourceNode.id,
        target: newId,
        sourceHandle,
        targetHandle,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
        style: { stroke: '#0f172a', strokeWidth: 2 }
      };

      const updatedNodes = nodes.map(n => ({ ...n, selected: false })).concat(newNode);
      const updatedEdges = edges.concat(newEdge);

      setNodes(updatedNodes);
      setEdges(updatedEdges);
      pushHistory(updatedNodes, updatedEdges);
      saveToCloud(activeVersion, updatedNodes, updatedEdges);
    };

    const handleHistoryCheckpoint = (e: any) => {
      const action = e.detail?.action || 'Ajustou linha';
      pushHistory(nodes, edges, action);
      saveToCloud(activeVersion, nodes, edges);
    };

    const handleCopyStyle = (e: any) => {
      if (e.detail?.style) {
        // Copiar estilo leva cores, borda e fonte — nunca o tamanho, senão a
        // forma de destino era redimensionada junto sem o usuário pedir.
        (window as any).__copiedNodeStyle = pickBoxStyle(e.detail.style);
      }
    };

    const handlePasteStyle = (e: any) => {
      const { nodeId } = e.detail;
      const styleToApply = (window as any).__copiedNodeStyle;
      if (nodeId && styleToApply) {
        setNodes((prevNodes) => {
          const updated = prevNodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, styleOverride: { ...(n.data?.styleOverride || {}), ...pickBoxStyle(styleToApply) } } }
              : n
          );
          pushHistory(updated, edges, 'Colou estilo no elemento');
          saveToCloud(activeVersion, updated, edges);
          return updated;
        });
      }
    };

    const handleLockNode = (e: any) => {
      const { nodeId, isLocked } = e.detail;
      setNodes((prevNodes) => {
        const updated = prevNodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, isLocked } } : n
        );
        pushHistory(updated, edges, isLocked ? 'Bloqueou elemento' : 'Desbloqueou elemento');
        saveToCloud(activeVersion, updated, edges);
        return updated;
      });
    };

    const handleAlignNodes = (e: any) => {
      const mode = e.detail?.mode;
      const selectedNodes = nodes.filter((n) => n.selected);
      if (selectedNodes.length < 2) return;

      const getW = (n: Node) => (n.measured?.width as number) || 180;
      const getH = (n: Node) => (n.measured?.height as number) || 60;

      // Antes, os modos 'right'/'center-h'/'bottom'/'center-v' calculavam a
      // nova posição mutando n.position.x/y DIRETO nos objetos de nós
      // selecionados — que são as MESMAS referências guardadas no estado
      // "nodes" (nodes.filter não clona nada). Mutar o estado do React por
      // fora do setState é um comportamento indefinido (outras partes do
      // app podiam ler a posição "do futuro" antes do React re-renderizar).
      // Agora cada modo só calcula uma função pura de nova posição.
      let computeX: ((n: Node) => number) | null = null;
      let computeY: ((n: Node) => number) | null = null;

      if (mode === 'left') {
        const minX = Math.min(...selectedNodes.map((n) => n.position.x));
        computeX = () => minX;
      } else if (mode === 'right') {
        const maxRight = Math.max(...selectedNodes.map((n) => n.position.x + getW(n)));
        computeX = (n) => maxRight - getW(n);
      } else if (mode === 'center-h') {
        const avgX = selectedNodes.reduce((acc, n) => acc + n.position.x + getW(n) / 2, 0) / selectedNodes.length;
        computeX = (n) => Math.round(avgX - getW(n) / 2);
      }

      if (mode === 'top') {
        const minY = Math.min(...selectedNodes.map((n) => n.position.y));
        computeY = () => minY;
      } else if (mode === 'bottom') {
        const maxBottom = Math.max(...selectedNodes.map((n) => n.position.y + getH(n)));
        computeY = (n) => maxBottom - getH(n);
      } else if (mode === 'center-v') {
        const avgY = selectedNodes.reduce((acc, n) => acc + n.position.y + getH(n) / 2, 0) / selectedNodes.length;
        computeY = (n) => Math.round(avgY - getH(n) / 2);
      }

      const selectedIds = new Set(selectedNodes.map((n) => n.id));
      const nextNodes = nodes.map((n) => {
        if (!selectedIds.has(n.id)) return n;
        return {
          ...n,
          position: {
            x: computeX ? computeX(n) : n.position.x,
            y: computeY ? computeY(n) : n.position.y
          }
        };
      });

      // Alinhar move as formas diretamente via setNodes, sem passar pelo
      // onNodesChange/applyNodeChanges que o arraste normal usa — por isso
      // as linhas conectadas nunca eram re-roteadas, ficando presas na
      // rota antiga (feita para a posição de antes do alinhamento). Chamar
      // recomputeEdgeRoutingForNodes aqui replica o que o arraste já fazia.
      const nextEdges = recomputeEdgeRoutingForNodes(edges, nextNodes, selectedIds);

      setNodes(nextNodes);
      setEdges(nextEdges);
      pushHistory(nextNodes, nextEdges, `Alinhou elementos (${mode})`);
      saveToCloud(activeVersion, nextNodes, nextEdges);
    };

    const handleDistributeNodes = (e: any) => {
      const mode = e.detail?.mode;
      const selectedNodes = [...nodes.filter((n) => n.selected)];
      if (selectedNodes.length < 3) return;

      const positionById = new Map<string, { x: number; y: number }>();

      if (mode === 'horizontal') {
        const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
        const minX = sorted[0].position.x;
        const maxX = sorted[sorted.length - 1].position.x;
        const step = (maxX - minX) / (sorted.length - 1);
        sorted.forEach((n, idx) => positionById.set(n.id, { x: Math.round(minX + step * idx), y: n.position.y }));
      } else if (mode === 'vertical') {
        const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
        const minY = sorted[0].position.y;
        const maxY = sorted[sorted.length - 1].position.y;
        const step = (maxY - minY) / (sorted.length - 1);
        sorted.forEach((n, idx) => positionById.set(n.id, { x: n.position.x, y: Math.round(minY + step * idx) }));
      }

      const selectedIds = new Set(selectedNodes.map((n) => n.id));
      const nextNodes = nodes.map((n) => {
        const pos = positionById.get(n.id);
        return pos ? { ...n, position: pos } : n;
      });

      // Mesmo motivo do handleAlignNodes: distribuir também move formas por
      // fora do onNodesChange, então precisa recalcular a rota das linhas
      // conectadas manualmente.
      const nextEdges = recomputeEdgeRoutingForNodes(edges, nextNodes, selectedIds);

      setNodes(nextNodes);
      setEdges(nextEdges);
      pushHistory(nextNodes, nextEdges, `Distribuiu elementos (${mode})`);
      saveToCloud(activeVersion, nextNodes, nextEdges);
    };

    const handleNodeResizeEnd = (e: any) => {
      const { id, width, height } = e.detail;
      setNodes((prevNodes) => {
        let updated = prevNodes.map((n) => {
          if (n.id === id) {
            // O tamanho pertence ao nó (style), não ao styleOverride: guardar
            // largura/altura lá dentro fazia o rótulo virar um bloco colorido.
            const { width: _w, height: _h, ...prevStyle } = n.data?.styleOverride || {};
            return {
              ...n,
              style: { ...(n.style || {}), width, height },
              data: {
                ...n.data,
                width,
                height,
                styleOverride: prevStyle
              }
            };
          }
          return n;
        });
        // Redimensionar uma raia/quadro NÃO mexe mais nas outras — controle
        // manual total do usuário (ver onNodeDragStop).
        pushHistory(updated, edges, 'Redimensionou elemento');
        saveToCloud(activeVersion, updated, edges);
        return updated;
      });
    };

    const handleUpdateEdgeLabel = (e: any) => {
      const { id, label } = e.detail;
      setEdges((prevEdges) => {
        const updated = prevEdges.map((edge) => {
          if (edge.id === id) {
            return {
              ...edge,
              label,
              data: {
                ...((edge.data as any) || {}),
                label
              }
            };
          }
          return edge;
        });
        pushHistory(nodes, updated, 'Alterou texto da conexão');
        saveToCloud(activeVersion, nodes, updated);
        return updated;
      });
    };

    const handleUpdateEdgeType = (e: any) => {
      const { id, type } = e.detail;
      setEdges((prevEdges) => {
        const updated = prevEdges.map((edge) => {
          if (edge.id === id) {
            return {
              ...edge,
              type
            };
          }
          return edge;
        });
        pushHistory(nodes, updated, `Alterou estilo do traçado para ${type}`);
        saveToCloud(activeVersion, nodes, updated);
        return updated;
      });
    };

    const handleFlipEdge = (e: any) => {
      const { id } = e.detail;
      setEdges((prevEdges) => {
        const updated = prevEdges.map((edge) => {
          if (edge.id === id) {
            return {
              ...edge,
              source: edge.target,
              target: edge.source,
              sourceHandle: edge.targetHandle,
              targetHandle: edge.sourceHandle,
              markerEnd: edge.markerStart || edge.markerEnd || { type: MarkerType.ArrowClosed, color: '#0f172a' },
              markerStart: edge.markerEnd && !edge.markerStart ? undefined : edge.markerEnd
            };
          }
          return edge;
        });
        pushHistory(nodes, updated, 'Inverteu sentido da conexão');
        saveToCloud(activeVersion, nodes, updated);
        return updated;
      });
    };

    const handleDeleteEdgeEvent = (e: any) => {
      const { id } = e.detail;
      setNodes((prevNodes) => prevNodes.map((n) => ({ ...n, selected: false })));
      setEdges((prevEdges) => {
        const updated = prevEdges.filter((edge) => edge.id !== id);
        setSelectedEdge(null);
        pushHistory(nodes, updated, 'Excluiu conexão');
        saveToCloud(activeVersion, nodes, updated);
        return updated;
      });
    };

    const handleReconnectEdgeEvent = (e: any) => {
      const {
        id,
        source: nextSource,
        target: nextTarget,
        sourceHandle: nextSourceHandle,
        targetHandle: nextTargetHandle,
        sourceAnchor,
        targetAnchor,
        newNodes,
      } = e.detail;

      let nextNodesList = nodes;
      if (newNodes && Array.isArray(newNodes) && newNodes.length > 0) {
        const existingNodeIds = new Set(nodes.map((n) => n.id));
        const nonDuplicateNodes = newNodes.filter((n: Node) => n && n.id && !existingNodeIds.has(n.id));
        if (nonDuplicateNodes.length > 0) {
          nextNodesList = [...nodes, ...nonDuplicateNodes];
          setNodes(nextNodesList);
        }
      }

      const updatedEdges = edges.map((edge) => {
        if (edge.id === id) {
          const nextData = { ...(edge.data || {}) };
          if (sourceAnchor !== undefined) {
            if (sourceAnchor === null) delete nextData.sourceAnchor;
            else nextData.sourceAnchor = sourceAnchor;
          }
          if (targetAnchor !== undefined) {
            if (targetAnchor === null) delete nextData.targetAnchor;
            else nextData.targetAnchor = targetAnchor;
          }
          if (nextSource !== undefined || nextTarget !== undefined || nextSourceHandle !== undefined || nextTargetHandle !== undefined) {
            delete nextData.controlPoints;
            nextData.manualRouting = false;
          }
          return {
            ...edge,
            source: nextSource !== undefined ? nextSource : edge.source,
            target: nextTarget !== undefined ? nextTarget : edge.target,
            sourceHandle: nextSourceHandle !== undefined ? nextSourceHandle : edge.sourceHandle,
            targetHandle: nextTargetHandle !== undefined ? nextTargetHandle : edge.targetHandle,
            data: nextData,
          };
        }
        return edge;
      });

      setEdges(updatedEdges);
      pushHistory(nextNodesList, updatedEdges, 'Reconectou conexão');
      saveToCloud(activeVersion, nextNodesList, updatedEdges);
    };

    const handleUpdateEdgeDataEvent = (e: any) => {
      const { id, data: newData } = e.detail;
      setEdges((prevEdges) => {
        const updated = prevEdges.map((edge) => {
          if (edge.id === id) {
            return {
              ...edge,
              data: {
                ...(edge.data || {}),
                ...newData
              }
            };
          }
          return edge;
        });
        saveToCloud(activeVersion, nodes, updated);
        return updated;
      });
    };

    window.addEventListener('flow-update-node-label', handleUpdateLabel);
    window.addEventListener('flow-open-timing-modal', handleOpenTiming);
    window.addEventListener('flow-quick-add', handleMiroQuickAdd);
    window.addEventListener('flow-history-checkpoint', handleHistoryCheckpoint);
    window.addEventListener('flow-copy-style', handleCopyStyle);
    window.addEventListener('flow-paste-style', handlePasteStyle);
    window.addEventListener('flow-lock-node', handleLockNode);
    window.addEventListener('flow-align-nodes', handleAlignNodes);
    window.addEventListener('flow-distribute-nodes', handleDistributeNodes);
    window.addEventListener('flow-node-resize-end', handleNodeResizeEnd);
    window.addEventListener('flow-update-edge-label', handleUpdateEdgeLabel);
    window.addEventListener('flow-update-edge-type', handleUpdateEdgeType);
    window.addEventListener('flow-flip-edge', handleFlipEdge);
    window.addEventListener('flow-delete-edge', handleDeleteEdgeEvent);
    window.addEventListener('flow-reconnect-edge', handleReconnectEdgeEvent);
    window.addEventListener('flow-update-edge-data', handleUpdateEdgeDataEvent);

    return () => {
      window.removeEventListener('flow-update-node-label', handleUpdateLabel);
      window.removeEventListener('flow-open-timing-modal', handleOpenTiming);
      window.removeEventListener('flow-quick-add', handleMiroQuickAdd);
      window.removeEventListener('flow-history-checkpoint', handleHistoryCheckpoint);
      window.removeEventListener('flow-copy-style', handleCopyStyle);
      window.removeEventListener('flow-paste-style', handlePasteStyle);
      window.removeEventListener('flow-lock-node', handleLockNode);
      window.removeEventListener('flow-align-nodes', handleAlignNodes);
      window.removeEventListener('flow-distribute-nodes', handleDistributeNodes);
      window.removeEventListener('flow-node-resize-end', handleNodeResizeEnd);
      window.removeEventListener('flow-update-edge-label', handleUpdateEdgeLabel);
      window.removeEventListener('flow-update-edge-type', handleUpdateEdgeType);
      window.removeEventListener('flow-flip-edge', handleFlipEdge);
      window.removeEventListener('flow-delete-edge', handleDeleteEdgeEvent);
      window.removeEventListener('flow-reconnect-edge', handleReconnectEdgeEvent);
      window.removeEventListener('flow-update-edge-data', handleUpdateEdgeDataEvent);
    };
  }, [nodes, edges, activeVersion, pushHistory, saveToCloud, isNavigationMode]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Modo Navegação: nada que edite o fluxo — só os atalhos de
      // navegação pura (trocar ferramenta, ajustar zoom, Escape) continuam.
      if (isNavigationMode && (e.key === 'Delete' || e.key === 'Backspace' || (e.ctrlKey || e.metaKey))) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const selectedN = nodes.find(n => n.selected);
        if (selectedN) handleDuplicateNode(selectedN);
      } else if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v'].includes(e.key.toLowerCase())) {
        // Copiar / recortar / colar fluxos: tratado no efeito próprio abaixo,
        // para não cair no atalho de ferramenta "v" (modo seleção).
        return;
      } else if (e.key.toLowerCase() === 'v') {
        setToolMode('select');
      } else if (e.key.toLowerCase() === 'h') {
        setToolMode('pan');
      } else if (e.key.toLowerCase() === 'f') {
        fitView({ padding: 0.2 });
      } else if (e.key === 'Escape') {
        setIsPresentationMode(false);
        setShowTemplatesModal(false);
        setShowAIModal(false);
        setShowExportMenu(false);
        setSelectedEdge(null);
        setIsPlacingFreeEdge(false);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
          return;
        }
        e.preventDefault();
        performIndependentDelete({});
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, nodes, selectedEdge, fitView, performIndependentDelete, isNavigationMode]);

  // Version Switcher
  useEffect(() => {
    if (showAIModal) setAiProvider(getActiveSummary());
  }, [showAIModal]);

  const switchVersion = (vName: string) => {
    if (activeVersion === vName) return;

    // Save current viewport and current nodes/edges for the old version
    const currentViewport = getViewport();
    const updatedVersions = { ...versions };
    // Versão ainda não criada (ex.: "simples" num diagrama novo): cria vazia
    // para o usuário poder montar o fluxo à mão ou pedir para a IA gerar.
    if (!updatedVersions[vName]) {
      updatedVersions[vName] = { nodes: [], edges: [] };
    }
    if (updatedVersions[activeVersion]) {
      updatedVersions[activeVersion] = {
        ...updatedVersions[activeVersion],
        nodes,
        edges,
        viewport: currentViewport
      };
    }
    setVersions(updatedVersions);

    setActiveVersion(vName);
    setNodes(updatedVersions[vName]?.nodes || []);
    setEdges(updatedVersions[vName]?.edges || []);
    
    // Restore viewport for the new version, or fit view if none exists
    setTimeout(() => {
      if (updatedVersions[vName]?.viewport) {
        setViewport(updatedVersions[vName].viewport!);
      } else {
        fitView({ padding: 0.2, duration: 500 });
      }
    }, 50);

    const data = getLocalDiagram(diagramId);
    if (data) {
      data.activeVersion = vName;
      data.versions = updatedVersions;
      data.updatedAt = Date.now();
      saveLocalDiagram(data);
    }
  };

  // Node & Edge Changes - Intercept removal changes to enforce independent deletion
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const removals = changes.filter(c => c.type === 'remove') as { type: 'remove'; id: string }[];
    if (removals.length > 0) {
      if (!isDeletingRef.current) {
        const nodeIds = removals.map(r => r.id);
        const selectedEdgeIds = edges.filter(e => e.selected || e.id === selectedEdge?.id).map(e => e.id);
        performIndependentDelete({ nodeIds, edgeIds: selectedEdgeIds, historyMessage: 'Excluiu forma' });
      }
      return;
    }
    setNodes((nds) => {
      const nextNodes = applyNodeChanges(changes, nds);

      const movedNodeIds = new Set<string>();
      changes.forEach(c => {
        if (c.type === 'position' && (c as any).position) {
          movedNodeIds.add(c.id);
        }
      });

      if (movedNodeIds.size > 0) {
        setEdges(prevEdges => recomputeEdgeRoutingForNodes(prevEdges, nextNodes, movedNodeIds));
      }

      saveToCloud(activeVersion, nextNodes, edges);
      return nextNodes;
    });
  }, [edges, selectedEdge, performIndependentDelete, activeVersion, saveToCloud]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removals = changes.filter(c => c.type === 'remove') as { type: 'remove'; id: string }[];
    if (removals.length > 0) {
      if (!isDeletingRef.current) {
        const edgeIds = removals.map(r => r.id);
        const selectedNodeIds = nodes.filter(n => n.selected && n.type !== 'junction').map(n => n.id);
        performIndependentDelete({ nodeIds: selectedNodeIds, edgeIds, historyMessage: 'Excluiu conexão' });
      }
      return;
    }
    setEdges((eds) => {
      const nextEdges = applyEdgeChanges(changes, eds);
      saveToCloud(activeVersion, nodes, nextEdges);
      return nextEdges;
    });
  }, [nodes, performIndependentDelete, activeVersion, saveToCloud]);

  const onNodesDelete = useCallback(() => {
    // Handled safely via performIndependentDelete in onNodesChange
  }, []);

  const onEdgesDelete = useCallback(() => {
    // Handled safely via performIndependentDelete in onEdgesChange
  }, []);

  const onConnect = useCallback((params: Connection | Edge) => {
    const srcNode = nodes.find(n => n.id === params.source);
    const tgtNode = nodes.find(n => n.id === params.target);

    let srcHandle = params.sourceHandle;
    let tgtHandle = params.targetHandle;

    if (srcNode && tgtNode && (!srcHandle || !tgtHandle)) {
      const sDim = getNodeDimensions(srcNode.type);
      const tDim = getNodeDimensions(tgtNode.type);
      const sCenterX = srcNode.position.x + sDim.width / 2;
      const sCenterY = srcNode.position.y + sDim.height / 2;
      const tCenterX = tgtNode.position.x + tDim.width / 2;
      const tCenterY = tgtNode.position.y + tDim.height / 2;

      const dx = tCenterX - sCenterX;
      const dy = tCenterY - sCenterY;

      if (Math.abs(dy) >= Math.abs(dx)) {
        if (dy > 0) {
          srcHandle = srcHandle || 'bottom';
          tgtHandle = tgtHandle || 'top';
        } else {
          srcHandle = srcHandle || 'top';
          tgtHandle = tgtHandle || 'bottom';
        }
      } else {
        if (dx > 0) {
          srcHandle = srcHandle || 'right';
          tgtHandle = tgtHandle || 'left';
        } else {
          srcHandle = srcHandle || 'left';
          tgtHandle = tgtHandle || 'right';
        }
      }
    }

    const chosenSourceHandle = srcHandle || 'bottom';
    const chosenTargetHandle = tgtHandle || 'top';

    setEdges((eds) => {
      const newEdgeId = `edge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nextEdges = addEdge({
        ...params,
        id: (params as Edge).id || newEdgeId,
        sourceHandle: chosenSourceHandle,
        targetHandle: chosenTargetHandle,
        type: 'smoothstep',
        zIndex: -1,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
        style: { stroke: '#0f172a', strokeWidth: 2 },
        data: {
          ...((params as any).data || {}),
          manualRouting: false,
          isFront: false,
          isCustomZIndex: false
        }
      } as Edge, eds);
      pushHistory(nodes, nextEdges, 'Conectou elementos');
      saveToCloud(activeVersion, nodes, nextEdges);
      return nextEdges;
    });
  }, [nodes, activeVersion, pushHistory, saveToCloud]);

  const onEdgeClick = useCallback((e: React.MouseEvent, edge: Edge) => {
    // elementsSelectable=false já impede o React Flow de selecionar por
    // conta própria, mas esse callback ainda é chamado de qualquer jeito
    // — sem essa guarda, o app selecionava a linha "por fora" mesmo assim.
    if (isNavigationMode) return;
    const isMultiKey = e.ctrlKey || e.metaKey || e.shiftKey;
    setReconnectingEndpoint(null);

    if (isMultiKey) {
      // O próprio React Flow já adiciona/remove esta linha do multi-select
      // ao processar o clique internamente (Ctrl/Meta/Shift = teclas de
      // multi-seleção, configuradas abaixo em multiSelectionKeyCode).
      // Alternar "selected" de novo aqui cancelava esse toggle interno —
      // clicar com Ctrl para selecionar ou remover da seleção não tinha
      // efeito nenhum.
      setSelectedEdge(edge);
    } else {
      // Exclusivo: desmarca todas as formas e seleciona apenas esta linha
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      setEdges((eds) => eds.map((eg) => ({ ...eg, selected: eg.id === edge.id })));
      setSelectedEdge(edge);
    }
  }, [isNavigationMode]);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    edgeReconnectSuccessful.current = true;
    setEdges((els) => {
      const updatedEdges = reconnectEdge(oldEdge, newConnection, els);
      pushHistory(nodes, updatedEdges);
      saveToCloud(activeVersion, nodes, updatedEdges);
      return updatedEdges;
    });

    setSelectedEdge((prev) => {
      if (prev && prev.id === oldEdge.id) {
        return {
          ...prev,
          source: newConnection.source || prev.source,
          target: newConnection.target || prev.target,
          sourceHandle: newConnection.sourceHandle || prev.sourceHandle,
          targetHandle: newConnection.targetHandle || prev.targetHandle
        };
      }
      return prev;
    });
  }, [nodes, activeVersion, pushHistory, saveToCloud]);

  const onReconnectEnd = useCallback((_: any, edge: Edge) => {
    edgeReconnectSuccessful.current = true;
  }, []);

  const onNodeClick = useCallback((e: React.MouseEvent, clickedNode: Node) => {
    if (isNavigationMode) return;
    const isMultiKey = e.ctrlKey || e.metaKey || e.shiftKey;
    if (!isMultiKey) {
      setEdges((eds) => eds.map((eg) => ({ ...eg, selected: false })));
      setSelectedEdge(null);
    }

    if (selectedEdge && reconnectingEndpoint) {
      setEdges((eds) => {
        const updatedEdges = eds.map((edgeItem) => {
          if (edgeItem.id === selectedEdge.id) {
            if (reconnectingEndpoint === 'source') {
              return { ...edgeItem, source: clickedNode.id };
            } else {
              return { ...edgeItem, target: clickedNode.id };
            }
          }
          return edgeItem;
        });
        pushHistory(nodes, updatedEdges);
        saveToCloud(activeVersion, nodes, updatedEdges);
        return updatedEdges;
      });

      setSelectedEdge((prev) => {
        if (!prev) return null;
        return reconnectingEndpoint === 'source'
          ? { ...prev, source: clickedNode.id }
          : { ...prev, target: clickedNode.id };
      });

      setReconnectingEndpoint(null);
      return;
    }

    if (!isMultiKey) {
      // Exclusivo: desmarca todas as linhas e seleciona apenas este nó
      setSelectedEdge(null);
      setEdges((eds) => eds.map((edgeItem) => ({ ...edgeItem, selected: false })));
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === clickedNode.id })));
    }
    // Quando isMultiKey (Ctrl/Meta/Shift), o próprio React Flow já
    // adiciona/remove este nó do multi-select ao processar o clique
    // internamente — alternar "selected" de novo aqui cancelava esse
    // toggle interno (ver comentário equivalente em onEdgeClick).
  }, [selectedEdge, reconnectingEndpoint, nodes, activeVersion, pushHistory, saveToCloud, isNavigationMode]);

  // Adiciona uma seta/linha independente (dois pontos de junção ligados por
  // uma aresta, sem forma nenhuma) centrada em "centerPos" — em coordenadas
  // do fluxo. Sem esse parâmetro, cai no centro da tela atual (usado só
  // como um fallback razoável; o fluxo normal sempre passa a posição
  // escolhida pelo clique no canvas, ver isPlacingFreeEdge/onPaneClick).
  const handleAddFreeEdge = useCallback((centerPos?: { x: number; y: number }) => {
    let centerX: number;
    let centerY: number;
    if (centerPos) {
      centerX = centerPos.x;
      centerY = centerPos.y;
    } else {
      const vp = getViewport();
      centerX = -vp.x / vp.zoom + (window.innerWidth / 2) / vp.zoom;
      centerY = -vp.y / vp.zoom + (window.innerHeight / 2) / vp.zoom;
    }

    const pt1Id = `pt_src_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const pt2Id = `pt_tgt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const pt1: Node = {
      id: pt1Id,
      type: 'junction',
      position: { x: centerX - 120, y: centerY },
      data: { label: '' },
      selected: false
    };

    const pt2: Node = {
      id: pt2Id,
      type: 'junction',
      position: { x: centerX + 120, y: centerY },
      data: { label: '' },
      selected: false
    };

    const freeEdge: Edge = {
      id: `free_edge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      source: pt1Id,
      target: pt2Id,
      sourceHandle: 'center',
      targetHandle: 'center',
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
      style: { stroke: '#0f172a', strokeWidth: 2 },
      selected: true
    };

    const nextNodes = nodes.concat([pt1, pt2]);
    const nextEdges = edges.concat(freeEdge);

    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedEdge(freeEdge);
    pushHistory(nextNodes, nextEdges, 'Adicionou linha independente');
    saveToCloud(activeVersion, nextNodes, nextEdges);
  }, [nodes, edges, getViewport, activeVersion, pushHistory, saveToCloud]);

  const onPaneClick = useCallback((e: React.MouseEvent) => {
    if (isPlacingFreeEdge) {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      handleAddFreeEdge(pos);
      setIsPlacingFreeEdge(false);
      return;
    }
    setSelectedEdge(null);
    setReconnectingEndpoint(null);
    setShowExportMenu(false);
    setShowAlignMenu(false);
    setShowHistoryMenu(false);
    setShowTimeSettingsMenu(false);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
  }, [isPlacingFreeEdge, screenToFlowPosition, handleAddFreeEdge]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow/type');
      const rawData = event.dataTransfer.getData('application/reactflow/data');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let extraData: Record<string, any> = {};
      try {
        if (rawData) extraData = JSON.parse(rawData);
      } catch (e) {}

      const defaultLabels: Record<string, string> = {
        process: 'Novo Processo',
        start: 'Início',
        end: 'Fim',
        decision: 'Decisão?',
        database: 'Banco de Dados',
        document: 'Documento',
        sticky: 'Anotação...',
        subprocess: 'Subprocesso',
        inputoutput: 'Entrada / Saída',
        cloud: 'API / Serviço',
        circle: 'Evento',
        text: 'Texto...',
        swimlane: 'Raia / Swimlane',
        frame: 'Quadro'
      };

      const isContainer = type === 'swimlane' || type === 'frame';

      const newNode: Node = {
        id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type,
        position,
        // zIndex precisa ser propriedade de topo do nó — o React Flow só lê
        // dali para decidir a ordem de empilhamento; um zIndex dentro de
        // "style" é só CSS e não afeta isso. CONTAINER_BASE_Z_INDEX (-100)
        // fica abaixo até das arestas padrão (-1), não só dos nós — ver
        // comentário em sectorContainers.ts. Como zIndex negativo continua
        // funcionando com "elevar nó selecionado" (+1000 por padrão), a raia
        // some por trás sozinha ao ser deselecionada.
        zIndex: isContainer ? CONTAINER_BASE_Z_INDEX : undefined,
        style: isContainer
          ? {
              width: type === 'swimlane' ? 800 : 600,
              height: type === 'swimlane' ? 200 : 400,
            }
          : undefined,
        data: {
          label: extraData.label || defaultLabels[type] || 'Elemento',
          styleOverride: extraData.styleOverride || {},
          timing: {
            duration: type === 'start' || type === 'end' ? 0 : 10,
            setupTime: 0,
            waitTime: 0,
            pauseTime: 0,
            otherExtraTime: 0,
            status: 'pending'
          },
          ...extraData
        },
        selected: true
      };

      const updatedNodes = nodes.map(n => ({ ...n, selected: false })).concat(newNode);
      setNodes(updatedNodes);
      pushHistory(updatedNodes, edges);
      saveToCloud(activeVersion, updatedNodes, edges);
    },
    [screenToFlowPosition, nodes, edges, activeVersion, pushHistory, saveToCloud]
  );

  const handleAddNode = (type: string, initialData?: Record<string, any>) => {
    let position = {
      x: 300 + (nodes.length % 5) * 40,
      y: 200 + (nodes.length % 5) * 40,
    };

    const defaultLabels: Record<string, string> = {
      process: 'Novo Processo',
      start: 'Início',
      end: 'Fim',
      decision: 'Decisão?',
      database: 'Banco de Dados',
      document: 'Documento',
      sticky: 'Nova anotação...',
      subprocess: 'Subprocesso',
      inputoutput: 'Entrada / Saída',
      cloud: 'API / Nuvem',
      circle: 'Evento',
      text: 'Texto',
      swimlane: '👤 Raia do Usuário',
      frame: 'Quadro de Apresentação'
    };

    const isContainer = type === 'swimlane' || type === 'frame';

    let containerStyle = {
      width: type === 'swimlane' ? 800 : 600,
      height: type === 'swimlane' ? 200 : 400,
    };

    // Nova raia/quadro nasce já alinhada com as do mesmo tipo (mesma borda
    // esquerda e largura), empilhada logo abaixo da última — como no layout
    // de referência — em vez de cair numa posição/tamanho independente que
    // o usuário teria de ajustar manualmente depois.
    if (isContainer) {
      const siblings = nodes.filter((n) => n.type === type);
      if (siblings.length > 0) {
        const first = siblings[0];
        const firstWidth = (first.measured?.width as number) || (first.style?.width as number) || containerStyle.width;
        const lastBottom = Math.max(
          ...siblings.map((n) => n.position.y + ((n.measured?.height as number) || (n.style?.height as number) || containerStyle.height))
        );
        position = { x: first.position.x, y: lastBottom + 16 };
        containerStyle = { ...containerStyle, width: firstWidth };
      }
    }

    const newNode: Node = {
      id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      position,
      // Ver comentário equivalente no onDrop acima: zIndex tem de ser
      // propriedade de topo do nó, não de "style", para o React Flow
      // realmente respeitar a ordem de empilhamento.
      zIndex: isContainer ? CONTAINER_BASE_Z_INDEX : undefined,
      style: isContainer ? containerStyle : undefined,
      data: {
        label: initialData?.label || defaultLabels[type] || 'Elemento',
        styleOverride: initialData?.styleOverride || {},
        timing: {
          duration: type === 'start' || type === 'end' ? 0 : 10,
          setupTime: 0,
          waitTime: 0,
          pauseTime: 0,
          otherExtraTime: 0,
          status: 'pending'
        },
        ...initialData
      },
      selected: true
    };

    const updatedNodes = nodes.map(n => ({ ...n, selected: false })).concat(newNode);
    setNodes(updatedNodes);
    pushHistory(updatedNodes, edges);
    saveToCloud(activeVersion, updatedNodes, edges);
  };

  // Node Property Updaters
  const updateNodeLabel = (id: string, label: string) => {
    const nextNodes = nodes.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n);
    setNodes(nextNodes);
    saveToCloud(activeVersion, nextNodes, edges);
  };

  const updateNodeTiming = (id: string, timing: NodeTiming) => {
    const nextNodes = nodes.map(n => n.id === id ? { ...n, data: { ...n.data, timing } } : n);
    setNodes(nextNodes);
    saveToCloud(activeVersion, nextNodes, edges);
  };

  const updateNodeStyle = (id: string, styleUpdates: Record<string, any>) => {
    const nextNodes = nodes.map(n => {
      if (n.id === id) {
        const prevStyle = n.data?.styleOverride || {};
        return {
          ...n,
          data: {
            ...n.data,
            styleOverride: { ...prevStyle, ...styleUpdates }
          }
        };
      }
      return n;
    });
    setNodes(nextNodes);
    saveToCloud(activeVersion, nextNodes, edges);
  };

  const updateBulkNodeStyle = useCallback((styleUpdates: Record<string, any>) => {
    const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
    if (selectedIds.size === 0) return;

    const nextNodes = nodes.map(n => {
      if (selectedIds.has(n.id)) {
        const prevStyle = n.data?.styleOverride || {};
        return {
          ...n,
          data: {
            ...n.data,
            styleOverride: { ...prevStyle, ...styleUpdates }
          }
        };
      }
      return n;
    });
    setNodes(nextNodes);
    pushHistory(nextNodes, edges, `Alterou estilo de ${selectedIds.size} formas`);
    saveToCloud(activeVersion, nextNodes, edges);
  }, [nodes, edges, activeVersion, pushHistory, saveToCloud]);

  const updateNodeType = (id: string, newType: string) => {
    const nextNodes = nodes.map(n => n.id === id ? { ...n, type: newType } : n);
    setNodes(nextNodes);
    pushHistory(nextNodes, edges);
    saveToCloud(activeVersion, nextNodes, edges);
  };

  const updateBulkNodeType = useCallback((newType: string) => {
    const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
    if (selectedIds.size === 0) return;

    const nextNodes = nodes.map(n => {
      if (selectedIds.has(n.id)) {
        return { ...n, type: newType };
      }
      return n;
    });
    setNodes(nextNodes);
    pushHistory(nextNodes, edges, `Alterou formato de ${selectedIds.size} formas para ${newType}`);
    saveToCloud(activeVersion, nextNodes, edges);
  }, [nodes, edges, activeVersion, pushHistory, saveToCloud]);

  const updateNodeTag = (id: string, tag: string | undefined) => {
    const nextNodes = nodes.map(n => n.id === id ? { ...n, data: { ...n.data, tag } } : n);
    setNodes(nextNodes);
    saveToCloud(activeVersion, nextNodes, edges);
  };

  const updateBulkNodeTag = useCallback((tag: string | undefined) => {
    const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
    if (selectedIds.size === 0) return;

    const nextNodes = nodes.map(n => {
      if (selectedIds.has(n.id)) {
        return { ...n, data: { ...n.data, tag } };
      }
      return n;
    });
    setNodes(nextNodes);
    pushHistory(nextNodes, edges, `Alterou marcador de ${selectedIds.size} formas`);
    saveToCloud(activeVersion, nextNodes, edges);
  }, [nodes, edges, activeVersion, pushHistory, saveToCloud]);

  /* ---------------------------------------------------------------- */
  /* Copiar e colar fluxos entre arquivos                             */
  /* ---------------------------------------------------------------- */

  /** Junta (ou substitui) o fluxo recebido, sempre com IDs novos. */
  const applyIncomingFlow = useCallback(
    (clip: FlowClip, mode: 'adicionar' | 'substituir') => {
      if (!clip || !Array.isArray(clip.nodes) || clip.nodes.length === 0) {
        showToast({ message: 'Não há fluxo para colar.', tone: 'warn' });
        return;
      }

      const base = mode === 'substituir' ? [] : nodes;
      const prepared = prepareForPaste(clip, base, 'ao-lado');

      const nextNodes =
        mode === 'substituir'
          ? prepared.nodes.map((n: any) => ({ ...n, selected: false }))
          : [...nodes.map((n) => ({ ...n, selected: false })), ...prepared.nodes];
      const nextEdges = mode === 'substituir' ? prepared.edges : [...edges, ...prepared.edges];

      setNodes(nextNodes as Node[]);
      setEdges(nextEdges as Edge[]);
      pushHistory(
        nextNodes as Node[],
        nextEdges as Edge[],
        mode === 'substituir' ? 'Substituiu o fluxo por outro arquivo' : 'Colou fluxo de outro arquivo',
      );
      saveToCloud(activeVersion, nextNodes as Node[], nextEdges as Edge[]);

      showToast({
        message: `${describeClip(clip)} ${mode === 'substituir' ? 'substituíram este fluxo' : 'adicionadas a este fluxo'}.`,
        timeout: 8000,
      });
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 80);
    },
    [nodes, edges, pushHistory, saveToCloud, activeVersion, fitView, setNodes, setEdges],
  );

  /** Ctrl+C: seleção atual (ou a versão inteira, se nada estiver selecionado). */
  const handleCopyFlow = useCallback(
    async (silent = false) => {
      const selection = collectSelection(nodes, edges);
      const usouSelecao = selection.nodes.length > 0;
      const payload = usouSelecao ? selection : { nodes, edges };
      if (!payload.nodes.length) {
        if (!silent) showToast({ message: 'Nada para copiar: este fluxo está vazio.', tone: 'warn' });
        return null;
      }
      const clip = buildClip(payload.nodes, payload.edges, {
        diagramId,
        title,
        version: activeVersion,
      });
      await writeFlowClip(clip);
      if (!silent) {
        showToast({
          message: `${describeClip(clip)} ${usouSelecao ? 'copiadas' : 'copiadas (versão inteira)'}. Abra o outro fluxograma e use Ctrl+V.`,
          timeout: 9000,
        });
      }
      return clip;
    },
    [nodes, edges, diagramId, title, activeVersion],
  );

  /** Ctrl+X: copia e remove a seleção. */
  const handleCutFlow = useCallback(async () => {
    const selection = collectSelection(nodes, edges);
    if (!selection.nodes.length) {
      showToast({ message: 'Selecione as etapas que quer recortar.', tone: 'warn' });
      return;
    }
    await handleCopyFlow(true);
    const ids = new Set(selection.nodes.map((n: any) => n.id));
    performIndependentDelete({
      nodeIds: Array.from(ids) as string[],
      historyMessage: `Recortou ${ids.size} etapa(s)`,
    });
    showToast({ message: `${describeClip(buildClip(selection.nodes, selection.edges))} recortadas.`, timeout: 8000 });
  }, [nodes, edges, handleCopyFlow, performIndependentDelete]);

  /**
   * Cola o recorte guardado pelo app. O conteúdo do clipboard do sistema é
   * tratado no evento nativo de colar, para o navegador não pedir permissão
   * de leitura da área de transferência.
   */
  const handlePasteFlow = useCallback(async () => {
    const clip = await readFlowClip();
    if (!clip) {
      showToast({
        message: 'Não encontrei fluxo copiado. Use Ctrl+C no outro fluxograma ou traga pelo menu, colando o conteúdo no campo de texto.',
        tone: 'warn',
        actionLabel: 'Trazer fluxo',
        onAction: () => setShowImportFlowModal(true),
        timeout: 12000,
      });
      return;
    }
    applyIncomingFlow(clip, 'adicionar');
  }, [applyIncomingFlow]);

  // Atalhos de copiar/recortar/colar fluxos (registrados depois das funções)
  useEffect(() => {
    const emCampoDeTexto = (target: HTMLElement | null) =>
      Boolean(target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)));

    // Marca quando o evento nativo de colar resolveu, para o Ctrl+V não colar duas vezes.
    let pasteAtendidoEm = 0;

    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (emCampoDeTexto(e.target as HTMLElement)) return;
      const key = e.key.toLowerCase();
      if (key === 'c') {
        e.preventDefault();
        handleCopyFlow();
      } else if (key === 'x') {
        if (isNavigationMode) return; // recortar remove do fluxo — bloqueado em modo navegação
        e.preventDefault();
        handleCutFlow();
      } else if (key === 'v') {
        if (isNavigationMode) return;
        // Sem preventDefault: é o evento "paste" que traz o conteúdo do
        // sistema sem exigir permissão. Se ele não vier (contexto restrito),
        // cai para o recorte guardado pelo próprio app.
        const marca = Date.now();
        setTimeout(() => {
          if (pasteAtendidoEm < marca) handlePasteFlow();
        }, 250);
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (isNavigationMode) return;
      if (emCampoDeTexto(e.target as HTMLElement)) return;
      const clip = readFlowClipFromEvent(e);
      if (clip) {
        e.preventDefault();
        pasteAtendidoEm = Date.now();
        applyIncomingFlow(clip, 'adicionar');
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste as any);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste as any);
    };
  }, [handleCopyFlow, handleCutFlow, handlePasteFlow, applyIncomingFlow, isNavigationMode]);

  const handleDuplicateNode = (nodeToDup: Node) => {
    const newId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const duplicatedNode: Node = {
      ...nodeToDup,
      id: newId,
      position: {
        x: nodeToDup.position.x + 40,
        y: nodeToDup.position.y + 40
      },
      selected: true
    };
    const nextNodes = nodes.map(n => ({ ...n, selected: false })).concat(duplicatedNode);
    setNodes(nextNodes);
    pushHistory(nextNodes, edges);
    saveToCloud(activeVersion, nextNodes, edges);
  };

  const handleDuplicateBulkNodes = useCallback((nodesToDup: Node[]) => {
    if (nodesToDup.length === 0) return;
    const newDuplicatedNodes: Node[] = nodesToDup.map((n, i) => ({
      ...n,
      id: `node_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
      position: {
        x: n.position.x + 40,
        y: n.position.y + 40
      },
      selected: true
    }));

    const nextNodes = nodes.map(n => ({ ...n, selected: false })).concat(newDuplicatedNodes);
    setNodes(nextNodes);
    pushHistory(nextNodes, edges, `Duplicou ${nodesToDup.length} formas`);
    saveToCloud(activeVersion, nextNodes, edges);
  }, [nodes, edges, activeVersion, pushHistory, saveToCloud]);

  const handleDeleteNode = (id: string) => {
    performIndependentDelete({ nodeIds: [id], historyMessage: 'Excluiu forma' });
  };

  const handleDeleteBulkNodes = useCallback((ids: string[]) => {
    performIndependentDelete({ nodeIds: ids, historyMessage: `Excluiu ${ids.length} formas` });
  }, [performIndependentDelete]);

  // Add Free Floating Line (Independent from shapes)
  // Edge Property Updaters
  const updateEdge = (id: string, updates: Partial<Edge>) => {
    const nextEdges = edges.map(e => e.id === id ? { ...e, ...updates } : e);
    setEdges(nextEdges);
    setSelectedEdge(prev => prev && prev.id === id ? { ...prev, ...updates } : prev);
    pushHistory(nodes, nextEdges, 'Atualizou propriedades da linha');
    saveToCloud(activeVersion, nodes, nextEdges);
  };

  // Global Edge Z-Index Management (Front vs Back)
  const applyGlobalEdgeZIndex = useCallback((target: 'front' | 'back', overrideCustom: boolean) => {
    const isFront = target === 'front';
    const nextEdges = edges.map(e => {
      if (!overrideCustom && e.data?.isCustomZIndex === true) {
        return e;
      }
      return {
        ...e,
        zIndex: isFront ? 1000 : -1,
        data: {
          ...(e.data || {}),
          isFront: isFront,
          isCustomZIndex: overrideCustom ? false : e.data?.isCustomZIndex
        }
      };
    });

    setEdges(nextEdges);
    pushHistory(nodes, nextEdges, isFront ? 'Colocou todas as linhas por cima das formas' : 'Colocou todas as linhas por trás das formas');
    saveToCloud(activeVersion, nodes, nextEdges);
    setGlobalEdgeZIndexConfirm(null);
  }, [edges, nodes, activeVersion, pushHistory, saveToCloud]);

  const handleRequestGlobalEdgeZIndex = useCallback((target: 'front' | 'back') => {
    const hasCustom = edges.some(e => e.data?.isCustomZIndex === true);
    if (hasCustom) {
      setGlobalEdgeZIndexConfirm(target);
    } else {
      applyGlobalEdgeZIndex(target, true);
    }
  }, [edges, applyGlobalEdgeZIndex]);

  const updateBulkEdge = useCallback((updates: Partial<Edge>) => {
    const selectedEdgeIds = new Set(edges.filter(e => e.selected || e.id === selectedEdge?.id).map(e => e.id));
    if (selectedEdgeIds.size === 0) return;

    const nextEdges = edges.map(e => {
      if (selectedEdgeIds.has(e.id)) {
        const prevStyle = (e.style as any) || {};
        const newStyle = updates.style ? { ...prevStyle, ...updates.style } : prevStyle;
        return {
          ...e,
          ...updates,
          style: newStyle
        };
      }
      return e;
    });
    setEdges(nextEdges);
    pushHistory(nodes, nextEdges, `Alterou estilo de ${selectedEdgeIds.size} conexões`);
    saveToCloud(activeVersion, nodes, nextEdges);
  }, [edges, selectedEdge, nodes, activeVersion, pushHistory, saveToCloud]);

  const handleDeleteEdge = (id: string) => {
    performIndependentDelete({ edgeIds: [id], historyMessage: 'Excluiu conexão' });
  };

  const handleDeleteBulkEdges = useCallback((ids: string[]) => {
    performIndependentDelete({ edgeIds: ids, historyMessage: `Excluiu ${ids.length} conexões` });
  }, [performIndependentDelete]);

  const handleDeleteAllSelected = useCallback(() => {
    performIndependentDelete({ historyMessage: 'Excluiu elementos selecionados' });
  }, [performIndependentDelete]);

  const handleClearAllSelection = useCallback(() => {
    setSelectedEdge(null);
    setNodes(nds => nds.map(n => ({ ...n, selected: false })));
    setEdges(eds => eds.map(e => ({ ...e, selected: false })));
  }, []);

  // Auto Layout using Dagre
  const applyAutoLayout = (direction: 'TB' | 'LR' = 'TB') => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, direction);
    // O dagre reposiciona os nós de processo sem saber que existem
    // raias/quadros gerados pela IA ao redor deles — reconstrói essas
    // raias/quadros (só os da IA; os manuais do usuário ficam intocados)
    // pra continuarem envolvendo as atividades certas, sem sobrepor.
    const finalNodes = rebuildAIContainers(layoutedNodes, direction);
    setNodes([...finalNodes]);
    setEdges([...layoutedEdges]);
    pushHistory(finalNodes, layoutedEdges);
    saveToCloud(activeVersion, finalNodes, layoutedEdges);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  };

  // Align and Distribute Tools
  const alignSelectedNodes = (type: 'center-x' | 'center-y' | 'left' | 'right' | 'top' | 'bottom' | 'distribute-v' | 'distribute-h' | 'straighten-all') => {
    if (type === 'straighten-all') {
      const { nodes: lNodes, edges: lEdges } = getLayoutedElements(nodes, edges, 'TB');
      const finalNodes = rebuildAIContainers(lNodes, 'TB');
      setNodes([...finalNodes]);
      setEdges([...lEdges]);
      pushHistory(finalNodes, lEdges);
      saveToCloud(activeVersion, finalNodes, lEdges);
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
      return;
    }

    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) {
      alert('Selecione pelo menos 2 formas para alinhar.');
      return;
    }

    let updatedNodes = [...nodes];

    if (type === 'center-x') {
      const avgCenterX = selectedNodes.reduce((sum, n) => {
        const dim = getNodeDimensions(n.type);
        return sum + n.position.x + dim.width / 2;
      }, 0) / selectedNodes.length;

      updatedNodes = updatedNodes.map(n => {
        if (!n.selected) return n;
        const dim = getNodeDimensions(n.type);
        return {
          ...n,
          position: { ...n.position, x: Math.round(avgCenterX - dim.width / 2) }
        };
      });
    } else if (type === 'center-y') {
      const avgCenterY = selectedNodes.reduce((sum, n) => {
        const dim = getNodeDimensions(n.type);
        return sum + n.position.y + dim.height / 2;
      }, 0) / selectedNodes.length;

      updatedNodes = updatedNodes.map(n => {
        if (!n.selected) return n;
        const dim = getNodeDimensions(n.type);
        return {
          ...n,
          position: { ...n.position, y: Math.round(avgCenterY - dim.height / 2) }
        };
      });
    } else if (type === 'left') {
      const minX = Math.min(...selectedNodes.map(n => n.position.x));
      updatedNodes = updatedNodes.map(n => n.selected ? { ...n, position: { ...n.position, x: minX } } : n);
    } else if (type === 'right') {
      const maxRight = Math.max(...selectedNodes.map(n => {
        const dim = getNodeDimensions(n.type);
        return n.position.x + dim.width;
      }));
      updatedNodes = updatedNodes.map(n => {
        if (!n.selected) return n;
        const dim = getNodeDimensions(n.type);
        return { ...n, position: { ...n.position, x: maxRight - dim.width } };
      });
    } else if (type === 'top') {
      const minY = Math.min(...selectedNodes.map(n => n.position.y));
      updatedNodes = updatedNodes.map(n => n.selected ? { ...n, position: { ...n.position, y: minY } } : n);
    } else if (type === 'bottom') {
      const maxBottom = Math.max(...selectedNodes.map(n => {
        const dim = getNodeDimensions(n.type);
        return n.position.y + dim.height;
      }));
      updatedNodes = updatedNodes.map(n => {
        if (!n.selected) return n;
        const dim = getNodeDimensions(n.type);
        return { ...n, position: { ...n.position, y: maxBottom - dim.height } };
      });
    } else if (type === 'distribute-v') {
      const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = (last.position.y + getNodeDimensions(last.type).height) - first.position.y;
      const totalNodesHeight = sorted.reduce((sum, n) => sum + getNodeDimensions(n.type).height, 0);
      const gap = (totalSpan - totalNodesHeight) / (sorted.length - 1);

      let currentY = first.position.y;
      const newPosMap = new Map<string, number>();
      sorted.forEach((n) => {
        newPosMap.set(n.id, currentY);
        currentY += getNodeDimensions(n.type).height + gap;
      });

      updatedNodes = updatedNodes.map(n => {
        if (newPosMap.has(n.id)) {
          return { ...n, position: { ...n.position, y: Math.round(newPosMap.get(n.id)!) } };
        }
        return n;
      });
    } else if (type === 'distribute-h') {
      const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = (last.position.x + getNodeDimensions(last.type).width) - first.position.x;
      const totalNodesWidth = sorted.reduce((sum, n) => sum + getNodeDimensions(n.type).width, 0);
      const gap = (totalSpan - totalNodesWidth) / (sorted.length - 1);

      let currentX = first.position.x;
      const newPosMap = new Map<string, number>();
      sorted.forEach((n) => {
        newPosMap.set(n.id, currentX);
        currentX += getNodeDimensions(n.type).width + gap;
      });

      updatedNodes = updatedNodes.map(n => {
        if (newPosMap.has(n.id)) {
          return { ...n, position: { ...n.position, x: Math.round(newPosMap.get(n.id)!) } };
        }
        return n;
      });
    }

    const { edges: optimizedEdges } = getLayoutedElements(updatedNodes, edges, 'TB');

    setNodes(updatedNodes);
    setEdges(optimizedEdges);
    pushHistory(updatedNodes, optimizedEdges);
    saveToCloud(activeVersion, updatedNodes, optimizedEdges);
  };

  // Apply Template
  const handleApplyTemplate = (template: FlowTemplate) => {
    setNodes(template.nodes);
    setEdges(template.edges);
    pushHistory(template.nodes, template.edges);
    saveToCloud(activeVersion, template.nodes, template.edges);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100);
  };

  // Title Updater
  const updateTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setIsSaving(true);
    setSaveError(false);
    const data = getLocalDiagram(diagramId);
    if (data) {
      data.title = e.target.value;
      data.updatedAt = Date.now();
      saveLocalDiagram(data);
    }
    setIsSaving(false);
  };

  const handleAiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files) as File[];
      
      newFiles.forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            const result = event.target.result as string;
            const base64Data = result.split(',')[1] || result;
            
            setAiFiles(prev => [...prev, {
              name: file.name,
              type: file.type || 'application/octet-stream',
              size: file.size,
              data: base64Data
            }]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeAiFile = (index: number) => {
    setAiFiles(prev => prev.filter((_, i) => i !== index));
  };

  const cancelAIGeneration = () => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setIsGenerating(false);
    setProgress(0);
  };

  // AI Pre-check and Conflict Resolution
  const handleAIGenerateClick = () => {
    if (!deriveFromExisting && !prompt.trim() && aiFiles.length === 0) return;

    // Verificar se alguma das versões selecionadas ou o canvas atual possui conteúdo existente
    const versionsWithContent = selectedComplexities.filter(c => (versions[c]?.nodes?.length || 0) > 0);
    const canvasHasContent = nodes.length > 0;

    if (versionsWithContent.length > 0 || canvasHasContent) {
      // Sugerir automaticamente um nome limpo e exclusivo para a nova versão
      const baseName = selectedComplexities.length === 1 ? selectedComplexities[0] : activeVersion;
      let counter = 2;
      let candidate = `${baseName} (v${counter})`;
      while (versions[candidate] || versions[`${baseName}_v${counter}`]) {
        counter++;
        candidate = `${baseName} (v${counter})`;
      }
      setNewVersionCustomName(candidate);
      setAiConflictChoice('new_version');
      setShowAIConflictModal(true);
      return;
    }

    // Se nenhuma versão possui conteúdo, gera diretamente
    executeGenerateAI({ mode: 'replace' });
  };

  // Gerar Manualmente com Outra IA — sem cadastrar nenhuma chave aqui: monta
  // o mesmo prompt que a API receberia e mostra pronto para copiar em
  // qualquer chat de IA (ChatGPT, Gemini, Claude.ai...). O usuário anexa lá
  // os mesmos arquivos, se houver, e cola a resposta de volta.
  const buildManualPromptText = (): string => {
    const versionsWithContent = selectedComplexities.filter(c => (versions[c]?.nodes?.length || 0) > 0);
    const hasExistingContent = versionsWithContent.length > 0 || nodes.length > 0;
    return buildManualAIPrompt({
      prompt: deriveFromExisting ? '' : prompt,
      complexities: selectedComplexities,
      existingVersions: deriveFromExisting ? { [sourceVersion]: versions[sourceVersion] } : undefined,
      // Instrui a IA a usar IDs únicos sempre que já existe conteúdo — vale
      // tanto para "Adicionar ao lado" quanto para os outros modos (nesse
      // ponto ainda não sabemos qual o usuário vai escolher depois de colar).
      appendMode: hasExistingContent,
      allowedShapeTypes,
      files: aiFiles,
      // O prompt precisa deixar claro pro chat de IA externo que o texto do
      // usuário (se houver) vem no final — a pessoa pode abrir esse modo sem
      // escrever nada, só para anexar um arquivo direto no chat.
      manualMode: true,
    });
  };

  // Abre livremente: diferente do "Gerar com IA" (que exige texto ou anexo
  // aqui no app), o modo manual serve também para quem vai colar/anexar o
  // arquivo direto no chat de IA externo, sem usar o anexo deste app.
  const openManualAIModal = () => {
    setShowAIModal(false);
    setManualPasteText('');
    setShowManualAIModal(true);
  };

  const handleManualPasteGenerate = () => {
    if (!manualPasteText.trim()) {
      showToast({ message: 'Cole aqui o texto que a IA respondeu antes de gerar.', tone: 'warn' });
      return;
    }

    const versionsWithContent = selectedComplexities.filter(c => (versions[c]?.nodes?.length || 0) > 0);
    const canvasHasContent = nodes.length > 0;

    if (versionsWithContent.length > 0 || canvasHasContent) {
      const baseName = selectedComplexities.length === 1 ? selectedComplexities[0] : activeVersion;
      let counter = 2;
      let candidate = `${baseName} (v${counter})`;
      while (versions[candidate] || versions[`${baseName}_v${counter}`]) {
        counter++;
        candidate = `${baseName} (v${counter})`;
      }
      setNewVersionCustomName(candidate);
      setAiConflictChoice('new_version');
      pendingManualPasteRef.current = true;
      setShowManualAIModal(false);
      setShowAIConflictModal(true);
      return;
    }

    executeManualPasteImport({ mode: 'replace' });
  };

  const executeManualPasteImport = (options: {
    mode: 'replace' | 'new_version' | 'append';
    newVersionName?: string;
  }) => {
    const { mode, newVersionName } = options;
    const { rawGenerated, nodeCount } = parseGeneratedBlock(
      manualPasteText,
      selectedComplexities,
      allowedShapeTypes,
      AI_SHAPE_FALLBACK_MAP,
    );

    if (nodeCount === 0) {
      showToast({
        message: 'Não encontrei nenhuma etapa válida no texto colado. Confira se copiou a resposta da IA por completo, sem cortar nada.',
        tone: 'error',
        timeout: 12000,
      });
      setShowAIConflictModal(false);
      setShowManualAIModal(true);
      return;
    }

    setShowAIConflictModal(false);
    setShowManualAIModal(false);
    finalizeGeneratedContent(rawGenerated, mode, newVersionName);
    setManualPasteText('');
    showToast({ message: 'Fluxograma gerado a partir do texto colado.', timeout: 6000 });
  };

  // Termina a geração (streaming pela API ou texto colado manualmente):
  // sanitiza a conectividade, aplica o layout automático, desenha raias/
  // quadros por setor e mescla no mapa de versões conforme o modo escolhido.
  // Extraído para função própria porque o modo "Gerar Manualmente" (texto
  // colado de outro chat de IA) chega no mesmo ponto sem passar pelo
  // streaming — as duas vias precisam terminar exatamente da mesma forma.
  const finalizeGeneratedContent = (
    rawGenerated: Record<string, { nodes: Node[]; edges: Edge[] }>,
    mode: 'replace' | 'new_version' | 'append',
    newVersionName?: string,
  ) => {
    const promptLower = prompt.toLowerCase();
    const hasTimingPrompt = /tempo|minuto|hora|dia|duração|duracao|setup|espera|lead time|pausa|prazo/.test(promptLower);

    const layoutedGenerated: Record<string, { nodes: Node[], edges: Edge[] }> = {};
    let anyTimingGenerated = false;

    Object.keys(rawGenerated).forEach(v => {
      const sanitized = ensureConnectedGraph(
        rawGenerated[v].nodes,
        rawGenerated[v].edges
      );

      if (sanitized.nodes.some(n => {
        const t = (n.data as any)?.timing;
        return (t?.duration || 0) > 0 || (t?.setupTime || 0) > 0;
      })) {
        anyTimingGenerated = true;
      }

      const { nodes: lNodes, edges: lEdges } = getLayoutedElements(
        sanitized.nodes,
        sanitized.edges
      );
      const nodesWithSectors = buildSectorContainers(lNodes, 'TB');
      layoutedGenerated[v] = { nodes: nodesWithSectors, edges: lEdges };
    });

    const shouldEnableTiming = hasTimingPrompt || anyTimingGenerated;
    setShowTimingMode(shouldEnableTiming);

    const updatedVersions: Record<string, { nodes: Node[], edges: Edge[], viewport?: any }> = { ...versions };

    if (updatedVersions[activeVersion]) {
      updatedVersions[activeVersion] = {
        ...updatedVersions[activeVersion],
        nodes,
        edges,
        viewport: getViewport()
      };
    }

    let newActiveVersionKey = activeVersion;

    if (mode === 'new_version') {
      const cleanName = (newVersionName || '').trim() || `${activeVersion} (v2)`;
      if (selectedComplexities.length === 1) {
        const comp = selectedComplexities[0];
        updatedVersions[cleanName] = {
          nodes: layoutedGenerated[comp]?.nodes || [],
          edges: layoutedGenerated[comp]?.edges || []
        };
        newActiveVersionKey = cleanName;
      } else {
        selectedComplexities.forEach(c => {
          const vKey = `${cleanName} - ${c}`;
          updatedVersions[vKey] = {
            nodes: layoutedGenerated[c]?.nodes || [],
            edges: layoutedGenerated[c]?.edges || []
          };
        });
        const primeComp = selectedComplexities.includes('normal') ? 'normal' : selectedComplexities[0];
        newActiveVersionKey = `${cleanName} - ${primeComp}`;
      }
    } else if (mode === 'append') {
      selectedComplexities.forEach(c => {
        const prevN = updatedVersions[c]?.nodes || [];
        const prevE = updatedVersions[c]?.edges || [];
        const genN = layoutedGenerated[c]?.nodes || [];
        const genE = layoutedGenerated[c]?.edges || [];

        const maxX = prevN.reduce((max, n) => Math.max(max, n.position.x + 260), 0);
        const shiftedNodes = genN.map(n => ({
          ...n,
          position: { x: n.position.x + maxX + 120, y: n.position.y }
        }));

        updatedVersions[c] = {
          nodes: [...prevN, ...shiftedNodes],
          edges: [...prevE, ...genE]
        };
      });
      newActiveVersionKey = selectedComplexities.includes(activeVersion) ? activeVersion : (selectedComplexities.includes('normal') ? 'normal' : selectedComplexities[0]);
    } else {
      // mode === 'replace'
      selectedComplexities.forEach(c => {
        updatedVersions[c] = {
          nodes: layoutedGenerated[c]?.nodes || [],
          edges: layoutedGenerated[c]?.edges || []
        };
      });
      newActiveVersionKey = selectedComplexities.includes(activeVersion) ? activeVersion : (selectedComplexities.includes('normal') ? 'normal' : selectedComplexities[0]);
    }

    setVersions(updatedVersions);
    setActiveVersion(newActiveVersionKey);
    const activeData = updatedVersions[newActiveVersionKey] || { nodes: [], edges: [] };
    setNodes(activeData.nodes);
    setEdges(activeData.edges);

    pushHistory(activeData.nodes, activeData.edges);
    saveToCloud(newActiveVersionKey, activeData.nodes, activeData.edges, updatedVersions, shouldEnableTiming);

    setTimeout(() => fitView({ padding: 0.2 }), 150);
  };

  // AI Diagram Generation Execution
  const executeGenerateAI = async (options: {
    mode: 'replace' | 'new_version' | 'append';
    newVersionName?: string;
  }) => {
    const { mode, newVersionName } = options;
    if (!deriveFromExisting && !prompt.trim() && aiFiles.length === 0) return;

    setShowAIConflictModal(false);
    setShowAIModal(false);
    setIsGenerating(true);
    setProgress(10);

    aiAbortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/generate-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: aiAbortControllerRef.current.signal,
        body: JSON.stringify({ 
          prompt: deriveFromExisting ? "" : prompt, 
          complexities: selectedComplexities,
          existingVersions: deriveFromExisting ? { [sourceVersion]: versions[sourceVersion] } : undefined,
          sourceVersion: deriveFromExisting ? sourceVersion : undefined,
          appendMode: mode === 'append',
          allowedShapeTypes,
          files: aiFiles.map(f => ({ name: f.name, mimeType: f.type, data: f.data }))
        })
      });

      if (!response.body) throw new Error('Resposta da IA veio sem conteúdo.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      const rawGenerated: Record<string, { nodes: Node[], edges: Edge[] }> = {};
      selectedComplexities.forEach(c => {
        rawGenerated[c] = { nodes: [], edges: [] };
      });

      // Vigia de travamento: se o provedor parar de mandar dados no meio do
      // streaming sem nunca fechar a conexão, o "await reader.read()" fica
      // pendurado para sempre — a barra de progresso trava em 100% e o app
      // nunca sai do estado "Gerando Fluxograma...". 30s sem NENHUM byte novo
      // cancela sozinho, em vez de exigir que o usuário perceba e clique em
      // "Cancelar" manualmente.
      const STALL_TIMEOUT_MS = 30000;
      const readWithStallGuard = (): Promise<ReadableStreamReadResult<Uint8Array>> =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('STALL_TIMEOUT')), STALL_TIMEOUT_MS);
          reader.read().then(
            (result) => { clearTimeout(timer); resolve(result); },
            (err) => { clearTimeout(timer); reject(err); },
          );
        });

      while (true) {
        let readResult: ReadableStreamReadResult<Uint8Array>;
        try {
          readResult = await readWithStallGuard();
        } catch (e: any) {
          if (e?.message === 'STALL_TIMEOUT') {
            aiAbortControllerRef.current?.abort();
            throw new Error(
              'A IA parou de responder no meio da geração (sem nenhuma novidade por 30s). Tente novamente ou troque de provedor em "Configurar IA".',
            );
          }
          throw e;
        }
        const { done, value } = readResult;
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const lineProgress = applyGeneratedJsonlLine(line, rawGenerated, allowedShapeTypes, AI_SHAPE_FALLBACK_MAP);
          if (lineProgress !== null) setProgress(lineProgress);
        }
      }

      finalizeGeneratedContent(rawGenerated, mode, newVersionName);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Geração por IA cancelada');
      } else {
        console.error(err);
        // alert() nativo fica mudo em iframe sem allow-modals — o erro
        // desaparecia em silêncio quando o app estava embutido.
        showToast({ message: 'Erro ao gerar com IA: ' + err.message, tone: 'error', timeout: 12000 });
      }
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  // Export handlers (Imagem/PDF)
  //
  // Antes, toPng/toSvg capturavam reactFlowWrapper.current inteiro — a
  // barra de ferramentas, a sidebar e o minimapa iam junto na imagem, e como
  // a captura seguia o pan/zoom da tela no momento do clique, ficava cheia
  // de espaço em branco (ou cortando o fluxo) e com qualidade ruim quando
  // dava zoom antes de exportar. Agora a captura mira só em
  // ".react-flow__viewport" (a camada que só tem os nós/arestas, sem os
  // painéis/botões, que ficam fora dela no DOM do React Flow) e usa
  // getNodesBounds + getViewportForBounds para montar um enquadramento que
  // sempre cabe o fluxo inteiro, na resolução calculada a partir do próprio
  // tamanho do conteúdo (não do zoom atual da tela).
  // 4096 deixava fluxogramas grandes (muitas etapas, canvas largo) com texto
  // borrado ao dar zoom na imagem exportada — o fluxo inteiro precisa caber
  // nesses pixels, então quanto maior o fluxo, menor o "tamanho" de cada
  // etapa na imagem final. 8192 dobra o lado (4x a área) mantendo folga
  // segura abaixo do limite físico de canvas dos navegadores (16384px).
  const EXPORT_MAX_DIMENSION = 8192;
  const EXPORT_PADDING = 48;

  const captureFlowDataUrl = useCallback(async (format: 'png' | 'svg'): Promise<string | null> => {
    const wrapper = reactFlowWrapper.current;
    const viewportEl = wrapper?.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewportEl) return null;

    const liveNodes = getNodes();
    // Usa o getNodesBounds do hook useReactFlow (não a função solta do
    // pacote) — ele já resolve o nodeLookup interno da lib corretamente.
    const bounds = getNodesBounds(liveNodes.length > 0 ? liveNodes : nodes);
    const contentWidth = Math.max(1, bounds.width);
    const contentHeight = Math.max(1, bounds.height);

    // Escala para a maior resolução possível sem estourar EXPORT_MAX_DIMENSION
    // — a margem (padding) entra na conta do maior lado ANTES de calcular a
    // escala, senão o resultado final passava do limite pelo valor do
    // padding já escalado.
    const rawWidth = contentWidth + EXPORT_PADDING * 2;
    const rawHeight = contentHeight + EXPORT_PADDING * 2;
    const scale = Math.min(3, EXPORT_MAX_DIMENSION / Math.max(rawWidth, rawHeight));
    const paddingPx = EXPORT_PADDING * Math.max(1, scale);
    const imageWidth = Math.round(rawWidth * scale);
    const imageHeight = Math.round(rawHeight * scale);
    // getViewportForBounds trata um "padding" numérico como FRAÇÃO do
    // tamanho da imagem (ex.: 0.1 = 10%), não pixels — passar o valor em
    // pixels direto (ex.: 144) fazia a lib interpretar como "144×" de
    // margem, sobrando quase nada de espaço pro conteúdo. Uma string
    // terminada em "px" é o formato que a própria lib documenta para
    // pixels absolutos.
    const flowViewport = getViewportForBounds(bounds, imageWidth, imageHeight, 0.05, 4, `${paddingPx}px`);

    // Some a seleção/alças/toolbars flutuantes (que só aparecem com algo
    // selecionado) antes de capturar, para a imagem exportada mostrar só o
    // fluxograma — sem quadrado de seleção, alças de redimensionar/ajustar
    // linha ou a caixinha de editar rótulo da linha.
    const selectedNodeIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
    const selectedEdgeIds = new Set(edges.filter(e => e.selected).map(e => e.id));
    const hadSelection = selectedNodeIds.size > 0 || selectedEdgeIds.size > 0;
    if (hadSelection) {
      setNodes(nds => nds.map(n => (n.selected ? { ...n, selected: false } : n)));
      setEdges(eds => eds.map(e => (e.selected ? { ...e, selected: false } : e)));
    }

    // Deixa o navegador pintar o overlay de progresso (e a deseleção acima)
    // antes de travar a thread principal com a captura — sem isso a tela
    // parece congelada, sem nenhum indício de que algo está acontecendo.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const capture = format === 'svg' ? toSvg : toPng;
    let dataUrl: string | null = null;
    try {
      dataUrl = await capture(viewportEl, {
        backgroundColor: '#ffffff',
        width: imageWidth,
        height: imageHeight,
        filter: (node: any) => {
          const cls = node?.classList;
          if (!cls || typeof cls.contains !== 'function') return true;
          // Nunca inclui alças de conexão, de redimensionar/ajustar linha
          // ou o destaque de seleção na imagem exportada.
          return !(
            cls.contains('react-flow__handle') ||
            cls.contains('react-flow__resize-control') ||
            cls.contains('drawio-edge-interactive-handles')
          );
        },
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${flowViewport.x}px, ${flowViewport.y}px) scale(${flowViewport.zoom})`,
        },
      } as any);
    } finally {
      if (hadSelection) {
        setNodes(nds => nds.map(n => (selectedNodeIds.has(n.id) ? { ...n, selected: true } : n)));
        setEdges(eds => eds.map(e => (selectedEdgeIds.has(e.id) ? { ...e, selected: true } : e)));
      }
    }
    return dataUrl;
  }, [getNodes, getNodesBounds, nodes, edges]);

  const runExport = useCallback(async (label: string, task: () => Promise<void>) => {
    exportCancelledRef.current = false;
    setExportStatus({ label });
    try {
      await task();
    } catch (err: any) {
      if (!exportCancelledRef.current) {
        console.error(err);
        showToast({ message: `Falha ao exportar: ${err?.message || 'erro desconhecido'}`, tone: 'error', timeout: 10000 });
      }
    } finally {
      setExportStatus(null);
    }
  }, []);

  const cancelExport = useCallback(() => {
    exportCancelledRef.current = true;
    setExportStatus(null);
  }, []);

  const exportPng = () => runExport('Gerando imagem PNG...', async () => {
    const dataUrl = await captureFlowDataUrl('png');
    if (!dataUrl || exportCancelledRef.current) return;
    const a = document.createElement('a');
    a.setAttribute('download', `${title || 'fluxograma'}.png`);
    a.setAttribute('href', dataUrl);
    a.click();
  });

  const exportSvg = () => runExport('Gerando imagem SVG...', async () => {
    const dataUrl = await captureFlowDataUrl('svg');
    if (!dataUrl || exportCancelledRef.current) return;
    const a = document.createElement('a');
    a.setAttribute('download', `${title || 'fluxograma'}.svg`);
    a.setAttribute('href', dataUrl);
    a.click();
  });

  // Prevent browser default save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setShowExportMenu(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const exportSystemReport = () => {
    const reportContent = `# Relatório Detalhado e Manual do Sistema
**Aplicativo:** Gerador de Fluxogramas Inteligente
**Atualizado em:** ${new Date().toLocaleDateString('pt-BR')}

## 1. Visão Geral
Este sistema é uma plataforma avançada para modelagem, engenharia de processos, visualização e exportação de fluxogramas com suporte a Value Stream Mapping (VSM). Ele combina uma interface gráfica interativa (arrastar-e-soltar, alinhamento magnético, customização de formas e arestas) com um motor de Inteligência Artificial avançado (à sua escolha: modo gratuito, Gemini, ChatGPT, Claude, DeepSeek, OpenRouter ou GitHub Models) baseado nas normas internacionais de modelagem de processos (**ISO 5807** e **BPMN 2.0**).

## 2. Estrutura de Versões (Níveis de Complexidade)
O sistema suporta a visualização e gestão de um mesmo processo em 3 níveis de complexidade complementares:
- **Simples (Visão Executiva / Macro):** 4 a 6 etapas essenciais. Destaca o objetivo final e os grandes marcos do processo sem sobrecarregar com detalhes operacionais.
- **Normal (Visão Tática / Padrão de Processo):** 9 a 15 etapas. Apresenta os pontos de decisão, ramificações condicionais, caminhos alternativos de exceção e reconvergência no fluxo principal.
- **Detalhado (Visão Operacional / Deep Dive):** 16 a 28+ etapas. Mapeia exaustivamente todas as micro-atividades, preparações/setups, validações prévias, geração de documentos/registros em banco, múltiplos cenários condicionais, caminhos paralelos, loops de correção e checkpoints de qualidade.

**Memória de Tela (Viewport Individual):** Cada aba possui seu próprio estado de coordenadas e zoom em cache. Ao alternar entre as abas (ex: Detalhado para Simples), a visualização se ajusta com precisão para onde você estava trabalhando, eliminando deslocamentos indesejados.

## 3. Critérios de Engenharia de IA (BPMN & ISO 5807)
A geração por Inteligência Artificial foi calibrada para seguir os mais altos padrões de modelagem de processos do mercado:
- **Ramificações e Separação de Atividades (Branching):** Nós de decisão (\`decision\`) criam caminhos distintos para situações diferentes (ex: Aprovação vs Reprovação, Sucesso vs Falha, Atendimento Padrão vs Terceirizado/Urgente).
- **Rótulos Mandatórios nas Decisões:** Cada aresta que sai de um nó de decisão possui rótulos explícitos (ex: *"Sim"*, *"Não"*, *"Aprovado"*, *"Reprovado"*, *"Erro"*).
- **Loops de Feedback e Correção (Rework Loops):** Quando uma atividade é rejeitada ou apresenta inconformidade, o fluxo aponta de volta para a etapa anterior necessária para ajuste.
- **Convergência de Caminhos (Merges):** Atividades ramificadas para situações diferentes voltam a se encontrar (convergência) em etapas subsequentes compartilhadas (ex: faturamento, auditoria ou entrega final).
- **Equivalência Numérica Absoluta dos Tempos:**
  - O **Tempo Total de Ciclo** (soma de duração, setup e espera) é **rigorosamente idêntico** em todas as três versões (Simples, Normal e Detalhado).
  - A IA deriva as versões mantendo a conservação exata da soma dos tempos individuais das micro-etapas nas macro-etapas.
- **Modo "Derivar" (Usar fluxo atual):** Permite usar um diagrama existente desenhado na tela como fonte de verdade matemática e lógica para criar as outras versões automaticamente.
- **Prevenção de Sobrescrita:** Ao gerar conteúdo para abas que já possuem elementos, o usuário escolhe entre *Substituir tudo* ou *Adicionar (Sem apagar)*.

## 4. Gestão de Tempos (Value Stream Mapping - VSM)
Cada nó do fluxograma possui um painel configurável para Value Stream Mapping (VSM):
- **Campos de Tempo:**
  - *Duração Principal:* Tempo de agregação de valor real.
  - *Setup / Preparação:* Troca de insumos e setup de máquina/sistema.
  - *Espera / Fila:* Tempos de gargalo e atrasos não-agregadores.
  - *Pausas e Outros Extras:* Deslocamentos e intervalos.
- **Cálculos Automáticos em Tempo Real:** O motor calcula a jornada cumulativa do início ao fim (Lead Time Total) e a Eficiência do Processo (%).
- **Formatos e Precisão:** Suporta formato clássico (HH:MM:SS) ou decimal (segundos), com precisão ajustável de 0 a 3 casas decimais.

## 5. Tipos de Formas Suportadas
- **Início / Fim (\`start\` / \`end\`):** Terminadores de fluxo.
- **Processo (\`process\`):** Etapas operacionais.
- **Decisão (\`decision\`):** Losangos de bifurcação condicional.
- **Documento (\`document\`):** Emissão de relatórios, notas fiscais, ordens de serviço.
- **Banco de Dados (\`database\`):** Armazenamento em ERP, CRM, nuvem.
- **Entrada / Saída (\`inputoutput\`):** Recebimento de dados do cliente ou envio de entregáveis.
- **Subprocesso, Swimlane, Anotações e Conectores de Junção.**

## 6. Exportação, Nuvem e Relatórios
- **Salvo na Nuvem (Padrão Diagrams.net):** Modal de seleção com salvamento local/nuvem.
- **Exportação Multiformatos:** Download em JSON (backup integral re-editável), XML Draw.io, BPMN 2.0, PDF (A4 Paisagem), PNG de alta resolução, SVG vetorial e Planilha CSV com todos os tempos calculados.
- **Planilha do Fluxo (Tabela Dinâmica):** Edição tabular bidirecional simultânea ao diagrama.
`;
    const blob = new Blob([reportContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('download', 'Relatorio-Manual-do-Sistema.md');
    a.setAttribute('href', url);
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => runExport('Gerando PDF...', async () => {
    const dataUrl = await captureFlowDataUrl('png');
    if (!dataUrl || exportCancelledRef.current) return;

    // Orientação escolhida pela proporção real do fluxo (não sempre
    // paisagem) — evita desperdiçar página com fluxos altos e estreitos.
    // getImageProperties só decodifica a imagem, então funciona com
    // qualquer instância do jsPDF, independente da orientação dela.
    const probeProps = new jsPDF('l', 'mm', 'a4').getImageProperties(dataUrl);
    const orientation = probeProps.height > probeProps.width ? 'p' : 'l';
    const pdf = new jsPDF(orientation, 'mm', 'a4');
    const imgProps = pdf.getImageProperties(dataUrl);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const scaledHeight = (imgProps.height * pdfWidth) / imgProps.width;

    if (scaledHeight <= pdfHeight) {
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, scaledHeight);
    } else {
      // Fluxo mais alto que uma página: divide em várias páginas
      // deslocando a mesma imagem para cima a cada página (o jsPDF recorta
      // automaticamente o que sai da área da página).
      const pageCount = Math.ceil(scaledHeight / pdfHeight);
      for (let i = 0; i < pageCount; i++) {
        if (i > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, -i * pdfHeight, pdfWidth, scaledHeight);
      }
    }
    pdf.save(`${title || 'fluxograma'}.pdf`);
  });

  const exportDrawio = () => {
    const xml = generateDrawioXml(nodes, edges);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('download', `${title || 'fluxograma'}.drawio`);
    a.setAttribute('href', url);
    a.click();
  };

  const exportBpmn = () => {
    const xml = generateBpmnXml(nodes, edges);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('download', `${title || 'fluxograma'}.bpmn`);
    a.setAttribute('href', url);
    a.click();
  };

  // .bpm nativo do Bizagi Modeler — diferente do .bpmn (BPMN 2.0 XML
  // padrão), que o Bizagi só aceita via um caminho específico de
  // importação (Export/Import → Importar BPMN), não abrindo direto como
  // modelo nativo. O .bpm abre normal, do jeito que os arquivos salvos
  // pelo próprio Bizagi abrem.
  const exportBizagi = () => runExport('Gerando arquivo para o Bizagi...', async () => {
    const blob = await generateBizagiBpm(nodes, edges, title);
    if (exportCancelledRef.current) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('download', `${title || 'fluxograma'}.bpm`);
    a.setAttribute('href', url);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const exportJson = () => {
    const jsonStr = JSON.stringify({ title, versions }, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('download', `${title || 'fluxograma'}.json`);
    a.setAttribute('href', url);
    a.click();
  };

  // Calculate dynamic initial position for the floating toolbar
  const initialToolbarPos = useMemo(() => {
    if (!currentlySelectedNode) return undefined;
    try {
      const screenPos = flowToScreenPosition({
        x: currentlySelectedNode.position.x,
        y: currentlySelectedNode.position.y
      });
      const dim = getNodeDimensions(currentlySelectedNode.type);
      
      // If node is close to the top of the viewport (< 140px), put toolbar below it
      let targetY = screenPos.y - 70;
      if (screenPos.y < 150) {
        targetY = screenPos.y + dim.height + 25;
      }
      
      // Center horizontally relative to node, constrained within viewport
      const targetX = Math.max(20, Math.min(window.innerWidth - 640, screenPos.x + (dim.width / 2) - 240));
      return { x: targetX, y: Math.max(70, targetY) };
    } catch (e) {
      return { x: Math.max(20, window.innerWidth / 2 - 250), y: 110 };
    }
  }, [currentlySelectedNode, flowToScreenPosition]);

  return (
    <NavigationModeContext.Provider value={isNavigationMode}>
    <div className="h-screen w-full flex flex-col bg-zinc-100 font-sans select-none overflow-hidden">
      {/* MIRO TOP NAVIGATION HEADER */}
      <header className="relative z-50 min-h-[52px] h-auto py-1.5 px-3 bg-white border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2 shadow-xs flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
          <button
            onClick={onBack}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors shrink-0"
            title="Voltar aos Diagramas"
          >
            <ArrowLeft size={18} />
          </button>

          <input
            type="text"
            value={title}
            onChange={updateTitle}
            className="font-bold text-sm sm:text-base bg-transparent border-none hover:bg-zinc-100 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-lg px-2 py-1 text-zinc-800 transition-all outline-none truncate max-w-[160px] sm:max-w-[280px]"
            placeholder="Nome do Fluxograma"
          />

          <span className="px-2 py-0.5 text-[10px] font-extrabold tracking-wide bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full select-none shrink-0 shadow-2xs">
            {APP_VERSION}
          </span>

          {/* Responsive Version Switcher */}
          <div className="flex items-center gap-1.5 ml-1 shrink-0">
            <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Versão:</span>
            
            {/* Desktop / Tablet Pills */}
            <div className="hidden sm:flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/60 max-w-[340px] overflow-x-auto custom-scrollbar">
              {availableVersions.map(v => (
                <button
                  key={v}
                  onClick={() => switchVersion(v)}
                  className={`px-2 py-0.5 text-xs font-semibold rounded-md capitalize transition-all shrink-0 whitespace-nowrap ${
                    activeVersion === v
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                  title={`Versão: ${v} (${versions[v]?.nodes?.length || 0} nós)`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Mobile Select Dropdown */}
            <select
              value={activeVersion}
              onChange={(e) => switchVersion(e.target.value)}
              className="sm:hidden text-xs font-semibold bg-zinc-100 border border-zinc-200 rounded-lg px-2 py-1 text-zinc-800 outline-none cursor-pointer capitalize"
              title="Trocar Versão do Fluxograma"
            >
              {availableVersions.map(v => (
                <option key={v} value={v}>
                  {v.charAt(0).toUpperCase() + v.slice(1)} {`(${versions[v]?.nodes?.length || 0} nós)`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap sm:flex-nowrap">
          {/* Real-time Save Status Indicator — abre o mesmo menu Exportar
              (antes abria um modal "Guardar como..." à parte, com um
              seletor de formato menor e incompleto que duplicava opções já
              existentes no menu Exportar, com um destino "GitHub" que não
              enviava nada de verdade, e um campo de renomear que já existe
              no campo de título ao lado — tudo isso foi removido daqui). */}
          <div className="relative shrink-0 flex items-center gap-1.5">
            <button
              onClick={() => setShowExportMenu(true)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                isSaving
                  ? 'bg-zinc-50/90 border-zinc-200/90 text-zinc-500 hover:bg-zinc-100'
                  : saveError
                  ? 'bg-red-50/90 border-red-200/95 text-red-800 hover:bg-red-100'
                  : 'bg-emerald-50/90 border-emerald-200/90 text-emerald-800 hover:bg-emerald-100'
              }`}
              title={
                isSaving
                  ? 'Salvando neste navegador...'
                  : saveError
                  ? 'Erro ao salvar neste navegador'
                  : 'Salvo automaticamente neste navegador (sem nuvem) — clique para exportar/baixar'
              }
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                isSaving
                  ? 'bg-zinc-400 animate-pulse'
                  : saveError
                  ? 'bg-red-600'
                  : 'bg-emerald-500 animate-pulse'
              }`} />

              <span className="font-bold hidden xs:inline">
                {isSaving ? 'Salvando...' : saveError ? 'Erro ao Salvar' : 'Salvo Neste Navegador'}
              </span>
              <span className="font-bold xs:hidden">
                {isSaving ? 'Salvando' : saveError ? 'Erro' : 'Salvo'}
              </span>
              <ChevronDown size={12} className={isSaving ? 'text-zinc-500' : saveError ? 'text-red-700' : 'text-emerald-700'} />
            </button>
          </div>
          {/* Dubious / Red Connection Lines Counter Alert */}
          {dubiousEdges.length > 0 && (
            <button
              onClick={handleFocusDubiousEdge}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md animate-pulse transition-all cursor-pointer shrink-0"
              title="Clique para analisar e confirmar as conexões com alerta vermelho"
            >
              <AlertTriangle size={14} />
              <span className="hidden sm:inline">{dubiousEdges.length} {dubiousEdges.length === 1 ? 'linha vermelha' : 'linhas vermelhas'}</span>
              <span className="sm:hidden">{dubiousEdges.length}</span>
            </button>
          )}

          {/* Synchronized Process Spreadsheet / Table Toggle */}
          <button
            onClick={() => setIsDataTableOpen(!isDataTableOpen)}
            className={`px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shadow-sm border shrink-0 ${
              isDataTableOpen
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white text-zinc-700 hover:bg-blue-50 border-zinc-200'
            }`}
            title="Abrir Planilha de Processos e Tempos Sincronizada em Tempo Real"
          >
            <FileSpreadsheet size={15} className={isDataTableOpen ? 'text-white' : 'text-blue-600'} />
            <span className="hidden md:inline">Planilha</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-900 text-white font-medium">
              {summary.totalSteps} <span className="hidden sm:inline">etapas</span>
            </span>
          </button>

          {/* Timing Mode & Settings */}
          <div className="flex items-center shrink-0">
            <button
              onClick={() => {
                const nextVal = !showTimingMode;
                setShowTimingMode(nextVal);
                saveToCloud(activeVersion, nodes, edges, versions, nextVal);
              }}
              className={`px-2 sm:px-2.5 py-1.5 rounded-l-xl text-xs font-semibold transition-all flex items-center gap-1 border ${
                showTimingMode
                  ? 'bg-amber-50 text-amber-900 border-amber-300 border-r-0'
                  : 'bg-zinc-100 text-zinc-500 border-zinc-200 border-r-0 hover:bg-zinc-200'
              }`}
              title="Ativar/Desativar Exibição de Tempos Acumulados no Fluxograma"
            >
              <Clock size={13} className={showTimingMode ? 'text-amber-600' : 'text-zinc-400'} />
              <span className="hidden lg:inline">Tempos:</span>
              <span className="font-bold">{showTimingMode ? 'ON' : 'OFF'}</span>
            </button>
            
            <div className="relative">
              <button
                onClick={() => setShowTimeSettingsMenu(!showTimeSettingsMenu)}
                className={`px-1.5 sm:px-2 py-1.5 rounded-r-xl border transition-all flex items-center ${
                  showTimingMode
                    ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                    : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200'
                }`}
                title="Configurações de formato de tempo"
              >
                <Settings size={13} />
              </button>
              
              {showTimeSettingsMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTimeSettingsMenu(false)} />
                  <div className="absolute top-full right-0 sm:left-1/2 sm:-translate-x-1/2 mt-1 w-64 sm:w-72 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 p-4">
                    <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-2">Formato da Visualização</div>
                    <label className="flex items-center gap-2 text-sm text-zinc-700 py-1.5 cursor-pointer hover:bg-zinc-50 rounded px-1">
                      <input 
                        type="radio" 
                        name="style" 
                        value="hhmmss" 
                        checked={timeSettings.style === 'hhmmss'} 
                        onChange={() => setTimeSettings(s => ({ ...s, style: 'hhmmss' }))} 
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      Formato de tempo (HH:MM:SS)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-700 py-1.5 cursor-pointer hover:bg-zinc-50 rounded px-1">
                      <input 
                        type="radio" 
                        name="style" 
                        value="decimal" 
                        checked={timeSettings.style === 'decimal'} 
                        onChange={() => setTimeSettings(s => ({ ...s, style: 'decimal' }))} 
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      Decimal (segundos)
                    </label>
                    
                    <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mt-4 mb-2">Precisão da Visualização</div>
                    {[
                      { val: 0, label: 'Segundo' },
                      { val: 1, label: 'Décimo de segundo' },
                      { val: 2, label: 'Centésimo de segundo' },
                      { val: 3, label: 'Milésimo de segundo (milissegundo)' }
                    ].map(opt => (
                      <label key={opt.val} className="flex items-center gap-2 text-sm text-zinc-700 py-1.5 cursor-pointer hover:bg-zinc-50 rounded px-1">
                        <input 
                          type="radio" 
                          name="precision" 
                          value={opt.val} 
                          checked={timeSettings.precision === opt.val} 
                          onChange={() => setTimeSettings(s => ({ ...s, precision: opt.val as TimePrecision }))} 
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Auto Layout & Alignment Dropdown */}
          <div className="relative shrink-0">
            <div className="flex items-center bg-zinc-100 rounded-xl p-0.5 border border-zinc-200/60 shadow-sm">
              <button
                onClick={() => applyAutoLayout('TB')}
                className="px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-white hover:shadow-sm rounded-lg transition-all flex items-center gap-1"
                title="Organizar Fluxograma Verticalmente com Linhas Retas (Dagre)"
              >
                <AlignCenterVertical size={13} className="text-blue-600" />
                <span className="hidden md:inline">Organizar ↓</span>
              </button>
              <button
                onClick={() => applyAutoLayout('LR')}
                className="px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-white hover:shadow-sm rounded-lg transition-all flex items-center gap-1 hidden xs:flex"
                title="Organizar Fluxograma Horizontalmente (Dagre)"
              >
                <AlignCenterHorizontal size={13} className="text-blue-600" />
                <span className="hidden md:inline">Organizar →</span>
              </button>
              <button
                onClick={() => setShowAlignMenu(!showAlignMenu)}
                className={`p-1.5 rounded-lg text-zinc-600 hover:bg-white hover:shadow-sm transition-all ${
                  showAlignMenu ? 'bg-white text-blue-600 shadow-sm' : ''
                }`}
                title="Ferramentas de Alinhamento e Distribuição"
              >
                <SlidersHorizontal size={14} />
              </button>
            </div>

            {/* Alignment Dropdown Popover */}
            {showAlignMenu && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowAlignMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Alinhamento Inteligente</span>
                  </div>

                  <button
                    onClick={() => { alignSelectedNodes('straighten-all'); setShowAlignMenu(false); }}
                    className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100/80 rounded-xl flex items-center gap-2 transition-colors mb-1.5"
                  >
                    <Wand2 size={14} className="text-blue-600" />
                    <span>Endireitar & Alinhar Todas as Linhas</span>
                  </button>

                  <div className="h-px bg-zinc-100 my-1" />
                  <div className="px-2 py-0.5">
                    <span className="text-[10px] font-medium text-zinc-400">Alinhar Formas Selecionadas:</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 mt-1">
                    <button
                      onClick={() => { alignSelectedNodes('center-x'); setShowAlignMenu(false); }}
                      className="px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <AlignCenterVertical size={13} className="text-zinc-500" />
                      <span>Centro (X)</span>
                    </button>
                    <button
                      onClick={() => { alignSelectedNodes('center-y'); setShowAlignMenu(false); }}
                      className="px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <AlignCenterHorizontal size={13} className="text-zinc-500" />
                      <span>Centro (Y)</span>
                    </button>
                    <button
                      onClick={() => { alignSelectedNodes('left'); setShowAlignMenu(false); }}
                      className="px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <AlignLeft size={13} className="text-zinc-500" />
                      <span>À Esquerda</span>
                    </button>
                    <button
                      onClick={() => { alignSelectedNodes('right'); setShowAlignMenu(false); }}
                      className="px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <AlignRight size={13} className="text-zinc-500" />
                      <span>À Direita</span>
                    </button>
                    <button
                      onClick={() => { alignSelectedNodes('top'); setShowAlignMenu(false); }}
                      className="px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <AlignStartVertical size={13} className="text-zinc-500" />
                      <span>Ao Topo</span>
                    </button>
                    <button
                      onClick={() => { alignSelectedNodes('bottom'); setShowAlignMenu(false); }}
                      className="px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <AlignEndVertical size={13} className="text-zinc-500" />
                      <span>À Base</span>
                    </button>
                  </div>

                  <div className="h-px bg-zinc-100 my-1.5" />
                  <div className="px-2 py-0.5">
                    <span className="text-[10px] font-medium text-zinc-400">Distribuição Uniforme:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    <button
                      onClick={() => { alignSelectedNodes('distribute-v'); setShowAlignMenu(false); }}
                      className="px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <span>Espaço Vertical</span>
                    </button>
                    <button
                      onClick={() => { alignSelectedNodes('distribute-h'); setShowAlignMenu(false); }}
                      className="px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <span>Espaço Horiz.</span>
                    </button>
                  </div>

                  <div className="h-px bg-zinc-100 my-1.5" />
                  <div className="px-2 py-0.5">
                    <span className="text-[10px] font-medium text-zinc-400">Camadas das Linhas (Todas):</span>
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    <button
                      onClick={() => { handleRequestGlobalEdgeZIndex('back'); setShowAlignMenu(false); }}
                      className="w-full px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors"
                      title="Define para todas as linhas passarem por trás das formas (padrão)"
                    >
                      <ArrowDownToLine size={13} className="text-blue-600" />
                      <span>Todas por Trás (Padrão)</span>
                    </button>
                    <button
                      onClick={() => { handleRequestGlobalEdgeZIndex('front'); setShowAlignMenu(false); }}
                      className="w-full px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors"
                      title="Define para todas as linhas passarem por cima das formas"
                    >
                      <ArrowUpToLine size={13} className="text-amber-600" />
                      <span>Todas por Cima</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Presentation Mode Trigger */}
          <button
            onClick={() => setIsPresentationMode(!isPresentationMode)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              isPresentationMode
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
            title="Apresentar Fluxograma Passo a Passo"
          >
            <Play size={14} /> <span className="hidden lg:inline">Apresentar</span>
          </button>

          {/* Import Button */}
          <button
            onClick={triggerImportFile}
            className="px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
            title="Importar Arquivo de Fluxograma (.json, .drawio, .xml)"
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Importar</span>
          </button>

          {/* Hidden File Input for Import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json,.labirinto,.flowsync,.drawio,.xml"
            className="hidden"
          />

          {/* Compartilhamento (arquivo .json — sem nuvem) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowShareModal(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
              title="Compartilhar o fluxograma (arquivo .json)"
            >
              <Users size={13} className="text-blue-600" />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>
          </div>

          {/* Export Menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-2.5 sm:px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1 sm:gap-1.5 shadow-sm"
            >
              <Download size={14} /> <span className="hidden sm:inline">Exportar</span> <ChevronDown size={12} />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Importação & Backup</div>
                  <button
                    onClick={() => { setShowImportFlowModal(true); setShowExportMenu(false); }}
                    className="w-full px-4 py-2 text-left font-semibold text-blue-700 bg-blue-50/70 hover:bg-blue-100/80 flex items-center justify-between"
                    title="Copiar as etapas de outro fluxograma e juntar a este"
                  >
                    <span>Trazer fluxo de outro arquivo</span>
                    <Layers size={14} className="text-blue-600" />
                  </button>
                  <button
                    onClick={() => { handleCopyFlow(); setShowExportMenu(false); }}
                    className="w-full px-4 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-50 flex items-center justify-between"
                    title="Copia a seleção (ou a versão inteira) para colar em outro fluxograma com Ctrl+V"
                  >
                    <span>Copiar fluxo desta versão</span>
                    <Copy size={14} className="text-zinc-500" />
                  </button>
                  <button
                    onClick={() => { handlePasteFlow(); setShowExportMenu(false); }}
                    className="w-full px-4 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-50 flex items-center justify-between"
                    title="Cola o fluxo copiado em outro fluxograma (Ctrl+V)"
                  >
                    <span>Colar fluxo copiado</span>
                    <ClipboardPaste size={14} className="text-zinc-500" />
                  </button>
                  <div className="my-1 h-px bg-zinc-100" />
                  <button
                    onClick={() => { triggerImportFile(); setShowExportMenu(false); }}
                    className="w-full px-4 py-2 text-left font-semibold text-blue-700 bg-blue-50/70 hover:bg-blue-100/80 flex items-center justify-between"
                    title="Importar um arquivo de fluxograma salvo anteriormente"
                  >
                    <span>Importar Fluxograma (.json)</span>
                    <Upload size={14} className="text-blue-600" />
                  </button>
                  <button
                    onClick={() => { exportJson(); setShowExportMenu(false); }}
                    className="w-full px-4 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-50 flex items-center justify-between"
                    title="Exporta o arquivo JSON nativo com todas as versões, posições e tempos para re-editar a qualquer momento neste site"
                  >
                    <span>Exportar Backup (.json)</span>
                    <FileJson size={14} className="text-zinc-500" />
                  </button>

                  <div className="h-px bg-zinc-100 my-1" />
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Formatos Visuais {showTimingMode ? '(Com Tempos)' : '(Sem Tempos)'}</div>
                  <button
                    onClick={() => { exportPng(); setShowExportMenu(false); }}
                    className="w-full px-4 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-50 flex items-center justify-between"
                  >
                    <span>Imagem (PNG)</span>
                    <span className="text-[10px] text-zinc-400">Visual HD</span>
                  </button>
                  <button
                    onClick={() => { exportSvg(); setShowExportMenu(false); }}
                    className="w-full px-4 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-50 flex items-center justify-between"
                  >
                    <span>Vetor (SVG)</span>
                    <span className="text-[10px] text-zinc-400">Sem perda</span>
                  </button>
                  <button
                    onClick={() => { exportPdf(); setShowExportMenu(false); }}
                    className="w-full px-4 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-50 flex items-center justify-between"
                  >
                    <span>Documento (PDF)</span>
                    <span className="text-[10px] text-zinc-400">Relatório A4</span>
                  </button>
                  <button
                    onClick={() => { exportTableToCSV(nodes, edges); setShowExportMenu(false); }}
                    className="w-full px-4 py-2 text-left font-medium text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/70 flex items-center justify-between"
                  >
                    <span>Tabela de Processos (CSV)</span>
                    <FileSpreadsheet size={14} className="text-emerald-600" />
                  </button>

                  <div className="h-px bg-zinc-100 my-1" />
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Compatibilidade com Outros Apps</div>
                  <button
                    onClick={() => { exportDrawio(); setShowExportMenu(false); }}
                    className="w-full px-4 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-50 flex items-center justify-between"
                    title="Padrão XML para abrir e editar no Diagrams.net / Draw.io sem erros"
                  >
                    <span>Diagrams.net / Draw.io</span>
                    <span className="text-[10px] text-zinc-400">.drawio</span>
                  </button>
                  <button
                    onClick={() => { exportBpmn(); setShowExportMenu(false); }}
                    className="w-full px-4 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-50 flex items-center justify-between"
                    title="Padrão BPMN 2.0 XML compatível com Camunda, bpmn.io e softwares de processo. No Bizagi Modeler: use a aba Export/Import → Importar BPMN (não abre direto como um modelo .bpm nativo)"
                  >
                    <span>Padrão BPMN 2.0</span>
                    <span className="text-[10px] text-zinc-400">.bpmn</span>
                  </button>
                  <button
                    onClick={() => { exportBizagi(); setShowExportMenu(false); }}
                    className="w-full px-4 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-50 flex items-center justify-between"
                    title="Formato nativo do Bizagi Modeler — abre direto, como um arquivo salvo pelo próprio Bizagi"
                  >
                    <span>Bizagi Modeler</span>
                    <span className="text-[10px] text-zinc-400">.bpm</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MIRO CANVAS WORKSPACE */}
      <div className="flex-1 relative flex overflow-hidden" ref={reactFlowWrapper}>
        {/* LEFT DOCKED MIRO TOOLBAR */}
        <div className="absolute left-3 top-3 z-40">
          <MiroToolbar
            toolMode={toolMode}
            setToolMode={setToolMode}
            onAddNode={handleAddNode}
            onAddFreeEdge={() => setIsPlacingFreeEdge(true)}
            isPlacingFreeEdge={isPlacingFreeEdge}
            onOpenTemplates={() => setShowTemplatesModal(true)}
            onOpenAI={() => setShowAIModal(true)}
            isNavigationMode={isNavigationMode}
            setIsNavigationMode={setIsNavigationMode}
          />
        </div>

        {/* Modo Navegação — aviso fixo no topo enquanto ativo, pra deixar
            claro que edição/seleção estão travadas de propósito. */}
        {isNavigationMode && (
          <div className="absolute left-1/2 -translate-x-1/2 top-3 z-40 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-2xl shadow-xl text-xs font-bold">
            <Eye size={14} />
            <span>Modo Navegação — só visualizar (pan/zoom), sem editar</span>
            <button
              onClick={() => setIsNavigationMode(false)}
              className="ml-1 px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
            >
              Sair
            </button>
          </div>
        )}

        {/* Modo de posicionar a seta/linha independente — aviso no topo até o clique no canvas */}
        {isPlacingFreeEdge && !isNavigationMode && (
          <div className="absolute left-1/2 -translate-x-1/2 top-3 z-40 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-2xl shadow-xl text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-150">
            <Spline size={14} />
            <span>Clique no canvas para posicionar a linha</span>
            <button
              onClick={() => setIsPlacingFreeEdge(false)}
              className="ml-1 px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
            >
              Cancelar (Esc)
            </button>
          </div>
        )}

        {/* BOTTOM CENTER CANVAS CONTROLS (Undo, Redo, History Jump, Zoom, Fit) */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-3 z-30 flex items-center gap-1 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-xl border border-zinc-200/90">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent rounded-xl text-zinc-600 transition-colors cursor-pointer"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent rounded-xl text-zinc-600 transition-colors cursor-pointer"
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>

          {/* Jump-to-History Timeline Button */}
          <div className="relative">
            <button
              onClick={() => setShowHistoryMenu(!showHistoryMenu)}
              className={`p-1.5 rounded-xl transition-colors flex items-center gap-1 cursor-pointer ${
                showHistoryMenu ? 'bg-blue-100 text-blue-700 font-bold' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
              title="Histórico de Ações (Voltar diretamente para um ponto)"
            >
              <History size={16} />
              {history.length > 1 && (
                <span className="text-[10px] font-bold bg-blue-600 text-white rounded-full px-1.5 py-0.2">
                  {historyIndex + 1}/{history.length}
                </span>
              )}
            </button>

            {/* History Jump Popover Menu */}
            {showHistoryMenu && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowHistoryMenu(false)} />
                <div 
                  className="absolute bottom-12 left-1/2 -translate-x-1/2 w-72 bg-white rounded-2xl shadow-2xl border border-zinc-200/90 p-3 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <History size={14} className="text-blue-600" />
                      <span className="text-xs font-bold text-zinc-900">Histórico de Ações</span>
                    </div>
                    <button
                      onClick={() => setShowHistoryMenu(false)}
                      className="w-5 h-5 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 text-xs"
                    >
                      ✕
                    </button>
                  </div>

                <p className="text-[10.5px] text-zinc-500 mb-2">
                  Clique diretamente em qualquer ponto para restaurar o fluxograma exatamente naquele momento:
                </p>

                <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {history.map((step, idx) => {
                    const isCurrent = idx === historyIndex;
                    const isFuture = idx > historyIndex;
                    const timeStr = new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                    return (
                      <button
                        key={step.id || idx}
                        onClick={() => handleJumpToHistory(idx)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                          isCurrent
                            ? 'bg-blue-50 border border-blue-200 text-blue-900 font-semibold shadow-xs'
                            : isFuture
                            ? 'hover:bg-zinc-100 text-zinc-400'
                            : 'hover:bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-blue-600' : isFuture ? 'bg-zinc-300' : 'bg-emerald-500'}`} />
                          <span className="truncate">{step.action || `Passo ${idx + 1}`}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <span className="text-[10px] text-zinc-400">{timeStr}</span>
                          {isCurrent && (
                            <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                              Atual
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          </div>

          <div className="w-px h-5 bg-zinc-200 mx-1" />
          <button
            onClick={() => zoomIn()}
            className="p-1.5 hover:bg-zinc-100 rounded-xl text-zinc-600 transition-colors cursor-pointer"
            title="Aumentar Zoom (+)"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => zoomOut()}
            className="p-1.5 hover:bg-zinc-100 rounded-xl text-zinc-600 transition-colors cursor-pointer"
            title="Diminuir Zoom (-)"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => fitView({ padding: 0.25, duration: 400, minZoom: 0.02 })}
            className="p-1.5 hover:bg-zinc-100 rounded-xl text-zinc-600 transition-colors cursor-pointer"
            title="Ajustar Todo o Fluxograma na Tela (F)"
          >
            <Maximize2 size={16} />
          </button>
          <div className="w-px h-5 bg-zinc-200 mx-1" />
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className={`p-1.5 rounded-xl transition-colors ${showMinimap ? 'bg-blue-100 text-blue-700' : 'text-zinc-600 hover:bg-zinc-100'}`}
            title="Alternar Minimapa"
          >
            <MapPin size={16} />
          </button>
          {hasActiveSelection && (
            <>
              <div className="w-px h-5 bg-zinc-200 mx-1" />
              <button
                onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                className={`p-1.5 rounded-xl transition-colors ${isRightSidebarOpen ? 'bg-blue-100 text-blue-700' : 'text-zinc-600 hover:bg-zinc-100'}`}
                title={isRightSidebarOpen ? 'Ocultar Painel Lateral de Edição' : 'Exibir Painel Lateral de Edição'}
              >
                {isRightSidebarOpen ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </>
          )}
        </div>

        {/* RIGHT DOCKED SIDEBAR INSPECTOR (COMPACT, NON-OVERLAPPING, HIDEABLE) */}
        {hasActiveSelection && isRightSidebarOpen && (
          <aside className="absolute right-3 top-3 bottom-16 w-80 sm:w-84 z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-zinc-200/90 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
            {selectedNodesList.length > 0 && selectedEdgesList.length === 0 ? (
              <MiroNodeToolbar
                node={selectedNodesList[0]}
                selectedNodes={selectedNodesList}
                selectedCount={selectedNodesList.length}
                onUpdateLabel={updateNodeLabel}
                onUpdateStyle={updateNodeStyle}
                onUpdateBulkStyle={updateBulkNodeStyle}
                onUpdateDimensions={handleBulkDimensions}
                onUpdateType={updateNodeType}
                onUpdateBulkType={updateBulkNodeType}
                onUpdateTag={updateNodeTag}
                onUpdateBulkTag={updateBulkNodeTag}
                onDuplicate={handleDuplicateNode}
                onDuplicateBulk={handleDuplicateBulkNodes}
                onDelete={handleDeleteNode}
                onDeleteBulk={handleDeleteBulkNodes}
                onOpenTimingModal={(id) => setTimingModalNodeId(id)}
                onCloseToolbar={handleClearAllSelection}
                onHideSidebar={() => setIsRightSidebarOpen(false)}
              />
            ) : selectedEdgesList.length > 0 && selectedNodesList.length === 0 ? (
              <MiroEdgeToolbar
                edge={selectedEdgesList[0]}
                selectedEdges={selectedEdgesList}
                nodes={nodes}
                onUpdateEdge={updateEdge}
                onUpdateBulkEdge={updateBulkEdge}
                onDeleteEdge={handleDeleteEdge}
                onDeleteBulkEdge={handleDeleteBulkEdges}
                onStartReconnecting={(endpoint) => setReconnectingEndpoint(endpoint)}
                reconnectingEndpoint={reconnectingEndpoint}
                onCloseToolbar={handleClearAllSelection}
                onHideSidebar={() => setIsRightSidebarOpen(false)}
                onApplyZIndexAll={handleRequestGlobalEdgeZIndex}
              />
            ) : (
              <MiroMixedSelectionToolbar
                selectedNodes={selectedNodesList}
                selectedEdges={selectedEdgesList}
                onDeleteAll={handleDeleteAllSelected}
                onClearSelection={handleClearAllSelection}
                onHideSidebar={() => setIsRightSidebarOpen(false)}
                onUpdateBulkStyle={updateBulkNodeStyle}
              />
            )}
          </aside>
        )}

        {/* COMPACT FLOATING TAB BUTTON ON RIGHT EDGE WHEN SIDEBAR IS HIDDEN */}
        {hasActiveSelection && !isRightSidebarOpen && (
          <button
            onClick={() => setIsRightSidebarOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-white border border-zinc-200 shadow-xl rounded-l-2xl px-2.5 py-3 text-blue-600 hover:bg-blue-50 font-bold z-40 flex flex-col items-center gap-1.5 text-xs transition-all cursor-pointer hover:pl-3"
            title="Exibir Painel Lateral de Opções de Edição"
          >
            <Sliders size={16} />
            <span className="[writing-mode:vertical-lr] tracking-wide text-[11px] font-bold">Opções</span>
          </button>
        )}

        {/* MAIN REACT FLOW CANVAS */}
        <main className="w-full h-full">
          <ReactFlow
            nodes={enrichedNodes}
            edges={enrichedEdges}
            nodeTypes={customNodeTypes}
            edgeTypes={customEdgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onConnect={onConnect}
            
            isValidConnection={() => true}
            onEdgeClick={onEdgeClick}
            elevateEdgesOnSelect={false}
            elevateNodesOnSelect={true}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            onReconnectStart={onReconnectStart}
            onReconnect={onReconnect}
            onReconnectEnd={onReconnectEnd}
            edgesReconnectable={!isNavigationMode && ((edge: Edge) => edge.id === selectedEdge?.id || !!edge.selected)}
            reconnectRadius={40}
            onPaneClick={onPaneClick}
            onDrop={isNavigationMode ? undefined : onDrop}
            onDragOver={isNavigationMode ? undefined : onDragOver}
            panOnDrag={isNavigationMode || toolMode === 'pan'}
            selectionOnDrag={!isNavigationMode && toolMode === 'select'}
            // Desliga o auto-scroll durante a seleção por arraste: perto da
            // borda do canvas ele rola o conteúdo por baixo do mouse
            // enquanto a caixa de seleção ainda está aberta, varrendo (e
            // selecionando) formas/linhas que passaram a ficar dentro da
            // caixa só por causa da rolagem — nunca porque o mouse de fato
            // passou por cima delas. Sem isso, "selecionei uma coisa e veio
            // outra junto que eu nem toquei" quando o arraste começa perto
            // do limite da tela.
            autoPanOnSelection={false}
            multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
            connectionMode={ConnectionMode.Loose}
            snapToGrid={true}
            snapGrid={[10, 10]}
            minZoom={0.02}
            maxZoom={4}
            fitView
            fitViewOptions={{ padding: 0.25, duration: 400, minZoom: 0.02 }}
            deleteKeyCode={null}
            // Modo Navegação: trava tudo que edita o fluxo, sobrando só
            // pan/zoom — elementsSelectable=false também impede o React
            // Flow de deixar qualquer coisa selecionada (o que já esconde
            // alças de redimensionar/ajustar linha e toolbars contextuais,
            // já que tudo isso é condicionado a "selected").
            nodesDraggable={!isNavigationMode}
            nodesConnectable={!isNavigationMode}
            elementsSelectable={!isNavigationMode}
            nodesFocusable={!isNavigationMode}
            edgesFocusable={!isNavigationMode}
            defaultEdgeOptions={{
              type: 'smoothstep',
              reconnectable: true,
              markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
              style: { stroke: '#0f172a', strokeWidth: 2 }
            }}
            className={`bg-zinc-50 ${isConnecting ? "is-connecting" : ""} ${isNavigationMode ? "cursor-default" : ""} ${hasSelectedEdge ? "edge-selected-mode" : ""}`}
            style={isPlacingFreeEdge ? { cursor: FREE_EDGE_CURSOR } : undefined}
          >
            {/* Dot Grid */}
            <Background color="#cbd5e1" gap={20} size={1.5} />

            {/* Minimap Dock (Bottom Right with live viewport tracker and resizing) */}
            {showMinimap ? (
              <Panel position="bottom-right" className="!m-4 !p-0 z-30">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-zinc-200/90 p-2.5 select-none transition-all duration-200">
                  {/* Header with Title, Size Controls & Close */}
                  <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-zinc-100 gap-2">
                    <div className="flex items-center gap-1.5 text-zinc-800">
                      <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                        <MapPin size={12} />
                      </div>
                      <span className="text-[11px] font-bold tracking-tight text-zinc-800">Minimapa</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Rastreamento em tempo real" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Size switcher */}
                      <div className="flex bg-zinc-100 rounded-lg p-0.5 text-[10px] font-bold text-zinc-600">
                        <button
                          onClick={() => setMinimapSize('sm')}
                          className={`px-1.5 py-0.5 rounded-md transition-colors ${
                            minimapSize === 'sm' ? 'bg-white shadow-xs text-blue-600' : 'hover:text-zinc-900'
                          }`}
                          title="Tamanho Pequeno (180px)"
                        >
                          P
                        </button>
                        <button
                          onClick={() => setMinimapSize('md')}
                          className={`px-1.5 py-0.5 rounded-md transition-colors ${
                            minimapSize === 'md' ? 'bg-white shadow-xs text-blue-600' : 'hover:text-zinc-900'
                          }`}
                          title="Tamanho Médio (250px)"
                        >
                          M
                        </button>
                        <button
                          onClick={() => setMinimapSize('lg')}
                          className={`px-1.5 py-0.5 rounded-md transition-colors ${
                            minimapSize === 'lg' ? 'bg-white shadow-xs text-blue-600' : 'hover:text-zinc-900'
                          }`}
                          title="Tamanho Grande (340px)"
                        >
                          G
                        </button>
                      </div>

                      {/* Hide button */}
                      <button
                        onClick={() => setShowMinimap(false)}
                        className="p-1 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-md transition-colors"
                        title="Ocultar Minimapa"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  {/* React Flow Minimap Canvas */}
                  <div className="rounded-xl overflow-hidden border border-zinc-200/60 bg-slate-50">
                    <MiniMap
                      className="!static !m-0 !border-0 !shadow-none !bg-slate-50"
                      style={{
                        width: minimapSize === 'sm' ? 180 : minimapSize === 'md' ? 250 : 340,
                        height: minimapSize === 'sm' ? 115 : minimapSize === 'md' ? 160 : 220,
                      }}
                      nodeStrokeColor={(n) => {
                        if (n.type === 'junction') return 'transparent';
                        return '#2563eb';
                      }}
                      nodeColor={(n) => {
                        if (n.type === 'junction') return 'transparent';
                        if (n.type === 'start' || n.type === 'end') return '#3b82f6';
                        if (n.type === 'decision') return '#a855f7';
                        return (n.style?.backgroundColor as string) || '#cbd5e1';
                      }}
                      nodeBorderRadius={4}
                      maskColor="rgba(37, 99, 235, 0.15)"
                      maskStrokeColor="#2563eb"
                      maskStrokeWidth={2}
                      zoomable={true}
                      pannable={true}
                    />
                  </div>
                </div>
              </Panel>
            ) : (
              <Panel position="bottom-right" className="!m-4 z-30">
                <button
                  onClick={() => setShowMinimap(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/95 hover:bg-blue-50 backdrop-blur-md border border-zinc-200 rounded-xl shadow-lg text-xs font-semibold text-zinc-700 hover:text-blue-600 transition-all hover:scale-105"
                  title="Abrir Minimapa"
                >
                  <MapPin size={14} className="text-blue-600" />
                  <span>Minimapa</span>
                </button>
              </Panel>
            )}
          </ReactFlow>
        </main>
      </div>

      {/* SYNCHRONIZED PROCESS SPREADSHEET / DATA TABLE PANEL
          Em Modo Navegação, os callbacks que editam vão vazios (a planilha
          continua ABRINDO — é útil pra revisar os tempos calculados — só
          não deixa nada ser alterado nela) */}
      <FlowDataTable
        isOpen={isDataTableOpen}
        onClose={() => setIsDataTableOpen(false)}
        nodes={nodes}
        edges={edges}
        timeSettings={timeSettings}
        onUpdateNodeLabel={isNavigationMode ? () => {} : updateNodeLabel}
        onUpdateNodeTiming={isNavigationMode ? () => {} : updateNodeTiming}
        onAddStep={isNavigationMode ? () => {} : (type, label) => handleAddNode(type || 'process', { label })}
        onDeleteNode={isNavigationMode ? () => {} : handleDeleteNode}
        onFocusNode={(nodeId) => {
          const targetNode = nodes.find(n => n.id === nodeId);
          if (targetNode) {
            setCenter(targetNode.position.x + 100, targetNode.position.y + 30, { zoom: 1.3, duration: 500 });
            if (!isNavigationMode) setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeId })));
          }
        }}
        onOpenTimingModal={isNavigationMode ? () => {} : (nodeId) => setTimingModalNodeId(nodeId)}
        showTimingMode={showTimingMode}
        onToggleTimingMode={() => {
          const nextVal = !showTimingMode;
          setShowTimingMode(nextVal);
          saveToCloud(activeVersion, nodes, edges, versions, nextVal);
        }}
      />

      {/* TIMING CONFIGURATION MODAL */}
      <TimingModal
        isOpen={!!timingModalNodeId}
        onClose={() => setTimingModalNodeId(null)}
        node={nodes.find(n => n.id === timingModalNodeId) || null}
        onSaveTiming={(id, timing) => updateNodeTiming(id, timing)}
        timeSettings={timeSettings}
      />

      {/* GOOGLE DRIVE SHARE MODAL */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        diagramTitle={title}
        jsonText={JSON.stringify({ title, versions }, null, 2)}
        onDownloadJson={exportJson}
      />

      <ImportFlowModal
        isOpen={showImportFlowModal}
        onClose={() => setShowImportFlowModal(false)}
        currentDiagramId={diagramId}
        onApply={applyIncomingFlow}
      />

      {/* MIRO TEMPLATES MODAL */}
      <MiroTemplatesModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        onApplyTemplate={handleApplyTemplate}
      />

      {/* MIRO PRESENTATION MODE CONTROLLER */}
      <MiroPresentationMode
        isOpen={isPresentationMode}
        onClose={() => setIsPresentationMode(false)}
        title={title}
        nodes={nodes}
        onFocusNode={(nodeId) => {
          const targetNode = nodes.find(n => n.id === nodeId);
          if (targetNode) {
            setCenter(targetNode.position.x + 100, targetNode.position.y + 50, { zoom: 1.3, duration: 600 });
          }
        }}
      />

      {/* MIRO ASSIST AI GENERATOR MODAL */}
      {showAIModal && !isGenerating && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
          onClick={requestCloseAIModal}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 border border-zinc-200 animate-in fade-in zoom-in-95 duration-150 custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900">Assistente IA • Gerador de Fluxogramas</h3>
                  <p className="text-xs text-zinc-500">Descreva qualquer fluxo de negócio, técnico ou operacional.</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={openAIConfig}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-xs font-bold text-zinc-700 transition-all"
                  title="Escolher a IA e cadastrar chaves de API"
                >
                  Configurar IA
                </button>
              <button
                onClick={requestCloseAIModal}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                ✕
              </button>
              </div>
            </div>

            <div
              className={`mb-4 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                aiProvider.ready
                  ? 'bg-blue-50/60 border-blue-200'
                  : 'bg-amber-50 border-amber-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${aiProvider.ready ? 'bg-emerald-500' : 'bg-amber-500'}`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-800 truncate">
                    IA selecionada: {aiProvider.name}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    {aiProvider.ready
                      ? `Modelo: ${aiProvider.model}${aiProvider.keyless ? ' • sem chave, cota pública' : ''}`
                      : 'Sem chave cadastrada — cadastre uma ou use o modo gratuito.'}
                  </div>
                </div>
              </div>
              <button
                onClick={openAIConfig}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-white border border-zinc-200 hover:border-blue-300 hover:text-blue-700 text-[11px] font-bold text-zinc-600 transition-all"
                title="Trocar de IA ou cadastrar chaves"
              >
                Trocar
              </button>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                Níveis de Detalhe a Gerar Simultaneamente:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['simples', 'normal', 'detalhado'].map(c => {
                  const isChecked = selectedComplexities.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        if (isChecked && selectedComplexities.length === 1) return;
                        setSelectedComplexities(
                          isChecked ? selectedComplexities.filter(x => x !== c) : [...selectedComplexities, c]
                        );
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize flex items-center justify-center gap-1.5 transition-all ${
                        isChecked
                          ? 'border-blue-600 bg-blue-50/60 text-blue-700 font-bold'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      {isChecked && <Check size={14} />}
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                Descrição do Processo ou Anexos:
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={deriveFromExisting}
                placeholder="Exemplo: Processo de compras com cotação de 3 fornecedores, aprovação da diretoria, emissão de pedido..."
                className="w-full h-24 p-3.5 text-sm border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-zinc-50/50 disabled:opacity-50"
              />
              
              <div className="mt-2 flex flex-col gap-2">
                 <input type="file" id="ai-file-upload" multiple className="hidden" accept=".txt,.csv,.pdf,.docx,.xlsx,.xls,image/*" onChange={handleAiFileUpload} disabled={deriveFromExisting} />
                 <div className="flex flex-wrap gap-2 items-center">
                    <label htmlFor="ai-file-upload" className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${deriveFromExisting ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer'}`}>
                       <Paperclip size={14} /> Anexar Arquivos
                    </label>
                    {aiFiles.map((file, i) => (
                       <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 text-xs rounded-md flex items-center gap-1">
                          {file.name}
                          <button type="button" onClick={() => removeAiFile(i)} className="hover:text-blue-900 ml-1 cursor-pointer"><X size={12} /></button>
                       </span>
                    ))}
                 </div>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setShowAIOptions(!showAIOptions)} 
              className="text-xs text-blue-600 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-4 hover:text-blue-800 transition-colors cursor-pointer"
            >
               {showAIOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />} 
               Mais opções de geração
            </button>

            {showAIOptions && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-4 mb-5 border-t border-zinc-100 pt-4">
                {/* Formas Permitidas para a IA */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                      Formas Permitidas para a IA:
                    </label>
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      {allowedShapeTypes.length} formas ativas
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 custom-scrollbar mb-2.5">
                    {[
                      {
                        name: 'Essenciais',
                        count: 5,
                        types: ['start', 'end', 'process', 'decision', 'inputoutput']
                      },
                      {
                        name: 'Padrão / Negócios',
                        count: 9,
                        types: ['start', 'end', 'process', 'decision', 'inputoutput', 'document', 'database', 'subprocess', 'cloud']
                      },
                      {
                        name: 'Engenharia & Operações',
                        count: 10,
                        types: ['start', 'end', 'process', 'decision', 'preparation', 'manualoperation', 'manualinput', 'delay', 'internalstorage', 'display']
                      },
                      {
                        name: 'Todas as Formas',
                        count: ALL_SHAPE_CATEGORIES.flatMap(c => c.shapes).length,
                        types: ALL_SHAPE_CATEGORIES.flatMap(c => c.shapes.map(s => s.type))
                      }
                    ].map(preset => {
                      const isPresetActive = preset.types.length === allowedShapeTypes.length && 
                        preset.types.every(t => allowedShapeTypes.includes(t));
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setAllowedShapeTypes(preset.types)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors cursor-pointer ${
                            isPresetActive
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-zinc-200 rounded-xl p-2.5 bg-zinc-50/50 space-y-3 custom-scrollbar">
                    {ALL_SHAPE_CATEGORIES.map(cat => (
                      <div key={cat.category}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 px-1">
                          {cat.category}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {cat.shapes.map(shape => {
                            const isSelected = allowedShapeTypes.includes(shape.type);
                            return (
                              <button
                                key={shape.type}
                                type="button"
                                onClick={() => {
                                  if (isSelected && allowedShapeTypes.length === 1) return;
                                  setAllowedShapeTypes(
                                    isSelected
                                      ? allowedShapeTypes.filter(t => t !== shape.type)
                                      : [...allowedShapeTypes, shape.type]
                                  );
                                }}
                                className={`flex items-center gap-2 p-1.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-white border-blue-500 shadow-xs text-zinc-900 font-semibold ring-1 ring-blue-500/20'
                                    : 'bg-white/60 border-zinc-200/80 text-zinc-500 hover:bg-white hover:text-zinc-700 opacity-60'
                                }`}
                              >
                                <span className="text-base shrink-0">{shape.icon}</span>
                                <span className="truncate text-[11px] flex-1">{shape.label}</span>
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                  isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300'
                                }`}>
                                  {isSelected && <Check size={10} />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 border border-blue-100 bg-blue-50/50 rounded-xl space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="deriveFromExisting"
                      checked={deriveFromExisting}
                      onChange={(e) => {
                        setDeriveFromExisting(e.target.checked);
                        if (e.target.checked) setAiFiles([]);
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="deriveFromExisting" className="text-sm font-semibold text-zinc-800 cursor-pointer">
                      Usar fluxo atual para derivar as outras versões
                    </label>
                  </div>
                  
                  {deriveFromExisting && (
                    <div className="pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="text-xs font-bold text-zinc-600 block mb-1.5">Derivar a partir de:</label>
                      <select
                        value={sourceVersion}
                        onChange={e => setSourceVersion(e.target.value)}
                        className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 bg-white"
                      >
                        {['simples', 'normal', 'detalhado'].map(v => {
                          const count = versions[v]?.nodes?.length || 0;
                          return (
                            <option key={v} value={v} disabled={count === 0}>
                              {v.charAt(0).toUpperCase() + v.slice(1)} {count === 0 ? '(Vazio)' : `(${count} nós)`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>

                {selectedComplexities.some(c => versions[c]?.nodes?.length > 0) && (
                  <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <h4 className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      Atenção: Algumas versões selecionadas já possuem conteúdo.
                    </h4>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm text-amber-900 cursor-pointer">
                        <input 
                          type="radio" 
                          checked={overwriteMode} 
                          onChange={() => setOverwriteMode(true)}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span><b>Substituir tudo:</b> Apagar o fluxo existente e criar um novo do zero.</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-amber-900 cursor-pointer">
                        <input 
                          type="radio" 
                          checked={!overwriteMode} 
                          onChange={() => setOverwriteMode(false)}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span><b>Adicionar (Sem apagar):</b> Gerar o novo fluxo ao lado do que já existe na tela.</span>
                      </label>
                    </div>
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t border-zinc-100 space-y-2">
                  <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                    Comportamento ao fechar:
                  </label>
                  <select
                    value={clearAIPref}
                    onChange={e => setClearAIPref(e.target.value as 'ask' | 'always' | 'never')}
                    className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="ask">Perguntar se deve limpar os dados</option>
                    <option value="always">Sempre limpar descrição e arquivos</option>
                    <option value="never">Nunca limpar (Lembrar preenchimento)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 mt-4">
              <button
                onClick={openManualAIModal}
                title="Sem chave de IA cadastrada aqui? Copie um prompt pronto para colar em qualquer chat de IA e cole a resposta de volta. Pode abrir mesmo sem escrever nada aqui, se for só anexar um arquivo direto no chat."
                className="px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:text-blue-700 hover:bg-blue-50 border border-zinc-200 hover:border-blue-300 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <ClipboardPaste size={14} />
                Gerar Manualmente
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={requestCloseAIModal}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAIGenerateClick}
                  disabled={(!deriveFromExisting && !prompt.trim() && aiFiles.length === 0)}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles size={16} />
                  Gerar com IA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GERAR MANUALMENTE COM OUTRA IA — sem cadastrar chave aqui */}
      {showManualAIModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
          onClick={() => { setShowManualAIModal(false); setShowAIModal(true); }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 border border-zinc-200 animate-in fade-in zoom-in-95 duration-150 custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-zinc-700 to-zinc-900 flex items-center justify-center text-white shadow-md">
                  <ClipboardPaste size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900">Gerar Manualmente com Outra IA</h3>
                  <p className="text-xs text-zinc-500">Sem cadastrar chave nenhuma aqui — use qualquer chat de IA que você já tenha.</p>
                </div>
              </div>
              <button
                onClick={() => { setShowManualAIModal(false); setShowAIModal(true); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="mb-5">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                1. Copie este prompt e cole num chat de IA (ChatGPT, Gemini, Claude.ai...)
              </label>
              <p className="text-[11px] text-zinc-500 mb-2 leading-relaxed">
                O que você escreveu na Descrição do Processo (se escreveu algo) fica no final deste prompt.
                Pode não ter nenhum texto ali — nesse caso é só anexar um arquivo direto no chat de IA e
                pedir para analisar; também pode ter texto e arquivo anexado juntos.
              </p>
              <textarea
                readOnly
                value={buildManualPromptText()}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full h-40 p-3 text-[11px] font-mono leading-relaxed border border-zinc-200 rounded-2xl outline-none resize-none bg-zinc-50 text-zinc-700 custom-scrollbar"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyText(buildManualPromptText());
                    if (ok) showToast({ message: 'Prompt copiado. Cole num chat de IA.', timeout: 5000 });
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white flex items-center gap-1.5 transition-colors"
                >
                  <Copy size={13} /> Copiar Prompt
                </button>
                {aiFiles.length > 0 && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                    Anexe também no chat: {aiFiles.map(f => f.name).join(', ')}
                  </span>
                )}
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                2. Cole aqui a resposta que a IA devolveu
              </label>
              <textarea
                value={manualPasteText}
                onChange={(e) => setManualPasteText(e.target.value)}
                placeholder={'{"progress": 10}\n{"version": "normal", "node": {...}}\n...'}
                className="w-full h-40 p-3 text-[11px] font-mono leading-relaxed border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white"
              />
              <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                Pode colar exatamente como a IA respondeu, com ``` de bloco de código ou algum texto explicando antes/depois — o app ignora tudo que não for uma linha de dado válida.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowManualAIModal(false); setShowAIModal(true); }}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleManualPasteGenerate}
                disabled={!manualPasteText.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-zinc-800 to-zinc-950 hover:from-zinc-900 hover:to-black disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Sparkles size={16} />
                Gerar Fluxograma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFLITO / DECISÃO DE VERSÃO NA GERAÇÃO POR IA */}
      {showAIConflictModal && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setShowAIConflictModal(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 border border-zinc-200 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base sm:text-lg text-zinc-900 leading-tight">
                  Fluxo existente detectado
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Já existem elementos criados na versão <span className="font-bold text-zinc-700 capitalize">{selectedComplexities.join(', ') || activeVersion}</span>. Como você deseja prosseguir com a geração da IA?
                </p>
              </div>
            </div>

            {/* 3 Opções de Ação */}
            <div className="space-y-3 mb-6">
              {/* Opção 1: Criar Nova Versão (Mantendo a Antiga) */}
              <div 
                onClick={() => setAiConflictChoice('new_version')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  aiConflictChoice === 'new_version'
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    aiConflictChoice === 'new_version' ? 'border-blue-600 bg-blue-600 text-white' : 'border-zinc-300'
                  }`}>
                    {aiConflictChoice === 'new_version' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                        <CopyPlus size={15} className="text-blue-600" />
                        Criar Nova Versão
                      </span>
                      <span className="text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        Recomendado • Mantém a Antiga
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-1">
                      Preserva todo o fluxo atual intacto e salva o novo fluxo gerado em uma nova versão independente.
                    </p>
                    
                    {aiConflictChoice === 'new_version' && (
                      <div className="mt-3 pt-2.5 border-t border-blue-200/60 animate-in fade-in duration-150" onClick={e => e.stopPropagation()}>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 block mb-1">
                          Nome da Nova Versão:
                        </label>
                        <input
                          type="text"
                          value={newVersionCustomName}
                          onChange={(e) => setNewVersionCustomName(e.target.value)}
                          placeholder="Ex: normal (v2), Revisão IA..."
                          className="w-full text-xs font-semibold px-3 py-2 bg-white border border-blue-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-zinc-800"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Opção 2: Substituir o Fluxo Existente */}
              <div 
                onClick={() => setAiConflictChoice('replace')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  aiConflictChoice === 'replace'
                    ? 'border-red-400 bg-red-50/40 ring-2 ring-red-500/20 shadow-xs'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    aiConflictChoice === 'replace' ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-300'
                  }`}>
                    {aiConflictChoice === 'replace' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                      <RotateCcw size={15} className="text-red-600" />
                      Substituir Fluxo Existente
                    </span>
                    <p className="text-xs text-zinc-600 mt-1">
                      Apaga o conteúdo atual desta versão e gera o novo fluxo do zero.
                    </p>
                  </div>
                </div>
              </div>

              {/* Opção 3: Adicionar ao Lado (Mesclar) */}
              <div 
                onClick={() => setAiConflictChoice('append')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  aiConflictChoice === 'append'
                    ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    aiConflictChoice === 'append' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-zinc-300'
                  }`}>
                    {aiConflictChoice === 'append' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                      <PlusCircle size={15} className="text-indigo-600" />
                      Adicionar ao Lado (Mesclar)
                    </span>
                    <p className="text-xs text-zinc-600 mt-1">
                      Mantém os blocos atuais e insere o novo fluxo gerado ao lado no mesmo canvas.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowAIConflictModal(false);
                  if (pendingManualPasteRef.current) {
                    pendingManualPasteRef.current = false;
                    setShowManualAIModal(true);
                  }
                }}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
              >
                Voltar ao Assistente
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingManualPasteRef.current) {
                    pendingManualPasteRef.current = false;
                    executeManualPasteImport({
                      mode: aiConflictChoice,
                      newVersionName: newVersionCustomName
                    });
                  } else {
                    executeGenerateAI({
                      mode: aiConflictChoice,
                      newVersionName: newVersionCustomName
                    });
                  }
                }}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl text-white shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                  aiConflictChoice === 'replace'
                    ? 'bg-red-600 hover:bg-red-700'
                    : aiConflictChoice === 'new_version'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <Sparkles size={15} />
                {aiConflictChoice === 'new_version'
                  ? 'Criar Nova Versão e Gerar'
                  : aiConflictChoice === 'replace'
                  ? 'Substituir e Gerar'
                  : 'Adicionar e Gerar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Status Balloon */}
      {isGenerating && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 w-96 flex flex-col gap-3 animate-in slide-in-from-top-4 fade-in duration-300">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-800">
                 <Loader2 size={16} className="text-blue-600 animate-spin" />
                 Gerando Fluxograma...
              </div>
              <button onClick={cancelAIGeneration} className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors">
                 Cancelar
              </button>
           </div>
           
           <div className="text-xs text-zinc-500">
              Construindo nós e conexões em tempo real ({progress}%)...
           </div>
           
           <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
             <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
           </div>
        </div>
      )}

      {/* Export Progress Balloon — evita a tela parecer travada enquanto a
          captura da imagem/PDF processa (pode levar alguns segundos em
          fluxos grandes). "Cancelar" descarta o resultado e libera a tela
          na hora; o processamento em si, por rodar na mesma thread
          principal do navegador (html-to-image precisa do DOM ao vivo, o
          que não é acessível de uma Web Worker), não tem como ser
          interrompido no meio — só ignorado quando terminar. */}
      {exportStatus && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 w-96 flex flex-col gap-3 animate-in slide-in-from-top-4 fade-in duration-300">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-800">
                 <Loader2 size={16} className="text-blue-600 animate-spin" />
                 {exportStatus.label}
              </div>
              <button onClick={cancelExport} className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors">
                 Cancelar
              </button>
           </div>

           <div className="text-xs text-zinc-500">
              Preparando o arquivo na melhor qualidade possível...
           </div>

           <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
             <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 animate-pulse rounded-full w-full" />
           </div>
        </div>
      )}

      {/* Clear AI Confirmation Modal */}
      {showAIClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-lg text-zinc-900 mb-2">Limpar dados preenchidos?</h3>
            <p className="text-sm text-zinc-600 mb-5">
              Você deseja apagar a descrição e os arquivos anexados ao sair do Assistente de IA?
            </p>
            <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer mb-5">
              <input 
                type="checkbox" 
                checked={rememberClearChoice} 
                onChange={e => setRememberClearChoice(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              Lembrar minha escolha
            </label>
            <div className="flex items-center justify-end gap-2">
              <button 
                onClick={() => setShowAIClearConfirm(false)} 
                className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                Voltar
              </button>
              <button 
                onClick={() => {
                  if (rememberClearChoice) setClearAIPref('never');
                  setShowAIClearConfirm(false);
                  setShowAIModal(false);
                }}
                className="px-4 py-2 text-sm font-semibold text-zinc-700 border border-zinc-200 bg-white hover:bg-zinc-50 rounded-xl transition-colors"
              >
                Manter Dados
              </button>
              <button 
                onClick={() => {
                  if (rememberClearChoice) setClearAIPref('always');
                  setPrompt('');
                  setAiFiles([]);
                  setShowAIClearConfirm(false);
                  setShowAIModal(false);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow transition-colors"
              >
                Limpar Dados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE CAMADA / Z-INDEX GLOBAL */}
      {globalEdgeZIndexConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-zinc-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Layers size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-800">
                  Definir Camada de Todas as Linhas
                </h3>
                <p className="text-xs text-zinc-500">
                  {globalEdgeZIndexConfirm === 'front' 
                    ? 'Configurar para passar por cima das formas' 
                    : 'Configurar para passar por trás das formas'}
                </p>
              </div>
            </div>

            <p className="text-sm text-zinc-600 mb-4 leading-relaxed">
              Existem linhas que foram configuradas individualmente com preferências manuais. 
              Como você deseja aplicar a nova configuração?
            </p>

            <div className="space-y-2.5 mb-6">
              <button
                onClick={() => applyGlobalEdgeZIndex(globalEdgeZIndexConfirm, true)}
                className="w-full p-3 text-left rounded-xl border-2 border-blue-500 bg-blue-50/50 hover:bg-blue-50 transition-all cursor-pointer flex items-start gap-3 group"
              >
                <div className="p-1 rounded-lg bg-blue-600 text-white mt-0.5 group-hover:scale-105 transition-transform">
                  <Check size={14} />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-800">Mudar Todas as Linhas</div>
                  <div className="text-xs text-zinc-500">Atualiza inclusive as linhas que foram alteradas individualmente</div>
                </div>
              </button>

              <button
                onClick={() => applyGlobalEdgeZIndex(globalEdgeZIndexConfirm, false)}
                className="w-full p-3 text-left rounded-xl border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 transition-all cursor-pointer flex items-start gap-3"
              >
                <div className="p-1 rounded-lg bg-zinc-200 text-zinc-700 mt-0.5">
                  <Layers size={14} />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-800">Mudar Apenas as Não Selecionadas</div>
                  <div className="text-xs text-zinc-500">Preserva as linhas configuradas individualmente</div>
                </div>
              </button>
            </div>

            <div className="flex justify-end">
              <button 
                onClick={() => setGlobalEdgeZIndexConfirm(null)} 
                className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </NavigationModeContext.Provider>
  );
}

export default function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorContent {...props} />
    </ReactFlowProvider>
  );
}
