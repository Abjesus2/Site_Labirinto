import { generateBizagiBpm } from '../.tmp-exportFormats.mjs';
import JSZip from 'jszip';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

// O Bizagi Modeler não abre um .bpmn (BPMN 2.0 XML padrão) como modelo
// nativo — ele usa seu próprio formato .bpm (um zip com XPDL 2.2 dentro de
// outro zip). Este teste gera um .bpm e confere se a estrutura bate com a
// de um arquivo .bpm real salvo pelo próprio Bizagi (usado como referência
// ao construir o exportador).
const nodes = [
  { id: 'n1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Início' } },
  { id: 'n2', type: 'process', position: { x: 300, y: 100 }, data: { label: 'Receber Pedido' } },
  { id: 'n3', type: 'decision', position: { x: 500, y: 100 }, data: { label: 'Aprovado?' } },
  { id: 'n4', type: 'process', position: { x: 700, y: 50 }, data: { label: 'Emitir NF' } },
  { id: 'n5', type: 'end', position: { x: 700, y: 200 }, data: { label: 'Fim' } },
  { id: 'lane1', type: 'swimlane', position: { x: 0, y: 0 }, style: { width: 900, height: 300 }, data: { label: 'Setor' } },
  { id: 'j1', type: 'junction', position: { x: 900, y: 300 }, data: {} },
];
const edges = [
  { id: 'e1', source: 'n1', target: 'n2', data: {} },
  { id: 'e2', source: 'n2', target: 'n3', data: {} },
  { id: 'e3', source: 'n3', target: 'n4', label: 'Sim', data: {} },
  { id: 'e4', source: 'n3', target: 'n5', label: 'Não', data: {} },
  // ponta numa junção — não pode virar Transition (sem Activity correspondente)
  { id: 'e5', source: 'n5', target: 'j1', data: {} },
];

const blob = await generateBizagiBpm(nodes, edges, 'Fluxo de Teste');
check('gera um Blob não vazio', blob instanceof Blob && blob.size > 0, blob.size + ' bytes');

const buf = Buffer.from(await blob.arrayBuffer());
check('assinatura de arquivo ZIP (PK)', buf.subarray(0, 2).toString('ascii') === 'PK');

const outerZip = await JSZip.loadAsync(buf);
const outerNames = Object.keys(outerZip.files);
check('tem o ModelInfo.xml', outerNames.includes('ModelInfo.xml'));
check('tem o Participants.xml', outerNames.includes('Participants.xml'));
check('tem o Preferences.bpp', outerNames.includes('Preferences.bpp'));
check('tem as preferências padrão de usuário', outerNames.includes('Users/Default/UserPreferences.xml'));

const diagEntry = outerNames.find((n) => n.endsWith('.diag'));
check('tem um arquivo .diag (nome de GUID)', !!diagEntry && /^[0-9a-f-]{36}\.diag$/i.test(diagEntry), diagEntry);

const modelInfoXml = await outerZip.file('ModelInfo.xml').async('string');
check('ModelInfo.xml é XPDL/Bizagi (BizAgiModelInfo)', modelInfoXml.includes('<BizAgiModelInfo'));

const diagBuf = await outerZip.file(diagEntry).async('nodebuffer');
check('.diag também é um ZIP (PK) — zip dentro de zip', diagBuf.subarray(0, 2).toString('ascii') === 'PK');

const innerZip = await JSZip.loadAsync(diagBuf);
const innerNames = Object.keys(innerZip.files);
check('.diag tem Diagram.xml, Actions.xml, BPSimData.xml, BPSimDataResult.xml',
  ['Diagram.xml', 'Actions.xml', 'BPSimData.xml', 'BPSimDataResult.xml'].every((n) => innerNames.includes(n)));

