import { generateBizagiBpm } from '../.tmp-exportFormats.mjs';
import JSZip from 'jszip';
import { horizontalBandsTB } from '../.tmp-sectorContainers.mjs';

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

// Raias do Bizagi a partir dos setores (campo department ou raia/quadro do site)
{
  const comSetor = [
    { id: 's1', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Início', timing: { department: 'Vendas' } } },
    { id: 's2', type: 'process', position: { x: 280, y: 150 }, data: { label: 'Registrar Pedido', timing: { department: 'Vendas' } } },
    { id: 's3', type: 'process', position: { x: 280, y: 320 }, data: { label: 'Separar Itens', timing: { department: 'Estoque' } } },
    { id: 's4', type: 'process', position: { x: 280, y: 490 }, data: { label: 'Emitir Nota', timing: {} } },
    { id: 's5', type: 'end', position: { x: 300, y: 660 }, data: { label: 'Fim', timing: {} } },
    // s4/s5 sem setor, mas dentro de um quadro "Financeiro" do site
    { id: 'q1', type: 'frame', position: { x: 200, y: 460 }, style: { width: 400, height: 300 }, data: { label: 'Financeiro' } },
  ];
  const ligacoes = [
    { id: 'l1', source: 's1', target: 's2', data: {} },
    { id: 'l2', source: 's2', target: 's3', data: {} },
    { id: 'l3', source: 's3', target: 's4', data: {} },
    { id: 'l4', source: 's4', target: 's5', data: {} },
  ];
  const b3 = await generateBizagiBpm(comSetor, ligacoes, 'Com Raias');
  const z3 = await JSZip.loadAsync(Buffer.from(await b3.arrayBuffer()));
  const d3 = await JSZip.loadAsync(await z3.file(Object.keys(z3.files).find((n) => n.endsWith('.diag'))).async('nodebuffer'));
  const x3 = await d3.file('Diagram.xml').async('string');
  const pools = [...x3.matchAll(/<Pool Id="([^"]+)" Name="([^"]*)"[^>]*>([\s\S]*?)<\/Pool>/g)];
  const visivel = pools.find((p) => p[2] === 'Com Raias');
  const lanes = [...visivel[3].matchAll(/<Lane Id="([^"]+)" Name="([^"]*)" ParentPool="([^"]+)"[\s\S]*?Height="(\d+)" Width="(\d+)"[^>]*><Coordinates XCoordinate="(\d+)" YCoordinate="(\d+)"/g)].map((m) => ({ id: m[1], name: m[2], parent: m[3], h: +m[4], w: +m[5], x: +m[6], y: +m[7] }));
  check('setores viram raias na pool do fluxo (Vendas, Estoque, Financeiro)', lanes.map((l) => l.name).join(',') === 'Vendas,Estoque,Financeiro', lanes.map((l) => l.name).join(','));
  check('raia aponta para a pool dona (ParentPool)', lanes.every((l) => l.parent === visivel[1]));
  check('raias empilhadas sem buraco, a primeira no topo da pool', lanes[0].y === 30 && lanes.every((l, i) => i === 0 || l.y === lanes[i - 1].y + lanes[i - 1].h));
  const poolH = +/<NodeGraphicsInfo[^>]*Height="(\d+)"/.exec(visivel[3].split('</Lanes>')[1])[1];
  check('raias ocupam a pool inteira na altura', lanes[lanes.length - 1].y + lanes[lanes.length - 1].h === 30 + poolH, `${lanes[lanes.length - 1].y + lanes[lanes.length - 1].h} vs ${30 + poolH}`);
  // A raia de cada forma: pelo LaneId e também pela posição (forma inteira
  // dentro da faixa).
  const laneIdOf = (name) => { const m = new RegExp(`<Activity Id="[^"]+" Name="${name}">[\\s\\S]*?LaneId="([^"]+)"`).exec(x3); return m && lanes.find((l) => l.id === m[1])?.name; };
  check('cada forma aponta para a raia do seu setor (LaneId)', laneIdOf('Registrar Pedido') === 'Vendas' && laneIdOf('Separar Itens') === 'Estoque' && laneIdOf('Emitir Nota') === 'Financeiro' && laneIdOf('Fim') === 'Financeiro');
  const shapeBox = (name) => { const m = new RegExp(`<Activity Id="[^"]+" Name="${name}">[\\s\\S]*?Height="(\\d+)" Width="(\\d+)"[^>]*><Coordinates XCoordinate="(-?\\d+)" YCoordinate="(-?\\d+)"`).exec(x3); return m && { h: +m[1], w: +m[2], x: +m[3], y: +m[4] }; };
  const laneOf = (name) => { const b = shapeBox(name); return b && lanes.find((l) => b.y >= l.y && b.y + b.h <= l.y + l.h && b.x >= l.x && b.x + b.w <= l.x + l.w)?.name; };
  check('cada forma fica inteira dentro da raia do seu setor', laneOf('Registrar Pedido') === 'Vendas' && laneOf('Separar Itens') === 'Estoque' && laneOf('Emitir Nota') === 'Financeiro' && laneOf('Fim') === 'Financeiro', ['Registrar Pedido', 'Separar Itens', 'Emitir Nota', 'Fim'].map(laneOf).join(','));
  check('sem setores o arquivo continua sem raias', diagramXml.includes('<Lanes />') && !diagramXml.includes('LaneId='));
}

// Raias VERTICAIS no site (uma coluna por setor, fluxo de cima para baixo):
// no Bizagi viram raias horizontais (desenho girado), uma por setor.
{
  const col = (id, type, x, y, dept) => ({ id, type, position: { x, y }, data: { label: id, timing: { department: dept } } });
  const lane = (label, x) => ({ id: 'L' + label, type: 'swimlane', position: { x, y: -60 }, style: { width: 300, height: 900 }, data: { label, orientation: 'vertical', generatedByAI: true } });
  const nos = [
    lane('Recebimento', -48), lane('Estoque', 252), lane('Financeiro', 552),
    col('Inicio', 'start', 0, 0, 'Recebimento'), col('Conferir', 'process', 0, 150, 'Recebimento'),
    col('Armazenar', 'process', 300, 300, 'Estoque'), col('Conferir Saldo', 'process', 0, 450, 'Recebimento'),
    col('Lancar', 'process', 600, 600, 'Financeiro'), col('Fim', 'end', 600, 750, 'Financeiro'),
  ];
  const lig = [['Inicio', 'Conferir'], ['Conferir', 'Armazenar'], ['Armazenar', 'Conferir Saldo'], ['Conferir Saldo', 'Lancar'], ['Lancar', 'Fim']]
    .map(([a, b], i) => ({ id: 'v' + i, source: a, target: b, data: {} }));
  const bv = await generateBizagiBpm(nos, lig, 'Raias Verticais');
  const zv = await JSZip.loadAsync(Buffer.from(await bv.arrayBuffer()));
  const dv = await JSZip.loadAsync(await zv.file(Object.keys(zv.files).find((n) => n.endsWith('.diag'))).async('nodebuffer'));
  const xv = await dv.file('Diagram.xml').async('string');
  const pv = [...xv.matchAll(/<Pool Id="([^"]+)" Name="([^"]*)"[^>]*>([\s\S]*?)<\/Pool>/g)].find((p) => p[2] === 'Raias Verticais');
  const lv = [...pv[3].matchAll(/<Lane Id="([^"]+)" Name="([^"]*)"[\s\S]*?Height="(\d+)" Width="(\d+)"[^>]*><Coordinates XCoordinate="(\d+)" YCoordinate="(\d+)"/g)].map((m) => ({ id: m[1], name: m[2], h: +m[3], y: +m[6] }));
  check('raias verticais do site: uma raia por setor no Bizagi', lv.map((l) => l.name).sort().join() === 'Estoque,Financeiro,Recebimento', lv.map((l) => l.name).join(','));
  const shape = (name) => { const m = new RegExp(`<Activity Id="[^"]+" Name="${name}">[\\s\\S]*?LaneId="([^"]+)" Height="(\\d+)"[^>]*><Coordinates XCoordinate="(-?\\d+)" YCoordinate="(-?\\d+)"`).exec(xv); return m && { lane: lv.find((l) => l.id === m[1]), h: +m[2], y: +m[4] }; };
  const ok = [['Conferir', 'Recebimento'], ['Armazenar', 'Estoque'], ['Conferir Saldo', 'Recebimento'], ['Lancar', 'Financeiro']].every(([n, d]) => { const s = shape(n); return s && s.lane?.name === d && s.y >= s.lane.y && s.y + s.h <= s.lane.y + s.lane.h; });
  check('cada forma na raia do seu setor e dentro dela', ok);
}

// Quadros do site em GRADE (colunas lado a lado, quadros empilhados em
// algumas colunas) — o "Diagrama Controladora". Antes as faixas por altura
// juntavam setores diferentes ("Recebimento / ZZREPA / Expedição") e as
// formas caíam na raia de outro setor. Agora: uma raia por setor, cada forma
// inteira dentro da raia do SEU setor, setas ortogonais sem cruzar formas.
{
  const F = (id, label, x, y, w, h) => ({ id, type: 'frame', position: { x, y }, style: { width: w, height: h }, data: { label } });
  const N = (id, type, x, y) => ({ id, type, position: { x, y }, data: { label: id } });
  const nos = [
    F('F1', 'Recebimento', 0, 0, 520, 700), F('F2', 'Logística Reversa', 0, 740, 520, 660), F('F3', 'ZZREPA', 560, 0, 700, 1400),
    F('F4', 'Expedição', 1300, 0, 600, 600), F('F5', 'Faturamento', 1300, 640, 600, 760),
    N('ini', 'start', 180, 70), N('a1', 'process', 160, 170), N('d1', 'decision', 155, 410), N('a2', 'process', 330, 560), N('a3', 'process', 60, 560),
    N('b1', 'process', 160, 800), N('b2', 'process', 160, 930),
    N('c1', 'process', 820, 80), N('c2', 'process', 820, 360), N('d3', 'decision', 815, 500), N('c3', 'process', 620, 680), N('c4', 'process', 1000, 680), N('c5', 'process', 820, 900),
    N('f1', 'process', 1520, 80), N('f2', 'process', 1520, 220),
    N('g1', 'process', 1520, 720), N('d5', 'decision', 1515, 1030), N('fim', 'end', 1540, 1260),
  ];
  const setor = { ini: 'Recebimento', a1: 'Recebimento', d1: 'Recebimento', a2: 'Recebimento', a3: 'Recebimento', b1: 'Logística Reversa', b2: 'Logística Reversa',
    c1: 'ZZREPA', c2: 'ZZREPA', d3: 'ZZREPA', c3: 'ZZREPA', c4: 'ZZREPA', c5: 'ZZREPA', f1: 'Expedição', f2: 'Expedição', g1: 'Faturamento', d5: 'Faturamento', fim: 'Faturamento' };
  const lig = [['ini', 'a1'], ['a1', 'd1'], ['d1', 'a2', 'Sim'], ['d1', 'a3', 'Não'], ['a2', 'b1'], ['a3', 'b1'], ['b1', 'b2'], ['b2', 'c1'], ['c1', 'c2'], ['c2', 'd3'],
    ['d3', 'c3', 'Não'], ['d3', 'c4', 'Sim'], ['c3', 'c5'], ['c4', 'c5'], ['c5', 'f1'], ['f1', 'f2'], ['f2', 'g1'], ['g1', 'd5'], ['d5', 'fim', 'Não'], ['d5', 'c2', 'Sim']]
    .map(([a, b, l], i) => ({ id: 'q' + i, source: a, target: b, label: l, data: {} }));
  const bq = await generateBizagiBpm(nos, lig, 'Grade');
  const zq = await JSZip.loadAsync(Buffer.from(await bq.arrayBuffer()));
  const dq = await JSZip.loadAsync(await zq.file(Object.keys(zq.files).find((n) => n.endsWith('.diag'))).async('nodebuffer'));
  const xq = await dq.file('Diagram.xml').async('string');
  const pq = [...xq.matchAll(/<Pool Id="([^"]+)" Name="([^"]*)"[^>]*>([\s\S]*?)<\/Pool>/g)].find((p) => p[2] === 'Grade');
  const lq = [...pq[3].matchAll(/<Lane Id="([^"]+)" Name="([^"]*)"[\s\S]*?Height="(\d+)" Width="(\d+)"[^>]*><Coordinates XCoordinate="(\d+)" YCoordinate="(\d+)"/g)].map((m) => ({ id: m[1], name: m[2], h: +m[3], w: +m[4], x: +m[5], y: +m[6] }));
  check('quadros em grade: uma raia por setor, nenhuma com setores juntados', lq.length === 5 && lq.every((l) => !l.name.includes(' / ')), lq.map((l) => l.name).join(' | '));
  check('quadros em grade: raias na ordem em que o fluxo passa pelos setores', lq.map((l) => l.name).join() === 'Recebimento,Logística Reversa,ZZREPA,Expedição,Faturamento', lq.map((l) => l.name).join());
  check('quadros em grade: raias encostadas, sem buraco', lq.every((l, i) => i === 0 || l.y === lq[i - 1].y + lq[i - 1].h));
  const acts = [...xq.matchAll(/<Activity Id="([^"]+)" Name="([^"]*)">[\s\S]*?LaneId="([^"]+)" Height="(\d+)" Width="(\d+)"[^>]*TextY="(-?\d+)"[^>]*TextHeight="(\d+)"[^>]*><Coordinates XCoordinate="(-?\d+)" YCoordinate="(-?\d+)"/g)]
    .map((m) => ({ id: m[1], name: m[2], lane: lq.find((l) => l.id === m[3]), h: +m[4], w: +m[5], ty: +m[6], th: +m[7], x: +m[8], y: +m[9] }));
  check('quadros em grade: toda forma aponta para a raia do SEU setor', acts.length === Object.keys(setor).length && acts.every((a) => a.lane?.name === setor[a.name]), acts.filter((a) => a.lane?.name !== setor[a.name]).map((a) => `${a.name}→${a.lane?.name}`).join(', '));
  check('quadros em grade: forma e texto inteiros dentro da faixa da raia', acts.every((a) => a.y >= a.lane.y && a.y + a.h <= a.lane.y + a.lane.h && a.ty >= a.lane.y && a.ty + a.th <= a.lane.y + a.lane.h));
  const byId = new Map(acts.map((a) => [a.id, a]));
  const trq = [...xq.matchAll(/<Transition Id="[^"]+" From="([^"]+)" To="([^"]+)"[^>]*>([\s\S]*?)<\/Transition>/g)].map((t) => ({ f: t[1], t: t[2], pts: [...t[3].matchAll(/XCoordinate="(-?\d+)" YCoordinate="(-?\d+)"/g)].map((m) => ({ x: +m[1], y: +m[2] })) }));
  check('quadros em grade: todas as setas exportadas', trq.length === lig.length);
  check('quadros em grade: setas só com trechos horizontais/verticais', trq.every((t) => t.pts.every((p, i) => i === 0 || p.x === t.pts[i - 1].x || p.y === t.pts[i - 1].y)));
  const corta = (p, q, b) => Math.min(p.x, q.x) < b.x + b.w - 1 && Math.max(p.x, q.x) > b.x + 1 && Math.min(p.y, q.y) < b.y + b.h - 1 && Math.max(p.y, q.y) > b.y + 1;
  check('quadros em grade: nenhuma seta atravessa outra forma', trq.every((t) => t.pts.every((p, i) => i === 0 || acts.every((a) => a.id === t.f || a.id === t.t || !corta(t.pts[i - 1], p, a)))));
  // A disposição DENTRO de cada quadro não muda (só o quadro inteiro se move).
  const dentro = byId && acts.find((a) => a.name === 'c3') && acts.find((a) => a.name === 'c4');
  const c3 = acts.find((a) => a.name === 'c3'), c4 = acts.find((a) => a.name === 'c4');
  check('quadros em grade: formas do mesmo quadro mantêm a posição relativa', !!dentro && c4.x + c4.w / 2 - (c3.x + c3.w / 2) === 380 && c4.y === c3.y);
}

// Todos os setores lado a lado (setor pelo campo "department", sem quadros):
// antes viravam uma faixa só juntada e o arquivo saía SEM raia nenhuma.
{
  const N = (id, type, x, y, d) => ({ id, type, position: { x, y }, data: { label: id, timing: { department: d } } });
  const nos = [N('i', 'start', 40, 0, 'Vendas'), N('v1', 'process', 0, 150, 'Vendas'), N('e1', 'process', 400, 150, 'Estoque'), N('v2', 'process', 0, 320, 'Vendas'), N('e2', 'process', 400, 320, 'Estoque'), N('f', 'end', 440, 500, 'Estoque')];
  const lig = [['i', 'v1'], ['v1', 'e1'], ['e1', 'v2'], ['v2', 'e2'], ['e2', 'f']].map(([a, b], i) => ({ id: 'w' + i, source: a, target: b, data: {} }));
  const bw = await generateBizagiBpm(nos, lig, 'Lado a Lado');
  const zw = await JSZip.loadAsync(Buffer.from(await bw.arrayBuffer()));
  const dw = await JSZip.loadAsync(await zw.file(Object.keys(zw.files).find((n) => n.endsWith('.diag'))).async('nodebuffer'));
  const xw = await dw.file('Diagram.xml').async('string');
  const lw = [...xw.matchAll(/<Lane Id="([^"]+)" Name="([^"]*)"/g)].map((m) => ({ id: m[1], name: m[2] }));
  check('setores lado a lado em toda a altura: uma raia por setor (não some)', lw.map((l) => l.name).join() === 'Vendas,Estoque', lw.map((l) => l.name).join());
  const laneOf = (name) => { const m = new RegExp(`<Activity Id="[^"]+" Name="${name}">[\\s\\S]*?LaneId="([^"]+)"`).exec(xw); return m && lw.find((l) => l.id === m[1])?.name; };
  check('setores lado a lado em toda a altura: cada forma na raia do seu setor', ['i', 'v1', 'v2'].every((n) => laneOf(n) === 'Vendas') && ['e1', 'e2', 'f'].every((n) => laneOf(n) === 'Estoque'));
}

// Achados da revisão do "uma raia por setor" (exportação completa).
{
  const lerBpm = async (blob, titulo) => {
    const z = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    const d = await JSZip.loadAsync(await z.file(Object.keys(z.files).find((n) => n.endsWith('.diag'))).async('nodebuffer'));
    const x = await d.file('Diagram.xml').async('string');
    const pool = [...x.matchAll(/<Pool Id="([^"]+)" Name="([^"]*)"[^>]*>([\s\S]*?)<\/Pool>/g)].find((p) => p[2] === titulo);
    const lanes = [...pool[3].matchAll(/<Lane Id="([^"]+)" Name="([^"]*)"[\s\S]*?Height="(\d+)" Width="(\d+)"[^>]*><Coordinates XCoordinate="(\d+)" YCoordinate="(\d+)"/g)].map((m) => ({ id: m[1], name: m[2], h: +m[3], y: +m[6] }));
    const acts = new Map([...x.matchAll(/<Activity Id="([^"]+)" Name="([^"]*)">([\s\S]*?)<\/Activity>/g)].map((a) => {
      const g = /(?:LaneId="([^"]+)" )?Height="(\d+)" Width="(\d+)"[^>]*><Coordinates XCoordinate="(-?\d+)" YCoordinate="(-?\d+)"/.exec(a[3]);
      return [a[2], { id: a[1], lane: lanes.find((l) => l.id === g[1])?.name, h: +g[2], w: +g[3], x: +g[4], y: +g[5] }];
    }));
    const trans = [...x.matchAll(/<Transition Id="[^"]+" From="([^"]+)" To="([^"]+)"[^>]*>[\s\S]*?FromPort="(\d)" ToPort="(\d)"/g)].map((t) => ({ from: t[1], to: t[2], ports: t[3] + '>' + t[4] }));
    return { lanes, acts, trans };
  };
  const F = (id, label, x, y, w, h, type = 'frame') => ({ id, type, position: { x, y }, style: { width: w, height: h }, data: { label } });
  const N = (id, type, x, y, dept) => ({ id, type, position: { x, y }, data: { label: id, ...(dept ? { timing: { department: dept } } : {}) } });
  const E = (pares) => pares.map(([a, b, l], i) => ({ id: 'r' + i, source: a, target: b, label: l, data: {} }));

  // Raias horizontais montadas pelo próprio app (fluxo de cima para baixo):
  // uma decisão abre ramos para dois setores na mesma altura. O Bizagi
  // continua igual ao site — antes do ajuste tudo era reorganizado.
  {
    const base = [N('Inicio', 'start', 325, 0, 'Comercial'), N('Receber', 'process', 300, 120, 'Comercial'), N('Analisar', 'process', 300, 240, 'Financeiro'),
      N('Ok?', 'decision', 295, 360, 'Financeiro'), N('Negociar', 'process', 120, 540, 'Comercial'), N('Liberar', 'process', 480, 540, 'Financeiro'),
      N('Separar', 'process', 300, 680, 'Logística'), N('Expedir', 'process', 300, 800, 'Logística'), N('Fim', 'end', 325, 920, 'Logística')];
    const nos = horizontalBandsTB(base);
    const lig = E([['Inicio', 'Receber'], ['Receber', 'Analisar'], ['Analisar', 'Ok?'], ['Ok?', 'Negociar', 'Não'], ['Ok?', 'Liberar', 'Sim'], ['Negociar', 'Separar'], ['Liberar', 'Separar'], ['Separar', 'Expedir'], ['Expedir', 'Fim']]);
    const r = await lerBpm(await generateBizagiBpm(nos, lig, 'Faixas'), 'Faixas');
    const ordem = ['Inicio', 'Receber', 'Analisar', 'Ok?', 'Negociar', 'Separar', 'Expedir', 'Fim'].map((n) => r.acts.get(n).y);
    check('raias horizontais do app: o Bizagi segue a mesma disposição do site (não reorganiza)', ordem.every((y, i) => i === 0 || y > ordem[i - 1]) && r.acts.get('Negociar').y === r.acts.get('Liberar').y && r.lanes.some((l) => l.name.includes(' / ')), r.lanes.map((l) => l.name).join(' | '));
  }

  // Quadros em colunas com o fluxo descendo em cada um: continua de cima
  // para baixo no Bizagi (sem escada nem setas para o lado).
  {
    const setores = ['Solicitante', 'Compras', 'Fiscal'];
    const nos = [];
    const pares = [];
    let ant = 'ini';
    nos.push(N('ini', 'start', 180, 60));
    setores.forEach((st, i) => {
      nos.push(F('C' + i, st, i * 560, 0, 520, 700), N(st + ' 1', 'process', i * 560 + 150, 160), N(st + ' 2', 'process', i * 560 + 150, 460));
      pares.push([ant, st + ' 1'], [st + ' 1', st + ' 2']);
      ant = st + ' 2';
    });
    nos.push(N('fim', 'end', 2 * 560 + 180, 600));
    pares.push([ant, 'fim']);
    const r = await lerBpm(await generateBizagiBpm(nos, E(pares), 'Colunas'), 'Colunas');
    check('quadros em colunas com fluxo descendo: uma raia por setor', r.lanes.map((l) => l.name).join() === setores.join(), r.lanes.map((l) => l.name).join());
    check('quadros em colunas com fluxo descendo: toda seta sai por baixo e entra por cima', r.trans.every((t) => t.ports === '2>1'), r.trans.map((t) => t.ports).join(' '));
    const xs = setores.map((st) => r.acts.get(st + ' 1').x);
    check('quadros em colunas com fluxo descendo: raias sem escada', xs.every((x) => x === xs[0]), xs.join(','));
  }

  // Quadro SEM nome dentro de uma raia com nome: a forma fica no setor da raia.
  {
    const nos = [F('swA', 'A', 0, 0, 500, 700, 'swimlane'), F('swB', 'B', 550, 0, 500, 700, 'swimlane'), F('grp', '', 40, 250, 420, 300),
      N('i', 'start', 710, 60), N('b1', 'process', 670, 160), N('a1', 'process', 170, 300), N('a2', 'process', 170, 440), N('b2', 'process', 670, 450), N('f', 'end', 710, 600)];
    const r = await lerBpm(await generateBizagiBpm(nos, E([['i', 'b1'], ['b1', 'a1'], ['a1', 'a2'], ['a2', 'b2'], ['b2', 'f']]), 'Agrupador'), 'Agrupador');
    check('quadro sem nome não apaga o setor da raia em volta', r.acts.get('a1').lane === 'A' && r.acts.get('a2').lane === 'A' && r.acts.get('b1').lane === 'B', r.lanes.map((l) => l.name).join());
  }

  // Mesmo setor escrito de jeitos diferentes: uma raia só.
  {
    const nos = [F('qv', 'Vendas', 0, 0, 400, 500), F('qe', 'Estoque', 450, 0, 400, 500),
      N('i', 'start', 160, 60), N('v1', 'process', 120, 200, 'vendas '), N('v2', 'process', 120, 350, 'VENDAS'), N('e1', 'process', 570, 200), N('f', 'end', 610, 400)];
    const r = await lerBpm(await generateBizagiBpm(nos, E([['i', 'v1'], ['v1', 'v2'], ['v2', 'e1'], ['e1', 'f']]), 'Nomes'), 'Nomes');
    check('setor com maiúsculas/espaços diferentes: uma raia por setor', r.lanes.map((l) => l.name).join() === 'Vendas,Estoque', r.lanes.map((l) => l.name).join());
  }

  // Quadro "A" dentro da raia "A": o bloco é a raia inteira (a distância
  // entre as formas não muda).
  {
    const nos = [F('swA', 'A', 0, 0, 1000, 600, 'swimlane'), F('fA', 'A', 500, 50, 450, 500), F('swB', 'B', 1050, 0, 500, 600, 'swimlane'),
      N('i', 'start', 160, 60), N('a1', 'process', 120, 200), N('a2', 'process', 650, 200), N('b1', 'process', 1170, 200), N('f', 'end', 1210, 450)];
    const r = await lerBpm(await generateBizagiBpm(nos, E([['i', 'a1'], ['a1', 'a2'], ['a2', 'b1'], ['b1', 'f']]), 'Aninhado'), 'Aninhado');
    check('quadro dentro de raia do mesmo setor: formas mantêm a distância', r.acts.get('a2').x - r.acts.get('a1').x === 530 && r.acts.get('a2').y === r.acts.get('a1').y, String(r.acts.get('a2').x - r.acts.get('a1').x));
  }
}

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
