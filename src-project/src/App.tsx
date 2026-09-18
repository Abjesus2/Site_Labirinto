import React, { useEffect, useState, useMemo, useRef } from 'react';
import { openAISettings } from './lib/aiSettingsUI';
import { getLocalDiagrams, saveLocalDiagram, deleteLocalDiagram, getLocalFolders, saveLocalFolder, deleteLocalFolder } from './lib/storage';
import { cryptoAvailable } from './lib/aiProviders';
import { exportFullBackup, parseFullBackup, applyFullBackup } from './lib/fullBackup';
import { askText, showToast } from './lib/embedCompat';
import { Diagram, Folder, APP_VERSION } from './types';
import FlowEditor from './components/FlowEditor';
import { FlowchartHeroAnimation } from './components/FlowchartHeroAnimation';
import { SystemManualMenu } from './components/SystemManualMenu';
import { LandingScreen } from './components/LandingScreen';
import { Plus, Folder as FolderIcon, LayoutDashboard, Search, ChevronRight, X, Trash2, FolderPlus, Workflow, ArrowLeft, MoreVertical, SearchCode, Save, Lock, Download, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { downloadSystemManual } from './utils/systemManual';

type SortOption = 'recent' | 'oldest' | 'name-asc' | 'name-desc';
type FilterType = 'all' | 'folders' | 'diagrams';

export default function App() {

  const [hasStarted, setHasStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'folder' | 'diagram', title: string } | null>(null);
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // Sem login e sem nuvem: os fluxogramas ficam neste navegador e são
  // levados para fora pelo arquivo .json (Exportar / Trazer fluxo).
  useEffect(() => {
    setLoading(false);
  }, []);

  // Fetch local data
  const refreshData = () => {
    setDiagrams(getLocalDiagrams());
    setFolders(getLocalFolders());
  };

  useEffect(() => {
    if (!loading) {
      refreshData();
    }
  }, [loading]);

  const handleCreateNewFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      setIsSubmittingFolder(true);
      const newFolder: Folder = {
        id: Math.random().toString(36).substring(2) + Date.now().toString(36),
        name: newFolderName.trim(),
        userId: 'local',
        parentId: currentFolderId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      saveLocalFolder(newFolder);
      setNewFolderName('');
      setIsNewFolderModalOpen(false);
      refreshData();
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  const createNewDiagram = () => {
    const newDiagram: Diagram = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      title: 'Diagrama Sem Título',
      userId: 'local',
      folderId: currentFolderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      activeVersion: 'normal',
      versions: {
        normal: { nodes: [], edges: [] }
      }
    };
    saveLocalDiagram(newDiagram);
    setActiveDiagramId(newDiagram.id);
    refreshData();
  };

  const promptDeleteFolder = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setItemToDelete({ id, type: 'folder', title: name });
  };

  const promptDeleteDiagram = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setItemToDelete({ id, type: 'diagram', title });
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    if (itemToDelete.type === 'diagram') {
      deleteLocalDiagram(itemToDelete.id);
      if (activeDiagramId === itemToDelete.id) setActiveDiagramId(null);
    } else {
      deleteLocalFolder(itemToDelete.id);
      // Move items in this folder to root (simplified logic for local storage)
      const diags = getLocalDiagrams();
      diags.forEach(d => {
        if (d.folderId === itemToDelete.id) {
          d.folderId = null;
          saveLocalDiagram(d);
        }
      });
      const folds = getLocalFolders();
      folds.forEach(f => {
        if (f.parentId === itemToDelete.id) {
          f.parentId = null;
          saveLocalFolder(f);
        }
      });
    }
    refreshData();
    setItemToDelete(null);
    setIsDeleting(false);
  };

  // Sem login e sem nuvem: exportar tudo (fluxogramas + pastas + chaves de
  // IA) num único arquivo é o único jeito de continuar de onde parou em
  // outro navegador, outro computador, ou depois de limpar os dados deste.
  const handleExportFullBackup = async (withPassword: boolean) => {
    let password: string | undefined;
    if (withPassword) {
      const typed = await askText({
        title: 'Senha do backup',
        message: 'Escolha uma senha. Ela será pedida na hora de importar. Sem ela, ninguém abre o arquivo — nem você.',
        placeholder: 'mínimo 6 caracteres',
      });
      if (!typed) return;
      if (typed.length < 6) {
        showToast({ message: 'Use uma senha com pelo menos 6 caracteres.', tone: 'warn' });
        return;
      }
      password = typed;
    }
    try {
      const content = await exportFullBackup(password);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.setAttribute('download', `backup-labirinto-${stamp}${password ? '-protegido' : ''}.json`);
      a.setAttribute('href', url);
      a.click();
      showToast({
        message: password
          ? 'Backup completo gerado e protegido. Guarde a senha: sem ela o arquivo não abre.'
          : 'Backup completo gerado. Ele contém suas chaves de IA em texto puro — guarde em local seguro.',
        tone: password ? 'info' : 'warn',
        timeout: 14000,
      });
    } catch (e: any) {
      showToast({ message: String(e?.message || e), tone: 'error', timeout: 12000 });
    }
  };

  const handleImportFullBackup = async (file: File) => {
    try {
      const text = await file.text();
      let payload;
      try {
        payload = await parseFullBackup(text);
      } catch (e: any) {
        if (String(e?.message) !== 'SENHA_NECESSARIA') throw e;
        const password = await askText({
          title: 'Arquivo protegido',
          message: 'Informe a senha usada quando este backup foi criado.',
          placeholder: 'senha do arquivo',
        });
        if (!password) return;
        payload = await parseFullBackup(text, password);
      }
      const { diagramsCount, foldersCount } = applyFullBackup(payload);
      refreshData();
      setIsBackupModalOpen(false);
      showToast({
        message: `Backup restaurado: ${diagramsCount} fluxograma(s) e ${foldersCount} pasta(s). As chaves de IA também foram restauradas.`,
        timeout: 10000,
      });
    } catch (e: any) {
      showToast({ message: String(e?.message || e), tone: 'error', timeout: 12000 });
    }
  };

  const filteredAndSortedItems = useMemo(() => {
    let rawDiagrams = diagrams.filter(d => (d.folderId || null) === currentFolderId);
    let rawFolders = folders.filter(f => f.parentId === currentFolderId);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rawDiagrams = diagrams.filter(d => d.title.toLowerCase().includes(q));
      rawFolders = folders.filter(f => f.name.toLowerCase().includes(q));
    }

    let showFolders = filterType === 'all' || filterType === 'folders';
    let showDiagrams = filterType === 'all' || filterType === 'diagrams';

    let finalFolders = showFolders ? [...rawFolders] : [];
    let finalDiagrams = showDiagrams ? [...rawDiagrams] : [];

    finalFolders.sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    finalDiagrams.sort((a, b) => {
      if (sortBy === 'name-asc') return a.title.localeCompare(b.title);
      if (sortBy === 'name-desc') return b.title.localeCompare(a.title);
      if (sortBy === 'oldest') return (a.updatedAt || a.createdAt || 0) - (b.updatedAt || b.createdAt || 0);
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });

    return {
      folders: finalFolders,
      diagrams: finalDiagrams,
      totalCount: finalFolders.length + finalDiagrams.length
    };
  }, [diagrams, folders, currentFolderId, searchQuery, filterType, sortBy]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 font-medium">Carregando ambiente...</p>
      </div>
    );
  }

  
  const hasLocalData = diagrams.length > 0 || folders.length > 0;
  if (!activeDiagramId && !hasLocalData && !hasStarted) {
    return (
      <LandingScreen onStart={() => setHasStarted(true)} />
    );
  }


  if (activeDiagramId) {
    return (
      <FlowEditor 
        diagramId={activeDiagramId} 
        onBack={() => {
          setActiveDiagramId(null);
          refreshData();
        }} 
      />
    );
  }

  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) : null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-800 font-sans selection:bg-blue-100 selection:text-blue-900">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
              </div>
              <span className="font-extrabold text-base sm:text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-800 hidden sm:inline-block">
                Labirinto
              </span>
            </div>
            <div className="h-4 w-px bg-zinc-300 mx-2 hidden sm:block"></div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
              {APP_VERSION}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => openAISettings()}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 text-zinc-700 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Escolher a IA e cadastrar chaves de API"
            >
              <SearchCode size={16} />
              <span className="hidden sm:inline">Configurar IA</span>
            </button>
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 text-zinc-700 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Exportar ou importar tudo: fluxogramas, pastas e chaves de IA"
            >
              <Save size={16} />
              <span className="hidden sm:inline">Backup Completo</span>
            </button>
            <SystemManualMenu />
            
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight mb-2">Meus Diagramas</h1>
            <p className="text-xs sm:text-sm text-zinc-500 font-medium">Crie, organize e gerencie seus fluxos temporariamente em seu navegador. Exporte-os para salvar permanentemente.</p>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button 
              onClick={() => setIsNewFolderModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50 rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-sm"
            >
              <FolderPlus size={18} />
              <span className="hidden sm:inline">Nova Pasta</span>
            </button>
            <button 
              onClick={createNewDiagram}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-blue-500/20"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>Novo Fluxo</span>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 bg-white p-2 sm:p-2.5 rounded-2xl sm:rounded-3xl border border-zinc-200 shadow-xs">
          {/* Breadcrumb / Search */}
          <div className="flex-1 flex items-center gap-2 sm:gap-3 px-2 sm:px-4">
            {currentFolderId ? (
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <button 
                  onClick={() => setCurrentFolderId(null)}
                  className="p-1.5 sm:p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors shrink-0"
                  title="Voltar para raiz"
                >
                  <ArrowLeft size={16} className="sm:w-5 sm:h-5" />
                </button>
                <div className="h-4 sm:h-5 w-px bg-zinc-200 shrink-0"></div>
                <div className="flex items-center gap-2 min-w-0">
                  <FolderIcon className="text-blue-500 shrink-0" size={16} />
                  <span className="font-bold text-sm sm:text-base text-zinc-900 truncate">
                    {currentFolder?.name || 'Pasta'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative flex-1 group">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text"
                  placeholder="Buscar arquivos e pastas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-50 border-none rounded-xl pl-9 pr-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                />
              </div>
            )}
          </div>

          <div className="h-px md:h-8 w-full md:w-px bg-zinc-200 hidden md:block"></div>

          {/* Filters & Sort */}
          <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 px-2 sm:px-4">
            {/* Filter Tabs */}
            <div className="flex p-1 bg-zinc-100 rounded-xl">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-colors text-[11px] sm:text-xs ${filterType === 'all' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-zinc-600 hover:text-zinc-900 font-medium'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType('folders')}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-colors text-[11px] sm:text-xs ${filterType === 'folders' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-zinc-600 hover:text-zinc-900 font-medium'}`}
              >
                Pastas
              </button>
              <button
                onClick={() => setFilterType('diagrams')}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-colors text-[11px] sm:text-xs ${filterType === 'diagrams' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-zinc-600 hover:text-zinc-900 font-medium'}`}
              >
                Fluxos
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {filteredAndSortedItems.totalCount === 0 ? (
          <div className="text-center py-16 sm:py-24 bg-white border border-zinc-200 border-dashed rounded-3xl">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <SearchCode size={28} />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 mb-2">
              {searchQuery ? 'Nenhum resultado encontrado' : currentFolderId ? 'Pasta Vazia' : 'Seu espaço de trabalho está vazio'}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto px-4">
              {searchQuery 
                ? 'Tente buscar com palavras diferentes.' 
                : 'Crie seu primeiro fluxograma ou organize-os em pastas clicando nos botões acima. Os dados são salvos localmente neste navegador de forma temporária.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-1 divide-y divide-zinc-100">
              
              {/* Folders */}
              {filteredAndSortedItems.folders.map(folder => (
                <div 
                  key={folder.id}
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="group flex items-center justify-between p-4 sm:p-5 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 sm:p-2.5 bg-blue-50 text-blue-500 rounded-xl group-hover:scale-110 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                      <FolderIcon size={20} className="fill-current opacity-20 absolute" />
                      <FolderIcon size={20} className="relative" />
                    </div>
                    <span className="font-bold text-sm text-zinc-900 truncate group-hover:text-blue-600 transition-colors">
                      {folder.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-zinc-400">
                    <button 
                      onClick={(e) => promptDeleteFolder(e, folder.id, folder.name)}
                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Excluir Pasta"
                    >
                      <Trash2 size={15} />
                    </button>
                    <ChevronRight size={16} className="text-zinc-400 group-hover:text-blue-600" />
                  </div>
                </div>
              ))}
              
              {/* Diagrams */}
              {filteredAndSortedItems.diagrams.map(diag => {
                const nodeCount = diag.versions?.[diag.activeVersion || 'normal']?.nodes?.length || 0;
                return (
                  <div 
                    key={diag.id}
                    onClick={() => setActiveDiagramId(diag.id)}
                    className="group flex items-center justify-between p-4 sm:p-5 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Workflow className="text-blue-600 shrink-0" size={20} />
                      <span className="font-bold text-sm text-zinc-900 truncate group-hover:text-blue-600 transition-colors">
                        {diag.title}
                      </span>
                      <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-semibold hidden sm:inline-block">
                        {nodeCount} etapas
                      </span>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6 text-xs text-zinc-400">
                      <span className="hidden sm:inline">Atualizado {new Date(diag.updatedAt).toLocaleDateString()}</span>
                      <button 
                        onClick={(e) => promptDeleteDiagram(e, diag.id, diag.title)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors sm:opacity-0 group-hover:opacity-100"
                        title="Excluir Fluxograma"
                      >
                        <Trash2 size={15} />
                      </button>
                      <ChevronRight size={16} className="text-zinc-400 group-hover:text-blue-600" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <AnimatePresence>
          {itemToDelete && (
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
              onClick={() => !isDeleting && setItemToDelete(null)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-zinc-200"
              >
                <div className="p-6">
                  <h3 className="text-lg font-bold text-zinc-900 mb-2">Confirmar Exclusão</h3>
                  <p className="text-sm text-zinc-600 mb-6">Excluir "{itemToDelete.title}"? Esta ação não pode ser desfeita.</p>
                  <div className="flex justify-end gap-3">
                    <button 
                      onClick={() => setItemToDelete(null)}
                      className="px-4 py-2 font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleConfirmDelete}
                      className="px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {isBackupModalOpen && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
              onClick={() => setIsBackupModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200"
              >
                <div className="p-6">
                  <h3 className="text-lg font-bold text-zinc-900 mb-2">Backup completo</h3>
                  <p className="text-sm text-zinc-600 mb-5">
                    Salva tudo num único arquivo — seus fluxogramas, pastas e as chaves/configurações de IA — para
                    continuar de onde parou em outro navegador, outro computador, ou depois de limpar os dados deste.
                  </p>

                  <div className="flex flex-col gap-2 mb-4">
                    <button
                      onClick={() => handleExportFullBackup(true)}
                      disabled={!cryptoAvailable()}
                      title={!cryptoAvailable() ? 'Indisponível neste contexto: use um endereço https.' : undefined}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all"
                    >
                      <Lock size={15} /> Exportar com senha (recomendado)
                    </button>
                    <button
                      onClick={() => handleExportFullBackup(false)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 rounded-xl font-bold text-sm transition-all"
                    >
                      <Download size={15} /> Exportar sem senha
                    </button>
                    <button
                      onClick={() => backupFileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 rounded-xl font-bold text-sm transition-all"
                    >
                      <Upload size={15} /> Importar backup (.json)
                    </button>
                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) handleImportFullBackup(file);
                      }}
                    />
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed mb-4">
                    O arquivo sem senha guarda as chaves de IA em texto puro — trate-o como uma senha seria tratada.
                    Importar nunca apaga o que já está neste navegador: pastas e fluxogramas do arquivo entram, o
                    resto continua aqui.
                  </p>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setIsBackupModalOpen(false)}
                      className="px-4 py-2 font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {isNewFolderModalOpen && (
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
              onClick={() => setIsNewFolderModalOpen(false)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-zinc-200"
              >
                <div className="p-6">
                  <h3 className="text-lg font-bold text-zinc-900 mb-4">Nova Pasta</h3>
                  <form onSubmit={handleCreateNewFolder}>
                    <input
                      type="text"
                      placeholder="Nome da pasta"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      autoFocus
                      className="w-full border border-zinc-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-6"
                    />
                    <div className="flex justify-end gap-3">
                      <button 
                        type="button"
                        onClick={() => setIsNewFolderModalOpen(false)}
                        className="px-4 py-2 font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                      >
                        Criar
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
