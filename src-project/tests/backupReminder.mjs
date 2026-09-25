import { msUntilDue, isBackupDue, normalizeMinutes, formatRemaining, describeInterval, BACKUP_REMINDER_PRESETS, markChanged, acknowledgeBackup } from '../.tmp-backupReminder.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const agora = 1_000_000_000;
check('lembrete desligado nunca vence', msUntilDue({ intervalMin: 0, lastAck: 0, pendingSince: agora - 99 * 60_000 }, agora) === null && !isBackupDue({ intervalMin: 0, lastAck: 0, pendingSince: agora - 99 * 60_000 }, agora));
check('sem alteração não conta (não pisca mesmo passando o tempo)', msUntilDue({ intervalMin: 30, lastAck: agora - 300 * 60_000, pendingSince: null }, agora) === null && !isBackupDue({ intervalMin: 30, lastAck: agora - 300 * 60_000, pendingSince: null }, agora));
check('conta a partir da primeira alteração: 30 min depois de 10 min faltam 20', msUntilDue({ intervalMin: 30, lastAck: 0, pendingSince: agora - 10 * 60_000 }, agora) === 20 * 60_000);
check('passou do tempo depois da alteração: vencido (pisca)', isBackupDue({ intervalMin: 30, lastAck: 0, pendingSince: agora - 31 * 60_000 }, agora));
check('exatamente no tempo: vencido', isBackupDue({ intervalMin: 30, lastAck: 0, pendingSince: agora - 30 * 60_000 }, agora));
check('ainda não chegou: não vence', !isBackupDue({ intervalMin: 30, lastAck: 0, pendingSince: agora - 29 * 60_000 }, agora));
const parado = { intervalMin: 30, lastAck: 0, pendingSince: null };
const mudou = markChanged(parado, agora - 5 * 60_000);
check('primeira alteração começa a contagem', mudou.pendingSince === agora - 5 * 60_000);
check('alterações seguintes não reiniciam a contagem', markChanged(mudou, agora).pendingSince === agora - 5 * 60_000);
const ciente = acknowledgeBackup({ intervalMin: 30, lastAck: 0, pendingSince: agora - 40 * 60_000 }, agora);
check('clicar no alerta / baixar backup para de piscar e espera nova alteração', !isBackupDue(ciente, agora + 999 * 60_000) && ciente.pendingSince === null && ciente.lastAck === agora);
check('tempo digitado é arredondado e limitado (1 min a 24 h)', normalizeMinutes('7.4') === 7 && normalizeMinutes(0) === 0 && normalizeMinutes(-5) === 0 && normalizeMinutes(99999) === 1440 && normalizeMinutes('abc') === 0);
check('formata o tempo restante', formatRemaining(20 * 60_000) === '20 min' && formatRemaining(65 * 60_000) === '1 h 05 min' && formatRemaining(120 * 60_000) === '2 h' && formatRemaining(0) === 'agora' && formatRemaining(30_000) === '1 min');
check('descreve o intervalo', describeInterval(60) === '1 hora' && describeInterval(0) === 'Desligado' && describeInterval(45) === '45 min');
check('opções prontas: desligado, 15 min, 30 min, 1 h, 2 h, 4 h', BACKUP_REMINDER_PRESETS.map((p) => p.minutes).join(',') === '0,15,30,60,120,240');

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
