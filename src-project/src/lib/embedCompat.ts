/**
 * CAMADA DE COMPATIBILIDADE PARA EXECUÇÃO EMBUTIDA (Google Sites / iframe)
 * ----------------------------------------------------------------------
 * Dentro de um iframe o navegador restringe: downloads programáticos,
 * área de transferência, alert/prompt nativos e armazenamento de terceiros.
 * Em vez de perder essas funções, cada uma ganha aqui um caminho alternativo:
 *
 *  - download  -> tenta o nativo e sempre oferece um link "Baixar" clicável
 *                 que abre em nova aba (contexto de topo, sem restrição)
 *  - clipboard -> navigator.clipboard, depois execCommand, depois caixa
 *                 com o texto selecionado para copiar manualmente
 *  - alert     -> aviso visual próprio (o alert nativo é ignorado em iframe)
 *  - prompt    -> modal própria em DOM (usada pela chave da IA)
 *  - print     -> protegido, com aviso e alternativa em nova aba
 *  - storage   -> aviso quando o navegador bloqueou a persistência
 */

const Z = 2147483600;

export const isEmbedded = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // acesso negado ao topo => estamos embutidos
  }
};

/* ------------------------------------------------------------------ */
/* Avisos visuais (substituem alert quando ele é bloqueado)            */
/* ------------------------------------------------------------------ */

let toastHost: HTMLDivElement | null = null;

type AlertAction = { label: string; run: () => void } | null;
let alertActionResolver: ((message: string) => AlertAction) | null = null;

/** Permite que um aviso ganhe um botão de ação (ex.: "Configurar IA"). */
export const setAlertActionResolver = (fn: (message: string) => AlertAction): void => {
  alertActionResolver = fn;
};

