import React, { createContext, useContext } from 'react';

/**
 * Modo Navegação: quando ativo, o fluxograma vira somente-leitura (só
 * pan/zoom) para avaliar o conteúdo sem risco de mexer em nada por
 * engano. As props nativas do React Flow (nodesDraggable,
 * elementsSelectable, nodesConnectable, edgesReconnectable) cobrem a
 * maior parte disso, mas a edição de rótulo por clique duplo (em
 * EditableNodeLabel e no rótulo de linha do AdjustableEdge) é feita por
 * fora da seleção do React Flow — daí este contexto, para não precisar
 * repassar uma prop manualmente por cada um dos ~15 tipos de nó.
 */
export const NavigationModeContext = createContext(false);

export const useNavigationMode = (): boolean => useContext(NavigationModeContext);
