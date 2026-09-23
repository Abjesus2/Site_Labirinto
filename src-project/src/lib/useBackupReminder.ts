import { useCallback, useEffect, useState } from 'react';
import {
  BackupReminderState,
  isBackupDue,
  loadBackupReminder,
  msUntilDue,
  normalizeMinutes,
  saveBackupReminder,
} from './backupReminder';

/**
 * Estado do lembrete de backup para a tela: relógio de 15 em 15 segundos
 * (precisão suficiente para lembretes de minutos) e ações para trocar o
 * intervalo e "dar ciência" do alerta (para de piscar e recomeça a contagem).
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

  /** Liga/troca o intervalo; a contagem recomeça a partir de agora. */
  const setIntervalMinutes = useCallback(
    (minutes: number) => update({ intervalMin: normalizeMinutes(minutes), lastAck: Date.now() }),
    [update],
  );

  /** Clique no alerta ou backup baixado: para de piscar e recomeça a contagem. */
  const acknowledge = useCallback(() => {
    const current = loadBackupReminder();
    update({ ...current, lastAck: Date.now() });
  }, [update]);

  return {
    intervalMin: state.intervalMin,
    due: isBackupDue(state, now),
    remainingMs: msUntilDue(state, now),
    setIntervalMinutes,
    acknowledge,
  };
};