const ensureToastHost = (): HTMLDivElement => {
  if (toastHost && document.body.contains(toastHost)) return toastHost;
  const host = document.createElement('div');
  host.setAttribute('data-labirinto-toasts', '');
  Object.assign(host.style, {
    position: 'fixed',
    right: '12px',
    bottom: '58px',
    zIndex: String(Z),
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-end',
    maxWidth: 'min(380px, calc(100vw - 24px))',
    pointerEvents: 'none',
    font: '500 13px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  } as CSSStyleDeclaration);
  document.body.appendChild(host);
  toastHost = host;
  return host;
};

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
  downloadName?: string;
  timeout?: number;
  tone?: 'info' | 'warn' | 'error';
}

export const showToast = (opts: ToastOptions): void => {
  try {
    const host = ensureToastHost();
    const bg =
      opts.tone === 'error' ? '#7f1d1d' : opts.tone === 'warn' ? '#78350f' : '#111827';

    const box = document.createElement('div');
    Object.assign(box.style, {
      pointerEvents: 'auto',
      background: bg,
      color: '#fff',
      borderRadius: '10px',
      padding: '10px 12px',
      boxShadow: '0 8px 24px rgba(0,0,0,.28)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    } as CSSStyleDeclaration);

    const text = document.createElement('span');
    text.textContent = opts.message;
    text.style.flex = '1';
    box.appendChild(text);

    if (opts.onAction) {
      const btn = document.createElement('button');
      btn.textContent = opts.actionLabel || 'Abrir';
      Object.assign(btn.style, {
        background: '#fff',
        color: '#111827',
        border: '0',
        borderRadius: '8px',
        padding: '6px 10px',
        whiteSpace: 'nowrap',
        fontWeight: '600',
        cursor: 'pointer',
        font: 'inherit',
      } as CSSStyleDeclaration);
      btn.onclick = () => {
        box.remove();
        opts.onAction!();
      };
      box.appendChild(btn);
    } else if (opts.href) {
      const link = document.createElement('a');
      link.href = opts.href;
      link.textContent = opts.actionLabel || 'Abrir';
      link.target = '_blank';
      link.rel = 'noopener';
      link.dataset.labirintoFallback = '1'; // evita reentrar no patch de download
      if (opts.downloadName) link.setAttribute('download', opts.downloadName);
      Object.assign(link.style, {
        background: '#fff',
        color: '#111827',
        borderRadius: '8px',
        padding: '6px 10px',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        fontWeight: '600',
      } as CSSStyleDeclaration);
      box.appendChild(link);
    }

    const close = document.createElement('button');
    close.textContent = '✕';
    Object.assign(close.style, {
      background: 'transparent',
      border: '0',
      color: 'rgba(255,255,255,.7)',
      cursor: 'pointer',
      fontSize: '13px',
      padding: '0 2px',
    } as CSSStyleDeclaration);
    close.onclick = () => box.remove();
    box.appendChild(close);

    host.appendChild(box);

    const timeout = opts.timeout ?? 9000;
    if (timeout > 0) setTimeout(() => box.remove(), timeout);
  } catch (e) {
    console.warn('[Labirinto] aviso não pôde ser exibido:', opts.message, e);
  }
};

/* ------------------------------------------------------------------ */
/* Modal de entrada de texto (substitui window.prompt)                 */
/* ------------------------------------------------------------------ */

export const askText = (opts: {
  title: string;
  message?: string;
  placeholder?: string;
  linkLabel?: string;
  linkHref?: string;
  initialValue?: string;
}): Promise<string | null> =>
  new Promise((resolve) => {
    try {
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(15,23,42,.55)',
        zIndex: String(Z + 1),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        font: '400 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      } as CSSStyleDeclaration);

      const card = document.createElement('div');
      Object.assign(card.style, {
        background: '#fff',
        color: '#0f172a',
        borderRadius: '14px',
        padding: '20px',
        width: 'min(460px, 100%)',
        boxShadow: '0 20px 60px rgba(0,0,0,.35)',
      } as CSSStyleDeclaration);

      const h = document.createElement('div');
      h.textContent = opts.title;
      Object.assign(h.style, { fontWeight: '700', fontSize: '16px', marginBottom: '8px' } as CSSStyleDeclaration);
      card.appendChild(h);

      if (opts.message) {
        const p = document.createElement('p');
        p.textContent = opts.message;
        Object.assign(p.style, { margin: '0 0 12px', color: '#475569' } as CSSStyleDeclaration);
        card.appendChild(p);
      }

      if (opts.linkHref) {
        const a = document.createElement('a');
        a.href = opts.linkHref;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = opts.linkLabel || opts.linkHref;
        Object.assign(a.style, {
          display: 'inline-block',
          marginBottom: '12px',
          color: '#2563eb',
          fontWeight: '600',
          textDecoration: 'none',
        } as CSSStyleDeclaration);
        card.appendChild(a);
      }

      const input = document.createElement('input');
      input.type = 'text';
      input.value = opts.initialValue || '';
      input.placeholder = opts.placeholder || '';
      input.autocomplete = 'off';
      input.spellcheck = false;
      Object.assign(input.style, {
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 12px',
        border: '1px solid #cbd5e1',
        borderRadius: '10px',
        fontSize: '14px',
        outline: 'none',
      } as CSSStyleDeclaration);
      card.appendChild(input);

      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: '16px',
      } as CSSStyleDeclaration);

      const mkBtn = (label: string, primary: boolean) => {
        const b = document.createElement('button');
        b.textContent = label;
        Object.assign(b.style, {
          padding: '9px 14px',
          borderRadius: '10px',
          border: primary ? '0' : '1px solid #cbd5e1',
          background: primary ? '#2563eb' : '#fff',
          color: primary ? '#fff' : '#0f172a',
          fontWeight: '600',
          cursor: 'pointer',
          fontSize: '14px',
        } as CSSStyleDeclaration);
        return b;
      };

      const finish = (value: string | null) => {
        overlay.remove();
        resolve(value);
      };

      const cancel = mkBtn('Cancelar', false);
      cancel.onclick = () => finish(null);
      const ok = mkBtn('Confirmar', true);
      ok.onclick = () => finish(input.value.trim() ? input.value.trim() : null);

      input.onkeydown = (ev) => {
        if (ev.key === 'Enter') ok.click();
        if (ev.key === 'Escape') finish(null);
      };

      row.appendChild(cancel);
      row.appendChild(ok);
      card.appendChild(row);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      setTimeout(() => input.focus(), 30);
    } catch (e) {
      console.error('[Labirinto] modal indisponível, usando prompt nativo', e);
      try {
        resolve(window.prompt(opts.title) || null);
      } catch {
        resolve(null);
      }
    }
  });

/* ------------------------------------------------------------------ */
/* Cópia para a área de transferência com três níveis de fallback      */
/* ------------------------------------------------------------------ */

const legacyCopy = (text: string): boolean => {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    Object.assign(ta.style, {
      position: 'fixed',
      top: '0',
      left: '-9999px',
      opacity: '0',
    } as CSSStyleDeclaration);
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && (navigator.clipboard as any).__labirintoOriginalWrite) {
      await (navigator.clipboard as any).__labirintoOriginalWrite(text);
      return true;
    }
  } catch {
    /* segue para o fallback */
  }
  if (legacyCopy(text)) return true;
  // Último recurso: mostra o texto para o usuário copiar à mão
  await askText({
    title: 'Copiar link',
    message: 'Seu navegador bloqueou a cópia automática. Selecione o texto abaixo e copie.',
    initialValue: text,
  });
  return false;
};

/* ------------------------------------------------------------------ */
/* Instalação                                                          */
/* ------------------------------------------------------------------ */

let installed = false;

