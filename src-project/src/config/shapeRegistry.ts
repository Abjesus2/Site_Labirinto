export type ShapeCategory = 'Essenciais' | 'Documentos & Dados' | 'Engenharia & Operações' | 'Contêineres & Anotações';

export interface ShapeDefinition {
  type: string;
  label: string;
  category: ShapeCategory;
  manualPalette: boolean;
}

export const SHAPE_REGISTRY: Record<string, ShapeDefinition> = {
  process: { type: 'process', label: 'Processo', category: 'Essenciais', manualPalette: true },
  start: { type: 'start', label: 'Início', category: 'Essenciais', manualPalette: true },
  end: { type: 'end', label: 'Fim', category: 'Essenciais', manualPalette: true },
  decision: { type: 'decision', label: 'Decisão', category: 'Essenciais', manualPalette: true },
  inputoutput: { type: 'inputoutput', label: 'Entrada / Saída', category: 'Essenciais', manualPalette: true },

  document: { type: 'document', label: 'Documento', category: 'Documentos & Dados', manualPalette: true },
  database: { type: 'database', label: 'Banco de Dados', category: 'Documentos & Dados', manualPalette: true },
  storeddata: { type: 'storeddata', label: 'Dados Armazenados', category: 'Documentos & Dados', manualPalette: true },
  internalstorage: { type: 'internalstorage', label: 'Armazenamento Interno', category: 'Documentos & Dados', manualPalette: true },

  subprocess: { type: 'subprocess', label: 'Subprocesso', category: 'Engenharia & Operações', manualPalette: true },
  preparation: { type: 'preparation', label: 'Preparação / Setup', category: 'Engenharia & Operações', manualPalette: true },
  manualinput: { type: 'manualinput', label: 'Entrada Manual', category: 'Engenharia & Operações', manualPalette: true },
  manualoperation: { type: 'manualoperation', label: 'Operação Manual', category: 'Engenharia & Operações', manualPalette: true },
  display: { type: 'display', label: 'Exibição / Display', category: 'Engenharia & Operações', manualPalette: true },
  delay: { type: 'delay', label: 'Atraso / Espera', category: 'Engenharia & Operações', manualPalette: true },

  swimlane: { type: 'swimlane', label: 'Raia / Swimlane', category: 'Contêineres & Anotações', manualPalette: true },
  frame: { type: 'frame', label: 'Quadro / Frame', category: 'Contêineres & Anotações', manualPalette: true },
  offpage: { type: 'offpage', label: 'Fora de Página', category: 'Contêineres & Anotações', manualPalette: true },
  circle: { type: 'circle', label: 'Círculo / Evento', category: 'Contêineres & Anotações', manualPalette: true },
  cloud: { type: 'cloud', label: 'Nuvem / API', category: 'Contêineres & Anotações', manualPalette: true },
  sticky: { type: 'sticky', label: 'Nota Adesiva', category: 'Contêineres & Anotações', manualPalette: true },
  annotation: { type: 'annotation', label: 'Anotação / Callout', category: 'Contêineres & Anotações', manualPalette: true },

  junction: { type: 'junction', label: 'Conector / Junção', category: 'Contêineres & Anotações', manualPalette: true }, // According to prompt, maybe junction is technical infrastructure. I'll make it true for now so it matches existing palette, the prompt said "Não incluir como shape normal da IA, a menos que o usuário possa realmente inseri-lo manualmente". It is in the manual palette right now.
};

export const MANUAL_SHAPE_TYPES = Object.values(SHAPE_REGISTRY)
  .filter(s => s.manualPalette)
  .map(s => s.type);

export function validateGeneratedNodeType(type: string): string | null {
  return MANUAL_SHAPE_TYPES.includes(type) ? type : null;
}
