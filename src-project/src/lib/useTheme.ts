import { useSyncExternalStore } from 'react';
import { getThemeState, subscribeTheme } from './theme';

/** Hook React pro estado de tema (modo claro/escuro + paleta) — re-renderiza
 * o componente sempre que setThemeMode/setThemePalette mudar algo. */
export const useTheme = () => useSyncExternalStore(subscribeTheme, getThemeState, getThemeState);