export const installEmbedCompat = (): void => {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const embedded = isEmbedded();

  /* 1. URLs de blob vivem mais tempo, para que o link de fallback ainda
        funcione depois que o código original chamar revokeObjectURL. */
  try {
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => {
      setTimeout(() => {
        try {
          originalRevoke(url);
        } catch {
          /* ignore */
        }
      }, 120000);
    };
  } catch {
    /* ignore */
  }

  /* 2. Downloads: além da tentativa nativa, sempre oferece um link real. */
  const offerDownloadFallback = (anchor: HTMLAnchorElement) => {
    if (!embedded) return;
    const href = anchor.href;
    const name = anchor.getAttribute('download') || 'arquivo';
    if (!href) return;
    setTimeout(
      () =>
        showToast({
          message: `Download de "${name}" pronto. Se não começar sozinho, toque em Baixar.`,
          actionLabel: 'Baixar',
          href,
          downloadName: name,
          timeout: 45000,
        }),
      500,
    );
  };

  try {
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement, ...args: any[]) {
      try {
        if (this.hasAttribute('download') && !this.dataset.labirintoFallback) {
          offerDownloadFallback(this);
        }
      } catch {
        /* ignore */
      }
      return (originalClick as any).apply(this, args);
    };

    // jsPDF e file-saver disparam MouseEvent em vez de chamar .click()
    const originalDispatch = HTMLAnchorElement.prototype.dispatchEvent;
    HTMLAnchorElement.prototype.dispatchEvent = function (this: HTMLAnchorElement, ev: Event) {
      try {
        if (
          ev &&
          ev.type === 'click' &&
          this.hasAttribute('download') &&
          !this.dataset.labirintoFallback
        ) {
          offerDownloadFallback(this);
        }
      } catch {
        /* ignore */
      }
      return originalDispatch.call(this, ev);
    };
  } catch (e) {
    console.warn('[Labirinto] não foi possível instalar o fallback de download', e);
  }

  /* 3. Área de transferência com fallback. */
  try {
    const original =
      navigator.clipboard && typeof navigator.clipboard.writeText === 'function'
        ? navigator.clipboard.writeText.bind(navigator.clipboard)
        : null;
    const readText =
      navigator.clipboard && typeof (navigator.clipboard as any).readText === 'function'
        ? (navigator.clipboard as any).readText.bind(navigator.clipboard)
        : undefined;

    const shim: any = {
      __labirintoOriginalWrite: original,
      writeText: async (text: string) => {
        try {
          if (original) {
            await original(text);
            return;
          }
        } catch {
          /* cai para o fallback */
        }
        if (!legacyCopy(text)) {
          await askText({
            title: 'Copiar',
            message: 'Seu navegador bloqueou a cópia automática. Selecione o texto e copie.',
            initialValue: text,
          });
        }
      },
    };
    if (readText) shim.readText = readText;

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: shim });
  } catch (e) {
    console.warn('[Labirinto] fallback de clipboard indisponível', e);
  }

  /* 4. Nenhuma caixa do navegador: todo aviso é exibido dentro da própria
        página, em qualquer contexto (arquivo local, site hospedado ou iframe). */
  try {
    window.alert = (msg?: any) => {
      const text = String(msg ?? '').replace(/^Erro ao gerar com IA:\s*/i, '');
      const isError = /erro|falha|inválid|não foi possível|nao foi possivel|recusad/i.test(text);
      const action = alertActionResolver ? alertActionResolver(text) : null;
      showToast({
        message: text,
        tone: isError ? 'error' : 'info',
        timeout: isError ? 16000 : 10000,
        actionLabel: action?.label,
        onAction: action?.run,
      });
    };
  } catch {
    /* ignore */
  }

  // confirm/prompt do navegador também ficam fora do caminho quando embutido:
  // o app não os usa, mas um retorno silencioso é melhor que uma caixa bloqueada.

  if (embedded) {
    /* 5. Impressão: se o navegador barrar, oferece abrir em nova aba. */
    try {
      const nativePrint = window.print.bind(window);
      window.print = () => {
        try {
          nativePrint();
        } catch {
          showToast({
            message: 'A impressão foi bloqueada aqui dentro. Abra em tela cheia para imprimir.',
            actionLabel: 'Abrir',
            href: window.location.href,
            tone: 'warn',
            timeout: 15000,
          });
        }
      };
    } catch {
      /* ignore */
    }

    /* 6. Armazenamento bloqueado: avisa que os dados não vão persistir. */
    if ((window as any).__labirintoStorageFallback) {
      setTimeout(
        () =>
          showToast({
            message:
              'Este navegador bloqueou o armazenamento no conteúdo incorporado: os diagramas não serão salvos ao recarregar. Abra em tela cheia para salvar normalmente.',
            actionLabel: 'Abrir',
            href: window.location.href,
            tone: 'warn',
            timeout: 0,
          }),
        1500,
      );
    }
  }
};

declare global {
  interface Window {
    __labirintoStorageFallback?: boolean;
    LabirintoCompat?: {
      showToast: typeof showToast;
      askText: typeof askText;
      copyText: typeof copyText;
      isEmbedded: typeof isEmbedded;
    };
  }
}

if (typeof window !== 'undefined') {
  window.LabirintoCompat = { showToast, askText, copyText, isEmbedded };
}