const diagramXml = await innerZip.file('Diagram.xml').async('string');
check('Diagram.xml usa o namespace XPDL 2.2 (o dialeto que o Bizagi lê)', diagramXml.includes('http://www.wfmc.org/2009/XPDL2.2'));
check('tem duas Pools (a "principal" oculta + a visível do fluxo)', (diagramXml.match(/<Pool /g) || []).length === 2);
check('início vira StartEvent', /<Event><StartEvent Trigger="None"\s*\/><\/Event>/.test(diagramXml));
check('fim vira EndEvent', /<Event><EndEvent Result="None"\s*\/><\/Event>/.test(diagramXml));
check('decisão vira Route (gateway do Bizagi)', /<Route\s*\/>/.test(diagramXml));
check('processo comum vira Task genérica', /<Implementation><Task\s*\/><\/Implementation>/.test(diagramXml));
check('raia/quadro NÃO vira Activity (só as Pools representam raia)', !diagramXml.includes('Name="Setor"'));
check('junção NÃO vira Activity (IDs são sempre GUIDs novos, nunca os do app)', !diagramXml.includes('"j1"') && !diagramXml.includes('"lane1"'));
check(
  'aresta ligada à junção NÃO gera Transition (evita From/To com Id inexistente)',
  (diagramXml.match(/<Transition /g) || []).length === 4
);
check('rótulo da aresta de decisão vira Name da Transition', /<Transition[^>]*Name="Sim"/.test(diagramXml) && /<Transition[^>]*Name="Não"/.test(diagramXml));

// Cores: mesmos valores ARGB negativos observados num .bpm real exportado
// pelo próprio Bizagi Modeler (StartEvent verde, Route amarelo).
check('início usa a cor verde padrão do Bizagi (FillColor=-1638505)', diagramXml.includes('FillColor="-1638505"'));
check('decisão usa a cor amarela padrão do Bizagi (FillColor=-52)', diagramXml.includes('FillColor="-52"'));

// Bug real visto ao abrir de verdade no Bizagi Modeler: sem TextX/TextY, o
// rótulo da forma saía flutuando ABAIXO dela em vez de dentro — inclusive
// deixando a impressão de "forma sem texto" numa decisão com nome longo.
check(
  'toda forma leva a área do texto explícita (TextX/TextY/TextWidth/TextHeight) — dentro da tarefa, fora de eventos e decisões',
  /<NodeGraphicsInfo[^>]*TextX="\d+"[^>]*TextY="\d+"[^>]*TextWidth="\d+"[^>]*TextHeight="\d+"/.test(diagramXml)
);

// Formas nativas do Bizagi (antes vinham com o tamanho do site: início
// 160x48 virava uma elipse larga e a decisão um losango gigante com o texto
// cortando a forma).
const activities = [...diagramXml.matchAll(/<Activity Id="([^"]+)" Name="([^"]*)">([\s\S]*?)<\/Activity>/g)].map(([, id, name, body]) => {
  const m = /Height="(\d+)" Width="(\d+)" BorderColor="(-?\d+)" FillColor="(-?\d+)"[^>]*TextX="(-?\d+)" TextY="(-?\d+)" TextWidth="(\d+)" TextHeight="(\d+)"><Coordinates XCoordinate="(-?\d+)" YCoordinate="(-?\d+)"/.exec(body);
  return { id, name, h: +m[1], w: +m[2], fill: +m[4], tx: +m[5], ty: +m[6], tw: +m[7], th: +m[8], x: +m[9], y: +m[10] };
});
const act = (name) => activities.find((a) => a.name === name);
const inicio = act('Início');
const fim = act('Fim');
const aprovado = act('Aprovado?');
const pedido = act('Receber Pedido');
check('início é o círculo pequeno do Bizagi (30x30)', inicio.w === 30 && inicio.h === 30, `${inicio.w}x${inicio.h}`);
check('fim é o círculo pequeno do Bizagi (30x30)', fim.w === 30 && fim.h === 30);
check('decisão é o losango pequeno do Bizagi (40x40)', aprovado.w === 40 && aprovado.h === 40, `${aprovado.w}x${aprovado.h}`);
const outside = (a) => a.tx + a.tw <= a.x || a.tx >= a.x + a.w || a.ty + a.th <= a.y || a.ty >= a.y + a.h;
check('texto do início fica FORA do círculo', outside(inicio), JSON.stringify(inicio));
check('texto do fim fica FORA do círculo', outside(fim));
check('texto da decisão fica FORA do losango', outside(aprovado), JSON.stringify(aprovado));
check('texto da tarefa fica DENTRO da tarefa', pedido.tx === pedido.x && pedido.ty === pedido.y && pedido.tw === pedido.w && pedido.th === pedido.h);
check('formas não encostam na coluna do título da pool (x >= 100)', activities.every((a) => a.x >= 100 && a.tx >= 60), String(Math.min(...activities.map((a) => a.x))));

