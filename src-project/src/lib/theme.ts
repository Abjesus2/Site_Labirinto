/**
 * TEMA DO SITE (modo claro/escuro)
 * --------------------------------
 * Estado global simples (sem Context, pra não precisar envolver a árvore
 * inteira em provider) persistido no localStorage e aplicado como atributo
 * em <html> — o CSS em index.css (blocos "html[data-theme=dark]") faz o
 * resto, sobrepondo as classes Tailwind de cinza/branco, SEM tocar nas
 * cores das formas do fluxograma (que usam estilo inline ou ficam dentro de
 * .react-flow__node, explicitamente excluído desse CSS).
 *
 * A cor de destaque é sempre a padrão (azul): a escolha de paleta foi
 * removida a pedido do usuário. Paleta salva por versões anteriores é
 * ignorada e o atributo antigo "data-palette" é limpo do <html>.
 */

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'labirinto_theme_v1';

interface ThemeState {
  mode: ThemeMode;
}

const readStoredState = (): ThemeState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { mode: parsed.mode === 'dark' ? 'dark' : 'light' };
    }
  } catch {
    // ignora storage indisponível/corrompido — cai no padrão abaixo
  }
  return { mode: 'light' };
};

let state: ThemeState = readStoredState();
const listeners = new Set<() => void>();

const applyToDocument = () => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', state.mode);
  document.documentElement.removeAttribute('data-palette');
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

export const toggleThemeMode = () => setThemeMode(state.mode === 'dark' ? 'light' : 'dark');

export const subscribeTheme = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
