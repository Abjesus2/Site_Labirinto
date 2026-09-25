import { useCallback, useEffect, useState } from 'react';
import {
  BackupReminderState,
  acknowledgeBackup,
  markChanged as markChangedState,
  isBackupDue,
  loadBackupReminder,
  msUntilDue,
  normalizeMinutes,
  saveBackupReminder,
} from './backupReminder';

/**
 * Estado do lembrete de backup para a tela: relógio de 15 em 15 segundos
 * (precisão suficiente para lembretes de minutos) e ações para trocar o
 * intervalo, avisar que o fluxo mudou (começa a contar) e "dar ciência" do
 * alerta (para de piscar e espera a próxima alteração).
 */
export const useBackupReminder = () => {
  const [state, setState] = useState<BackupReminderState>(() => loadBackupReminder());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    // Outra aba mudou o lembrete: acompanha.
    const onStorage = () => setState(loadBackupReminder());
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = useCallback((next: BackupReminderState) => {
    saveBackupReminder(next);
    setState(next);
    setNow(Date.now());
  }, []);

  /** Liga/troca o intervalo; se já há alteração sem backup, conta a partir de agora. */
  const setIntervalMinutes = useCallback((minutes: number) => {
    const current = loadBackupReminder();
    const now = Date.now();
    update({ intervalMin: normalizeMinutes(minutes), lastAck: now, pendingSince: current.pendingSince ? now : null });
  }, [update]);

  /** Clique no alerta ou backup baixado: para de piscar e espera a próxima alteração. */
  const acknowledge = useCallback(() => {
    update(acknowledgeBackup(loadBackupReminder(), Date.now()));
  }, [update]);

  /** O fluxo mudou de verdade: começa a contar (só grava na primeira vez). */
  const markChanged = useCallback(() => {
    const current = loadBackupReminder();
    if (current.pendingSince) return;
    update(markChangedState(current, Date.now()));
  }, [update]);

  return {
    intervalMin: state.intervalMin,
    due: isBackupDue(state, now),
    remainingMs: msUntilDue(state, now),
    /** Ligado, mas sem alteração nova desde o último backup (não está contando). */
    waitingForChange: state.intervalMin > 0 && !state.pendingSince,
    setIntervalMinutes,
    acknowledge,
    markChanged,
  };
};
