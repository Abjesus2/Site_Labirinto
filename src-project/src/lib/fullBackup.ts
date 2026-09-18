/**
 * BACKUP COMPLETO — chaves de IA + diagramas + pastas num único arquivo.
 * -----------------------------------------------------------------------
 * O app não tem login nem nuvem: tudo fica só no navegador (localStorage).
 * Isso é ótimo para privacidade, mas significa que trocar de navegador,
 * trocar de computador ou simplesmente limpar os dados do site apaga tudo
 * sem aviso. Este módulo empacota exatamente o que existe nesses três
 * lugares (labirinto_local_diagrams, labirinto_local_folders e a
 * configuração de IA) num único arquivo .json que o usuário guarda onde
 * quiser e importa depois para continuar de onde parou.
 *
 * Mesmo esquema do backup de chaves (aiProviders.ts): PBKDF2 + AES-GCM
 * quando o usuário escolhe senha, texto puro quando não escolhe.
 */
import { getLocalDiagrams, saveLocalDiagram, getLocalFolders, saveLocalFolder } from './storage';
import { Diagram, Folder } from '../types';
import {
  AIConfig,
  loadConfig,
  applyImportedConfig,
  cryptoAvailable,
  deriveKey,
  toB64,
  fromB64,
  encoder,
  decoder,
} from './aiProviders';

export const FULL_BACKUP_TYPE = 'labirinto-full-backup';

export interface FullBackupPayload {
  diagrams: Diagram[];
  folders: Folder[];
  aiConfig: AIConfig;
}

interface FullBackupFile {
  app: string;
  type: string;
  version: number;
  encrypted: boolean;
  exportedAt: string;
  payload?: FullBackupPayload;
  kdf?: { name: string; hash: string; iterations: number; salt: string };
  cipher?: { name: string; iv: string };
  data?: string;
}

/** Gera o conteúdo do arquivo de backup completo, com ou sem senha. */
export const exportFullBackup = async (password?: string): Promise<string> => {
  const payload: FullBackupPayload = {
    diagrams: getLocalDiagrams(),
    folders: getLocalFolders(),
    aiConfig: loadConfig(),
  };

  const base: FullBackupFile = {
    app: 'Labirinto Fluxogramas',
    type: FULL_BACKUP_TYPE,
    version: 1,
    encrypted: false,
    exportedAt: new Date().toISOString(),
  };

  if (!password) {
    return JSON.stringify({ ...base, payload }, null, 2);
  }

  if (!cryptoAvailable()) {
    throw new Error('Este navegador não permite criptografar aqui. Exporte sem senha ou abra o app por um endereço https.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(payload)),
  );

  return JSON.stringify(
    {
      ...base,
      encrypted: true,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 250000, salt: toB64(salt) },
      cipher: { name: 'AES-GCM', iv: toB64(iv) },
      data: toB64(cipherBuf),
    },
    null,
    2,
  );
};

/** Lê o arquivo de backup completo; pede a senha somente quando ele está protegido. */
export const parseFullBackup = async (text: string, password?: string): Promise<FullBackupPayload> => {
  let file: FullBackupFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('Arquivo inválido: não é um backup completo do Labirinto.');
  }

  if (!file || file.type !== FULL_BACKUP_TYPE) {
    throw new Error('Arquivo inválido: não é um backup completo do Labirinto.');
  }

  if (!file.encrypted) {
    if (!file.payload || typeof file.payload !== 'object') {
      throw new Error('Arquivo de backup sem conteúdo.');
    }
    return {
      diagrams: Array.isArray(file.payload.diagrams) ? file.payload.diagrams : [],
      folders: Array.isArray(file.payload.folders) ? file.payload.folders : [],
      aiConfig: file.payload.aiConfig || { active: 'free', providers: {} },
    };
  }

  if (!password) throw new Error('SENHA_NECESSARIA');
  if (!cryptoAvailable()) throw new Error('Este navegador não consegue abrir arquivos protegidos por senha.');

  try {
    const key = await deriveKey(password, fromB64(file.kdf!.salt));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(file.cipher!.iv) },
      key,
      fromB64(file.data!),
    );
    const payload = JSON.parse(decoder.decode(plain)) as FullBackupPayload;
    return {
      diagrams: Array.isArray(payload.diagrams) ? payload.diagrams : [],
      folders: Array.isArray(payload.folders) ? payload.folders : [],
      aiConfig: payload.aiConfig || { active: 'free', providers: {} },
    };
  } catch (e: any) {
    if (String(e?.message) === 'SENHA_NECESSARIA') throw e;
    throw new Error('Senha incorreta ou arquivo corrompido.');
  }
};

/**
 * Aplica o backup completo neste navegador. Sempre em modo "somar": pastas e
 * diagramas do arquivo entram (substituindo pelo id quem já existir aqui com
 * o mesmo id), e nada do que já está neste navegador é apagado. As chaves de
 * IA seguem a mesma regra do backup de chaves — mantém as que não vierem no
 * arquivo.
 */
export const applyFullBackup = (
  payload: FullBackupPayload,
): { diagramsCount: number; foldersCount: number } => {
  payload.folders.forEach((folder) => saveLocalFolder(folder));
  payload.diagrams.forEach((diagram) => saveLocalDiagram(diagram));
  applyImportedConfig(payload.aiConfig, 'merge');

  return {
    diagramsCount: payload.diagrams.length,
    foldersCount: payload.folders.length,
  };
};
