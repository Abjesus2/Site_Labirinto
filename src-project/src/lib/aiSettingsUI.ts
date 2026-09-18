/**
 * TELA "CONFIGURAR IA"
 * --------------------
 * Feita em DOM puro para funcionar em qualquer contexto (inclusive dentro do
 * iframe do Google Sites, onde prompt/alert nativos são ignorados).
 * Permite cadastrar várias chaves ao mesmo tempo, testar a conexão e escolher
 * qual provedor fica ativo. Tudo é salvo no navegador do próprio usuário.
 */

import { askText, copyText, showToast } from './embedCompat';
import {
  applyImportedConfig,
  buildBakedSnippet,
  cryptoAvailable,
  exportKeyFile,
  parseKeyFile,
  PROVIDERS,
  ProviderDef,
  ProviderConfig,
  loadConfig,
  saveConfig,
  testProvider,
  isProviderReady,
} from './aiProviders';

const Z = 2147483610;
const font = '400 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style?: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (style) Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
};

let openInstance: HTMLDivElement | null = null;

export const openAISettings = (options?: { onSaved?: () => void; message?: string }): void => {
  if (openInstance) {
    openInstance.remove();
    openInstance = null;
  }

  const cfg = loadConfig();
  const draft: Record<string, ProviderConfig> = JSON.parse(JSON.stringify(cfg.providers || {}));
  let activeId = cfg.active || 'free';

  const overlay = el('div', {
    position: 'fixed',
    inset: '0',
    background: 'rgba(15,23,42,.55)',
    zIndex: String(Z),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    font,
  });
  openInstance = overlay;

  const card = el('div', {
    background: '#fff',
    color: '#0f172a',
    borderRadius: '16px',
    width: 'min(720px, 100%)',
    maxHeight: 'min(88vh, 860px)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 70px rgba(0,0,0,.35)',
    overflow: 'hidden',
  });

  /* Cabeçalho */
  const head = el('div', {
    padding: '18px 20px 14px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  });
  const headText = el('div', { flex: '1' });
  headText.appendChild(el('div', { fontWeight: '700', fontSize: '17px' }, 'Configurar IA'));
  headText.appendChild(
    el(
      'div',
      { color: '#64748b', fontSize: '13px', marginTop: '4px' },
      options?.message ||
        'Escolha qual inteligência artificial vai gerar os fluxogramas. As chaves ficam salvas apenas neste navegador — você pode cadastrar várias e alternar quando quiser.',
    ),
  );
  const closeBtn = el('button', {
    border: '0',
    background: 'transparent',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#94a3b8',
    lineHeight: '1',
  }, '✕');
  closeBtn.onclick = () => close();
  head.appendChild(headText);
  head.appendChild(closeBtn);
  card.appendChild(head);

  /* Corpo rolável */
  const body = el('div', { padding: '12px 20px', overflowY: 'auto', flex: '1' });
  card.appendChild(body);

  const rows: Record<
    string,
    {
      row: HTMLDivElement;
      details: HTMLDivElement;
      status: HTMLSpanElement;
      radio: HTMLInputElement;
      toggle: HTMLButtonElement;
      subtitle: HTMLDivElement;
    }
  > = {};

  // Selecionar e expandir são coisas separadas: clicar na linha só escolhe
  // a IA; os campos aparecem no botão "Detalhes".
  const expanded = new Set<string>();

  const statusText = (def: ProviderDef): string => {
    const c = draft[def.id] || {};
    if (def.keyless && !c.key) return 'pronto para usar';
    if (c.key && c.key.trim()) return 'chave salva';
    return 'sem chave';
  };

  const paint = () => {
    for (const def of PROVIDERS) {
      const r = rows[def.id];
      const selected = def.id === activeId;
      const isOpen = expanded.has(def.id);
      r.radio.checked = selected;
      r.row.style.borderColor = selected ? '#2563eb' : '#e2e8f0';
      r.row.style.background = selected ? '#f8fafc' : '#fff';
      r.row.style.boxShadow = selected ? 'inset 0 0 0 1px #2563eb' : 'none';
      r.details.style.display = isOpen ? 'block' : 'none';
      r.toggle.textContent = isOpen ? 'Ocultar ▴' : 'Detalhes ▾';
      r.toggle.style.color = isOpen ? '#1d4ed8' : '#64748b';
      const cfgRow = draft[def.id] || {};
      r.subtitle.textContent = `Modelo: ${(cfgRow.model || '').trim() || def.defaultModel}`;
      const ready = isProviderReady(def, draft[def.id] || {});
      r.status.textContent = statusText(def);
      r.status.style.background = ready ? '#dcfce7' : '#fef3c7';
      r.status.style.color = ready ? '#166534' : '#92400e';
    }
  };

  for (const def of PROVIDERS) {
    const row = el('div', {
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '12px 14px',
      marginBottom: '10px',
      cursor: 'pointer',
    });

    const header = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'labirinto-ai-provider';
    radio.style.accentColor = '#2563eb';

    const nameWrap = el('div', { flex: '1', minWidth: '0' });
    const nameLine = el('div', { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' });
    nameLine.appendChild(el('span', { fontWeight: '600' }, def.name));
    nameLine.appendChild(
      el(
        'span',
        {
          fontSize: '11px',
          background: '#eff6ff',
          color: '#1d4ed8',
          borderRadius: '999px',
          padding: '2px 8px',
          fontWeight: '600',
        },
        def.badge,
      ),
    );
    nameWrap.appendChild(nameLine);
    const subtitle = el('div', {
      fontSize: '11px',
      color: '#94a3b8',
      marginTop: '2px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
    nameWrap.appendChild(subtitle);

    const status = el('span', {
      fontSize: '11px',
      borderRadius: '999px',
      padding: '3px 9px',
      fontWeight: '700',
      whiteSpace: 'nowrap',
    });

    header.appendChild(radio);
    header.appendChild(nameWrap);
    header.appendChild(status);

    const toggle = el('button', {
      border: '1px solid #e2e8f0',
      background: '#fff',
      borderRadius: '8px',
      padding: '4px 8px',
      fontSize: '11px',
      fontWeight: '700',
      color: '#64748b',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }, 'Detalhes ▾');
    toggle.onclick = (e) => {
      e.stopPropagation();
      if (expanded.has(def.id)) expanded.delete(def.id);
      else expanded.add(def.id);
      paint();
    };
    header.appendChild(toggle);

    row.appendChild(header);

    /* Detalhes do provedor */
    const details = el('div', { display: 'none', marginTop: '12px' });

    const field = (label: string, hint?: string) => {
      const wrap = el('div', { marginBottom: '10px' });
      wrap.appendChild(el('label', { display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }, label));
      const input = el('input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      Object.assign(input.style, {
        width: '100%',
        boxSizing: 'border-box',
        padding: '9px 11px',
        border: '1px solid #cbd5e1',
        borderRadius: '9px',
        fontSize: '13px',
        outline: 'none',
      } as CSSStyleDeclaration);
      wrap.appendChild(input);
      if (hint) wrap.appendChild(el('div', { fontSize: '11px', color: '#94a3b8', marginTop: '4px' }, hint));
      details.appendChild(wrap);
      return input;
    };

    let endpointInput: HTMLInputElement | null = null;
    if (def.editableEndpoint) {
      endpointInput = field('Endpoint', 'Endereço completo da API, no formato compatível com OpenAI.');
      endpointInput.value = draft[def.id]?.endpoint || def.endpoint;
      endpointInput.oninput = () => {
        draft[def.id] = { ...(draft[def.id] || {}), endpoint: endpointInput!.value.trim() };
      };
    }

    const modelInput = field(
      'Modelo',
      def.models.length ? `Sugestões: ${def.models.join(', ')}` : 'Nome exato do modelo no serviço escolhido.',
    );
    modelInput.value = draft[def.id]?.model || def.defaultModel;
    modelInput.oninput = () => {
      draft[def.id] = { ...(draft[def.id] || {}), model: modelInput.value.trim() };
    };

    const keyInput = field(def.keyLabel || 'Chave de API', def.keyHint);
    keyInput.type = 'password';
    keyInput.value = draft[def.id]?.key || '';
    keyInput.placeholder = def.keyless ? 'opcional' : 'cole aqui a sua chave';
    keyInput.oninput = () => {
      draft[def.id] = { ...(draft[def.id] || {}), key: keyInput.value.trim() };
      paint();
    };

    /* Botões da linha */
    const actions = el('div', { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' });
    const mkSmall = (label: string, primary = false) => {
      const b = el('button', {
        padding: '7px 12px',
        borderRadius: '9px',
        border: primary ? '0' : '1px solid #cbd5e1',
        background: primary ? '#2563eb' : '#fff',
        color: primary ? '#fff' : '#0f172a',
        fontWeight: '600',
        fontSize: '12px',
        cursor: 'pointer',
      }, label);
      return b;
    };

    const showBtn = mkSmall('Mostrar chave');
    showBtn.onclick = (e) => {
      e.stopPropagation();
      const hidden = keyInput.type === 'password';
      keyInput.type = hidden ? 'text' : 'password';
      showBtn.textContent = hidden ? 'Ocultar chave' : 'Mostrar chave';
    };

    const testBtn = mkSmall('Testar conexão', true);
    const testResult = el('span', { fontSize: '12px', color: '#475569' });
    testBtn.onclick = async (e) => {
      e.stopPropagation();
      testBtn.disabled = true;
      testBtn.textContent = 'Testando...';
      testResult.textContent = '';
      const r = await testProvider(def, draft[def.id] || {});
      testResult.textContent = r.message;
      testResult.style.color = r.ok ? '#166534' : '#b91c1c';
      testBtn.disabled = false;
      testBtn.textContent = 'Testar conexão';
    };

    const clearBtn = mkSmall('Apagar chave');
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      keyInput.value = '';
      draft[def.id] = { ...(draft[def.id] || {}), key: '' };
      paint();
    };

    actions.appendChild(testBtn);
    if (!def.keyless) actions.appendChild(showBtn);
    actions.appendChild(clearBtn);
    details.appendChild(actions);
    details.appendChild(testResult);

    /* Passo a passo */
    const stepsBox = el('div', {
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      padding: '10px 12px',
      marginTop: '10px',
    });
    stepsBox.appendChild(
      el('div', { fontWeight: '700', fontSize: '12px', marginBottom: '6px', color: '#334155' }, 'Como obter o acesso'),
    );
    const ol = el('ol', { margin: '0', paddingLeft: '18px', fontSize: '12px', color: '#475569' });
    for (const s of def.steps) ol.appendChild(el('li', { marginBottom: '3px' }, s));
    stepsBox.appendChild(ol);
    if (def.keyUrl) {
      const a = el('a', { display: 'inline-block', marginTop: '8px', color: '#2563eb', fontWeight: '600', fontSize: '12px', textDecoration: 'none' }, `Abrir ${def.keyUrl}`);
      (a as HTMLAnchorElement).href = def.keyUrl;
      (a as HTMLAnchorElement).target = '_blank';
      (a as HTMLAnchorElement).rel = 'noopener';
      a.onclick = (e) => e.stopPropagation();
      stepsBox.appendChild(a);
    }
    if (def.notes) {
      stepsBox.appendChild(
        el('div', { marginTop: '8px', fontSize: '12px', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 10px' }, def.notes),
      );
    }
    details.appendChild(stepsBox);

    row.appendChild(details);
    row.onclick = () => {
      activeId = def.id;
      paint();
    };

    body.appendChild(row);
    rows[def.id] = { row, details, status, radio, toggle, subtitle };
  }

  /* Backup das chaves */
  const backup = el('div', {
    border: '1px dashed #cbd5e1',
    borderRadius: '12px',
    padding: '12px 14px',
    marginTop: '4px',
    marginBottom: '10px',
    background: '#f8fafc',
  });
  backup.appendChild(el('div', { fontWeight: '700', fontSize: '13px', marginBottom: '2px' }, 'Backup das chaves'));
  backup.appendChild(
    el(
      'div',
      { fontSize: '12px', color: '#64748b', marginBottom: '10px' },
      'Salve suas chaves num arquivo e recupere depois em outro navegador, outro computador ou depois de limpar os dados — sem precisar colar tudo de novo.',
    ),
  );

  const backupBtns = el('div', { display: 'flex', gap: '8px', flexWrap: 'wrap' });
  const mkBackupBtn = (label: string, primary = false) =>
    el('button', {
      padding: '8px 12px',
      borderRadius: '9px',
      border: primary ? '0' : '1px solid #cbd5e1',
      background: primary ? '#0f172a' : '#fff',
      color: primary ? '#fff' : '#0f172a',
      fontWeight: '600',
      fontSize: '12px',
      cursor: 'pointer',
    }, label);

  const saveDraftFirst = () => saveConfig({ active: activeId, providers: draft });

  const doExport = async (withPassword: boolean) => {
    saveDraftFirst();
    let password: string | undefined;
    if (withPassword) {
      const typed = await askText({
        title: 'Senha do arquivo',
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
      const content = await exportKeyFile(password);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.setAttribute('download', `chaves-ia-labirinto-${stamp}${password ? '-protegido' : ''}.json`);
      a.setAttribute('href', url);
      a.click();
      showToast({
        message: password
          ? 'Arquivo protegido gerado. Guarde a senha: sem ela o arquivo não abre.'
          : 'Arquivo gerado. Ele contém as chaves em texto puro — guarde em local seguro.',
        tone: password ? 'info' : 'warn',
        timeout: 14000,
      });
    } catch (e: any) {
      showToast({ message: String(e?.message || e), tone: 'error', timeout: 12000 });
    }
  };

  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.style.display = 'none';
  fileInput.onchange = async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      let incoming;
      try {
        incoming = await parseKeyFile(text);
      } catch (e: any) {
        if (String(e?.message) !== 'SENHA_NECESSARIA') throw e;
        const password = await askText({
          title: 'Arquivo protegido',
          message: 'Informe a senha usada quando este backup foi criado.',
          placeholder: 'senha do arquivo',
        });
        if (!password) return;
        incoming = await parseKeyFile(text, password);
      }
      const total = Object.keys(incoming.providers || {}).length;
      applyImportedConfig(incoming, 'merge');
      close();
      openAISettings({
        message: `Backup importado: ${total} provedor(es) restaurado(s). Confira e clique em Salvar.`,
      });
      showToast({ message: 'Chaves importadas com sucesso.', timeout: 8000 });
    } catch (e: any) {
      showToast({ message: String(e?.message || e), tone: 'error', timeout: 12000 });
    }
  };

  const btnExportPwd = mkBackupBtn('Exportar com senha', true);
  btnExportPwd.onclick = () => doExport(true);
  if (!cryptoAvailable()) {
    btnExportPwd.disabled = true;
    btnExportPwd.title = 'Indisponível neste contexto: use um endereço https.';
    btnExportPwd.style.opacity = '0.5';
  }
  const btnExportPlain = mkBackupBtn('Exportar sem senha');
  btnExportPlain.onclick = () => doExport(false);
  const btnImport = mkBackupBtn('Importar arquivo');
  btnImport.onclick = () => fileInput.click();
  const btnSnippet = mkBackupBtn('Copiar bloco para o index.html');
  btnSnippet.onclick = async () => {
    saveDraftFirst();
    await copyText(buildBakedSnippet());
    showToast({
      message: 'Bloco copiado. Cole dentro do <head> do index.html para o app já abrir configurado (a chave fica visível no código-fonte).',
      tone: 'warn',
      timeout: 16000,
    });
  };

  backupBtns.appendChild(btnExportPwd);
  backupBtns.appendChild(btnExportPlain);
  backupBtns.appendChild(btnImport);
  backupBtns.appendChild(btnSnippet);
  backup.appendChild(backupBtns);
  backup.appendChild(fileInput);
  body.appendChild(backup);

  /* Rodapé */
  const foot = el('div', {
    padding: '14px 20px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  });
  const hint = el('div', { fontSize: '11px', color: '#94a3b8', flex: '1', minWidth: '180px' },
    'As chaves nunca saem deste navegador: ficam no armazenamento local e são enviadas apenas para o serviço escolhido.');
  const btns = el('div', { display: 'flex', gap: '8px' });
  const cancel = el('button', {
    padding: '9px 14px', borderRadius: '10px', border: '1px solid #cbd5e1',
    background: '#fff', color: '#0f172a', fontWeight: '600', cursor: 'pointer', fontSize: '14px',
  }, 'Fechar');
  cancel.onclick = () => close();
  const save = el('button', {
    padding: '9px 16px', borderRadius: '10px', border: '0',
    background: '#2563eb', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '14px',
  }, 'Salvar');
  save.onclick = () => {
    saveConfig({ active: activeId, providers: draft });
    close();
    options?.onSaved?.();
  };
  btns.appendChild(cancel);
  btns.appendChild(save);
  foot.appendChild(hint);
  foot.appendChild(btns);
  card.appendChild(foot);

  const close = () => {
    overlay.remove();
    if (openInstance === overlay) openInstance = null;
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Quando a janela é aberta por um aviso (falta de chave, troca de provedor),
  // já mostra os campos do provedor ativo — nos demais casos tudo fica fechado.
  if (options?.message) {
    const activeDef = PROVIDERS.find((p) => p.id === activeId);
    if (activeDef && !isProviderReady(activeDef, draft[activeId] || {})) expanded.add(activeId);
  }

  paint();
};
