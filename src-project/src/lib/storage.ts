import { Diagram, Folder } from '../types';

const DIAGRAMS_KEY = 'labirinto_local_diagrams';
const FOLDERS_KEY = 'labirinto_local_folders';

export const getLocalDiagrams = (): Diagram[] => {
  try {
    return JSON.parse(localStorage.getItem(DIAGRAMS_KEY) || '[]');
  } catch {
    return [];
  }
};

export const saveLocalDiagram = (diagram: Diagram) => {
  const diagrams = getLocalDiagrams();
  const index = diagrams.findIndex(d => d.id === diagram.id);
  if (index >= 0) {
    diagrams[index] = diagram;
  } else {
    diagrams.push(diagram);
  }
  localStorage.setItem(DIAGRAMS_KEY, JSON.stringify(diagrams));
};

export const deleteLocalDiagram = (id: string) => {
  const diagrams = getLocalDiagrams();
  localStorage.setItem(DIAGRAMS_KEY, JSON.stringify(diagrams.filter(d => d.id !== id)));
};

export const getLocalFolders = (): Folder[] => {
  try {
    return JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]');
  } catch {
    return [];
  }
};

export const saveLocalFolder = (folder: Folder) => {
  const folders = getLocalFolders();
  const index = folders.findIndex(f => f.id === folder.id);
  if (index >= 0) {
    folders[index] = folder;
  } else {
    folders.push(folder);
  }
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
};

export const deleteLocalFolder = (id: string) => {
  const folders = getLocalFolders();
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders.filter(f => f.id !== id)));
};

export const getLocalDiagram = (id: string): Diagram | null => {
  const diagrams = getLocalDiagrams();
  return diagrams.find(d => d.id === id) || null;
};
