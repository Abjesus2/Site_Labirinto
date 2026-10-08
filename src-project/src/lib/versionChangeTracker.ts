/**
 * "O conteúdo do fluxo mudou?" (para o lembrete de backup), sem transformar o
 * diagrama inteiro em texto a cada salvamento.
 *
 * Antes, cada salvamento automático gerava a assinatura de TODAS as versões
 * duas vezes (a guardada e a nova). Agora cada versão guarda a assinatura da
 * última gravação; uma versão que é o mesmo objeto da vez anterior não é
 * recalculada — na prática só a versão aberta é processada.
 * O que é só da tela (seleção, arraste, medidas) não conta como mudança.
 */
const UI_ONLY_KEYS = new Set(['selected', 'dragging', 'measured', 'resizing']);

export const flowSignature = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null, (key, v) => (UI_ONLY_KEYS.has(key) ? undefined : v));
  } catch {
    return String(Math.random());
  }
};

type Versions = Record<string, unknown> | undefined | null;

export const createVersionChangeTracker = (signature: (v: unknown) => string = flowSignature) => {
  // assinatura gravada por versão + o objeto que a gerou
  const saved = new Map<string, { ref: unknown; sig: string }>();
  let primed = false;

  return (stored: Versions, next: Record<string, unknown>): boolean => {
    if (!primed) {
      // Primeira gravação: a referência é o que já estava guardado.
      Object.entries(stored || {}).forEach(([k, v]) => saved.set(k, { ref: v, sig: signature(v) }));
      primed = true;
    }
    let changed = false;
    const keys = new Set([...saved.keys(), ...Object.keys(next)]);
    keys.forEach((k) => {
      const prev = saved.get(k);
      if (!(k in next)) {
        if (prev) changed = true;
        saved.delete(k);
        return;
      }
      const value = next[k];
      if (prev && prev.ref === value) return;
      const sig = signature(value);
      if (!prev || prev.sig !== sig) changed = true;
      saved.set(k, { ref: value, sig });
    });
    return changed;
  };
};
