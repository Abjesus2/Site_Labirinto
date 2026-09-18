/**
 * LEITURA DE PLANILHAS NO NAVEGADOR
 * ---------------------------------
 * Converte um .xlsx em texto tabulado para mandar junto com o prompt da IA.
 * O arquivo .xlsx é um zip de XMLs, então dá para ler sem nenhuma biblioteca
 * de planilha: basta o leitor de zip (jszip) que já vem no pacote.
 * Arquivos .csv são texto puro e nem passam por aqui.
 */

const MAX_ROWS_PER_SHEET = 300;
const MAX_CHARS = 24000;

const decodeXml = (value: string): string =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');

const textOf = (xml: string): string => {
  const parts = xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
  return parts.map((p) => decodeXml(p.replace(/<[^>]+>/g, ''))).join('');
};

/** Coluna da referência da célula ("B7" -> 1), para manter as colunas alinhadas. */
const columnIndex = (ref: string): number => {
  const letters = (ref.match(/^[A-Z]+/) || [''])[0];
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return Math.max(0, index - 1);
};

export const isSpreadsheetFile = (name = '', mimeType = ''): boolean =>
  /\.xlsx$/i.test(name) ||
  mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const isLegacyExcel = (name = '', mimeType = ''): boolean =>
  /\.xls$/i.test(name) || mimeType === 'application/vnd.ms-excel';

/** Devolve o conteúdo da planilha como texto, uma linha por linha da planilha. */
export const extractSpreadsheetText = async (
  arrayBuffer: ArrayBuffer,
  fileName = 'planilha.xlsx',
): Promise<string> => {
  const JSZipModule: any = await import('jszip');
  const JSZip = JSZipModule.default || JSZipModule;
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Textos compartilhados (o xlsx guarda as strings numa tabela separada)
  const shared: string[] = [];
  const sharedFile = zip.file('xl/sharedStrings.xml');
  if (sharedFile) {
    const xml: string = await sharedFile.async('string');
    for (const block of xml.split('<si>').slice(1)) {
      shared.push(textOf(block.split('</si>')[0]));
    }
  }

  // Nomes das abas, na ordem do workbook
  let sheetNames: string[] = [];
  const workbookFile = zip.file('xl/workbook.xml');
  if (workbookFile) {
    const xml: string = await workbookFile.async('string');
    sheetNames = (xml.match(/<sheet[^>]*name="([^"]*)"/g) || []).map((tag) =>
      decodeXml((tag.match(/name="([^"]*)"/) || ['', ''])[1]),
    );
  }

  const sheetPaths = Object.keys(zip.files)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .sort((a, b) => {
      const na = Number((a.match(/sheet(\d+)/) || [])[1] || 0);
      const nb = Number((b.match(/sheet(\d+)/) || [])[1] || 0);
      return na - nb;
    });

  const out: string[] = [`[Conteúdo da planilha ${fileName}]`];
  let total = out[0].length;

  for (let s = 0; s < sheetPaths.length; s++) {
    const xml: string = await zip.file(sheetPaths[s]).async('string');
    const rows = xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];
    if (rows.length === 0) continue;

    const header = `\n--- Aba: ${sheetNames[s] || `Planilha ${s + 1}`} ---`;
    out.push(header);
    total += header.length;

    let used = 0;
    for (const row of rows) {
      if (used >= MAX_ROWS_PER_SHEET || total >= MAX_CHARS) break;

      const cells = row.match(/<c[^>]*>[\s\S]*?<\/c>|<c[^>]*\/>/g) || [];
      const values: string[] = [];

      for (const cell of cells) {
        const ref = (cell.match(/r="([A-Z]+\d+)"/) || ['', ''])[1];
        const type = (cell.match(/t="([^"]+)"/) || ['', ''])[1];
        let value = '';

        if (type === 'inlineStr') {
          value = textOf(cell);
        } else {
          const raw = (cell.match(/<v[^>]*>([\s\S]*?)<\/v>/) || ['', ''])[1];
          if (type === 's') {
            value = shared[Number(raw)] ?? '';
          } else {
            value = decodeXml(raw);
          }
        }

        const col = ref ? columnIndex(ref) : values.length;
        while (values.length < col) values.push('');
        values.push(value);
      }

      const line = values.join('\t').trimEnd();
      if (!line) continue;
      out.push(line);
      total += line.length + 1;
      used++;
    }

    if (rows.length > used) {
      out.push(`(... ${rows.length - used} linhas restantes não enviadas)`);
    }
  }

  if (out.length === 1) return `[A planilha ${fileName} não tinha conteúdo legível]`;
  return out.join('\n').slice(0, MAX_CHARS);
};
