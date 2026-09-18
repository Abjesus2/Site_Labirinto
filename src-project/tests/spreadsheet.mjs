import { extractSpreadsheetText, isSpreadsheetFile, isLegacyExcel } from '../.tmp-spreadsheet.mjs';
import JSZip from '../node_modules/jszip/dist/jszip.min.js';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

// monta um .xlsx minimo, como o Excel grava
const zip = new JSZip();
zip.file('xl/workbook.xml', `<?xml version="1.0"?><workbook><sheets><sheet name="Processo" sheetId="1" r:id="rId1"/></sheets></workbook>`);
zip.file('xl/sharedStrings.xml', `<?xml version="1.0"?><sst count="4"><si><t>Etapa</t></si><si><t>Responsável</t></si><si><t>Conferência de Notas</t></si><si><t>Expedição &amp; Carga</t></si></sst>`);
zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0"?><worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>15</v></c></row>
<row r="3"><c r="A3" t="s"><v>3</v></c><c r="C3" t="inlineStr"><is><t>Logística</t></is></c></row>
</sheetData></worksheet>`);
const buf = await zip.generateAsync({ type: 'arraybuffer' });

const texto = await extractSpreadsheetText(buf, 'processo.xlsx');
check('reconhece .xlsx pelo nome e pelo mime', isSpreadsheetFile('a.xlsx') && isSpreadsheetFile('a', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
check('reconhece .xls antigo separadamente', isLegacyExcel('antigo.xls') && !isSpreadsheetFile('antigo.xls'));
check('traz o nome da aba', /Aba: Processo/.test(texto), (texto.match(/Aba: [^\n]*/) || [''])[0]);
check('traz o cabecalho da planilha', /Etapa\tResponsável/.test(texto));
check('resolve textos compartilhados', /Conferência de Notas/.test(texto));
check('mantem numeros', /Conferência de Notas\t15/.test(texto));
check('decodifica entidades XML', /Expedição & Carga/.test(texto));
check('le celulas inline e respeita a coluna', /Expedição & Carga\t\tLogística/.test(texto), JSON.stringify(texto.split('\n').pop()));
check('identifica o arquivo no texto', /\[Conteúdo da planilha processo\.xlsx\]/.test(texto));

console.log(R.join('\n'));