// Setas: sempre em trechos retos (horizontal/vertical), da borda da origem
// até a borda do destino.
const transitions = [...diagramXml.matchAll(/<Transition Id="[^"]+" From="([^"]+)" To="([^"]+)"[^>]*>([\s\S]*?)<\/Transition>/g)].map(([, f, t, body]) => ({
  f, t, from: +/FromPort="(\d)"/.exec(body)[1], to: +/ToPort="(\d)"/.exec(body)[1],
  pts: [...body.matchAll(/XCoordinate="(-?\d+)" YCoordinate="(-?\d+)"/g)].map((m) => ({ x: +m[1], y: +m[2] })),
}));
const byId = new Map(activities.map((a) => [a.id, a]));
const orto = transitions.every((tr) => tr.pts.every((p, i) => i === 0 || p.x === tr.pts[i - 1].x || p.y === tr.pts[i - 1].y));
check('todas as setas só têm trechos horizontais/verticais', orto);
const onBorder = (p, n) => ((Math.abs(p.x - n.x) <= 1 || Math.abs(p.x - n.x - n.w) <= 1) && p.y >= n.y - 1 && p.y <= n.y + n.h + 1) || ((Math.abs(p.y - n.y) <= 1 || Math.abs(p.y - n.y - n.h) <= 1) && p.x >= n.x - 1 && p.x <= n.x + n.w + 1);
check('toda seta começa na borda da origem e termina na borda do destino', transitions.every((tr) => onBorder(tr.pts[0], byId.get(tr.f)) && onBorder(tr.pts[tr.pts.length - 1], byId.get(tr.t))));
const portOk = (p, n, port) => ({ 1: Math.abs(p.y - n.y) <= 1, 2: Math.abs(p.y - n.y - n.h) <= 1, 3: Math.abs(p.x - n.x) <= 1, 4: Math.abs(p.x - n.x - n.w) <= 1 })[port];
check('FromPort/ToPort batem com o lado de onde a seta sai/entra', transitions.every((tr) => portOk(tr.pts[0], byId.get(tr.f), tr.from) && portOk(tr.pts[tr.pts.length - 1], byId.get(tr.t), tr.to)));

// Início -> Receber Pedido estão lado a lado: sai pela direita do círculo,
// na altura do centro dele, e entra pela esquerda da tarefa.
const tIni = transitions.find((tr) => tr.f === inicio.id && tr.t === pedido.id);
check('Início -> Receber Pedido sai pela direita (4) e entra pela esquerda (3)', tIni && tIni.from === 4 && tIni.to === 3);
check('o ponto de partida fica na borda direita do círculo, na altura do centro', tIni && tIni.pts[0].x === inicio.x + inicio.w && tIni.pts[0].y === inicio.y + inicio.h / 2, tIni && JSON.stringify(tIni.pts[0]));

// Cores do site não vão para o Bizagi: sempre as cores padrão dele.
{
  const colorido = nodes.map((n) => (n.id === 'n2' ? { ...n, data: { ...n.data, styleOverride: { backgroundColor: '#ff0000', borderColor: '#00ff00' } } } : n));
  const b2 = await generateBizagiBpm(colorido, edges, 'Cores');
  const z2 = await JSZip.loadAsync(Buffer.from(await b2.arrayBuffer()));
  const d2 = await JSZip.loadAsync(await z2.file(Object.keys(z2.files).find((n) => n.endsWith('.diag'))).async('nodebuffer'));
  const x2 = await d2.file('Diagram.xml').async('string');
  check('tarefa usa a cor padrão do Bizagi mesmo com cor própria no site', !x2.includes('FillColor="-65536"') && x2.includes(`FillColor="${((0xff << 24) | (0xec << 16) | (0xef << 8) | 0xff) | 0}"`));
}

console.log(R.join('\n'));
