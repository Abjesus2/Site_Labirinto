/**
 * LEMBRETE DE BACKUP NO PC
 * ------------------------
 * O app salva tudo só neste navegador. Para não perder o trabalho (limpeza
 * de dados do navegador, troca de computador), o usuário escolhe de quanto
 * em quanto tempo quer ser lembrado de baixar um backup. Quando o tempo
 * chega, o botão "Salvo" muda de cor e pisca até ser clicado.
 *
 * A contagem só começa na PRIMEIRA ALTERAÇÃO feita depois do último backup
 * (ou do último clique no alerta): sem nada novo para salvar, o alerta não
 * volta a piscar.
 *
 * Estado global do navegador (não por diagrama), guardado em localStorage.
 * Módulo sem React (a parte de React fica em useBackupReminder) para poder
 * ser testado isolado.
 */

export const BACKUP_REMINDER_KEY = 'labirinto_backup_reminder_v1';

/** Opções prontas, em minutos (0 = desligado). */
export const BACKUP_REMINDER_PRESETS: { label: string; minutes: number }[] = [
  { label: 'Desligado', minutes: 0 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: '4 horas', minutes: 240 },
];

export interface BackupReminderState {
  /** Intervalo em minutos; 0 = lembrete desligado. */
  intervalMin: number;
  /** Último clique no alerta / último backup baixado (ms). */
  lastAck: number;
  /** Primeira alteração feita depois do último backup (ms); null = nada novo, não conta. */
  pendingSince: number | null;
}

const DEFAULT_STATE: BackupReminderState = { intervalMin: 0, lastAck: 0, pendingSince: null };

/** Limites do valor digitado manualmente (1 minuto a 24 horas). */
export const MIN_CUSTOM_MINUTES = 1;
export const MAX_CUSTOM_MINUTES = 24 * 60;

export const normalizeMinutes = (value: unknown): number => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_CUSTOM_MINUTES, Math.max(MIN_CUSTOM_MINUTES, n));
};

export const loadBackupReminder = (): BackupReminderState => {
  try {
    const raw = localStorage.getItem(BACKUP_REMINDER_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return {
      intervalMin: normalizeMinutes(parsed?.intervalMin),
      lastAck: Number(parsed?.lastAck) || 0,
      pendingSince: Number(parsed?.pendingSince) > 0 ? Number(parsed.pendingSince) : null,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
};

export const saveBackupReminder = (state: BackupReminderState): void => {
  try {
    localStorage.setItem(BACKUP_REMINDER_KEY, JSON.stringify(state));
  } catch {
    // Navegador sem localStorage (modo privado restrito): o lembrete só vale nesta aba.
  }
};

/** Milissegundos até o lembrete disparar (0 = já está vencido; null = desligado ou sem alteração para salvar). */
export const msUntilDue = (state: BackupReminderState, now: number): number | null => {
  if (!state.intervalMin || !state.pendingSince) return null;
  const dueAt = state.pendingSince + state.intervalMin * 60_000;
  return Math.max(0, dueAt - now);
};

/** Houve uma alteração: começa a contar (se já não estiver contando). */
export const markChanged = (state: BackupReminderState, now: number): BackupReminderState =>
  state.pendingSince ? state : { ...state, pendingSince: now };

/** Clique no alerta ou backup baixado: para de piscar e espera a próxima alteração. */
export const acknowledgeBackup = (state: BackupReminderState, now: number): BackupReminderState => ({
  ...state,
  lastAck: now,
  pendingSince: null,
});

export const isBackupDue = (state: BackupReminderState, now: number): boolean => msUntilDue(state, now) === 0;

/** "23 min", "1 h 05 min", "agora" (arredonda os minutos para cima). */
export const formatRemaining = (ms: number): string => {
  if (ms <= 0) return 'agora';
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
};

export const describeInterval = (minutes: number): string => {
  if (!minutes) return 'Desligado';
  const preset = BACKUP_REMINDER_PRESETS.find((p) => p.minutes === minutes);
  if (preset) return preset.label;
  return formatRemaining(minutes * 60_000);
};
