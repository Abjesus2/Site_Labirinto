/**
 * TEMA DO SITE (modo claro/escuro + paleta de cor de destaque)
 * --------------------------------------------------------------
 * Estado global simples (sem Context, pra não precisar envolver a árvore
 * inteira em provider) persistido no localStorage e aplicado como atributos
 * em <html> — o CSS em index.css (blocos "html[data-theme=...]" e
 * "html[data-palette=...]") faz o resto, sobrepondo as classes Tailwind de
 * cinza/branco (modo escuro) ou azul/índigo da marca (paleta), SEM tocar nas
 * cores das formas do fluxograma (que usam estilo inline ou ficam dentro de
 * .react-flow__node, explicitamente excluído desse CSS).
 */

export type ThemeMode = 'light' | 'dark';
export type ThemePalette = 'azul' | 'violeta' | 'verde' | 'rosa' | 'laranja';

const STORAGE_KEY = 'labirinto_theme_v1';

export const PALETTES: { id: ThemePalette; label: string; swatch: string }[] = [
  { id: 'azul', label: 'Azul (padrão)', swatch: '#2563eb' },
  { id: 'violeta', label: 'Violeta', swatch: '#9333ea' },
  { id: 'verde', label: 'Verde', swatch: '#059669' },
  { id: 'rosa', label: 'Rosa', swatch: '#db2777' },
  { id: 'laranja', label: 'Laranja', swatch: '#ea580c' },
];

interface ThemeState {
  mode: ThemeMode;
  palette: ThemePalette;
}

const readStoredState = (): ThemeState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mode: parsed.mode === 'dark' ? 'dark' : 'light',
        palette: PALETTES.some((p) => p.id === parsed.palette) ? parsed.palette : 'azul',
      };
    }
  } catch {
    // ignora storage indisponível/corrompido — cai no padrão abaixo
  }
  return { mode: 'light', palette: 'azul' };
};

let state: ThemeState = readStoredState();
const listeners = new Set<() => void>();

const applyToDocument = () => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', state.mode);
  document.documentElement.setAttribute('data-palette', state.palette);
};

// Aplica assim que o módulo carrega (antes de qualquer componente montar),
// pra não "piscar" claro antes de escurecer.
applyToDocument();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sem storage disponível: tema continua funcionando só nesta sessão
  }
};

const notify = () => listeners.forEach((l) => l());

export const getThemeState = (): ThemeState => state;

export const setThemeMode = (mode: ThemeMode) => {
  if (state.mode === mode) return;
  state = { ...state, mode };
  applyToDocument();
  persist();
  notify();
};

export const setThemePalette = (palette: ThemePalette) => {
  if (state.palette === palette) return;
  state = { ...state, palette };
  applyToDocument();
  persist();
  notify();
};

export const toggleThemeMode = () => setThemeMode(state.mode === 'dark' ? 'light' : 'dark');

export const subscribeTheme = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
