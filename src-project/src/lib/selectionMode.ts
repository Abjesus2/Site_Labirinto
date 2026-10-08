import { createContext, useContext } from 'react';

/**
 * Seleção de VÁRIOS itens (caixa, Ctrl+clique)?
 *
 * Alças de redimensionar das formas e pontos de reconexão / ajuste de trecho
 * das linhas só servem com UM item selecionado. Numa seleção por caixa em
 * fluxo grande, eles eram criados para dezenas de formas e linhas a cada
 * movimento da caixa (centenas de elementos), o que deixava a seleção lenta.
 * Com vários itens selecionados, o destaque continua — só os controles de
 * edição individuais ficam escondidos.
 */
export const MultiSelectContext = createContext(false);
export const useIsMultiSelect = () => useContext(MultiSelectContext);
