export const APP_VERSION = 'v2.7.19';

export interface NodeTiming {
  duration?: number; // Tempo de execução principal em minutos
  setupTime?: number; // Troca de insumos / Setup / Preparação
  waitTime?: number; // Paradas / Espera / Fila
  pauseTime?: number; // Pausas / Intervalos
  otherExtraTime?: number; // Outros tempos adicionais
  unit?: 'min' | 'h' | 's'; // default: 'min'
  department?: string; // Responsável / Departamento / Setor
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
  notes?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  userId: string;
  createdAt: number;
  updatedAt?: number;
}

export interface DiagramVersion {
  nodes: any[];
  edges: any[];
}

export interface Diagram {
  id: string;
  title: string;
  userId: string;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
  versions?: Record<string, DiagramVersion>;
  activeVersion?: string;
  nodes?: any[];
  edges?: any[];
  showTimingMode?: boolean;
  driveFileId?: string | null;
  driveLink?: string | null;
  syncedToDriveAt?: number | null;
}
