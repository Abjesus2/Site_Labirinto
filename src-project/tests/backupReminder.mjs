import { msUntilDue, isBackupDue, normalizeMinutes, formatRemaining, describeInterval, BACKUP_REMINDER_PRESETS } from '../.tmp-backupReminder.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const agora = 1_000_000_000;
check('lembrete desligado nunca vence', msUntilDue({ intervalMin: 0, lastAck: 0 }, agora) === null && !isBackupDue({ intervalMin: 0, lastAck: 0 }, agora));
check('30 min depois de 10 min: faltam 20 min', msUntilDue({ intervalMin: 30, lastAck: agora - 10 * 60_000 }, agora) === 20 * 60_000);
check('passou do tempo: vencido (pisca)', isBackupDue({ intervalMin: 30, lastAck: agora - 31 * 60_000 }, agora));
check('exatamente no tempo: vencido', isBackupDue({ intervalMin: 30, lastAck: agora - 30 * 60_000 }, agora));
check('ainda não chegou: não vence', !isBackupDue({ intervalMin: 30, lastAck: agora - 29 * 60_000 }, agora));
check('tempo digitado é arredondado e limitado (1 min a 24 h)', normalizeMinutes('7.4') === 7 && normalizeMinutes(0) === 0 && normalizeMinutes(-5) === 0 && normalizeMinutes(99999) === 1440 && normalizeMinutes('abc') === 0);
check('formata o tempo restante', formatRemaining(20 * 60_000) === '20 min' && formatRemaining(65 * 60_000) === '1 h 05 min' && formatRemaining(120 * 60_000) === '2 h' && formatRemaining(0) === 'agora' && formatRemaining(30_000) === '1 min');
check('descreve o intervalo', describeInterval(60) === '1 hora' && describeInterval(0) === 'Desligado' && describeInterval(45) === '45 min');
check('opções prontas: desligado, 15 min, 30 min, 1 h, 2 h, 4 h', BACKUP_REMINDER_PRESETS.map((p) => p.minutes).join(',') === '0,15,30,60,120,240');

console.log(R.join('\n'));
