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
  'toda forma leva TextX/TextY/TextWidth/TextHeight (rótulo fica dentro da forma, não flutuando fora)',
  /<NodeGraphicsInfo[^>]*TextX="\d+"[^>]*TextY="\d+"[^>]*TextWidth="\d+"[^>]*TextHeight="\d+"/.test(diagramXml)
);

// Outro bug real: sem FromPort/ToPort e com o waypoint inicial/final no
// CENTRO da forma (em vez da borda), o Bizagi não recorta a linha —
// formas alinhadas na mesma coluna viravam uma única linha reta
// atravessando por dentro de todas elas. Confere que a Transition
// Início -> Receber Pedido sai da BORDA direita de "Início" (n1 é mais
// estreito e fica à esquerda de n2), não do centro dele.
const activityId = (name) => {
  const m = new RegExp(`<Activity Id="([0-9a-f-]+)" Name="${name}"`, 'i').exec(diagramXml);
  return m ? m[1] : null;
};
const inicioId = activityId('Início');
const pedidoId = activityId('Receber Pedido');
check('achou os IDs gerados das activities "Início" e "Receber Pedido"', !!inicioId && !!pedidoId);

const transRegex = new RegExp(`<Transition Id="[0-9a-f-]+" From="${inicioId}" To="${pedidoId}"[^>]*>([\\s\\S]*?)</Transition>`);
const transMatch = transRegex.exec(diagramXml);
check('achou a Transition Início -> Receber Pedido', !!transMatch);
if (transMatch) {
  check('a Transition leva FromPort e ToPort (o Bizagi não recorta a linha na borda sem isso)', /FromPort="4"/.test(transMatch[0]) && /ToPort="3"/.test(transMatch[0]));
  const coordMatches = [...transMatch[1].matchAll(/<Coordinates XCoordinate="(\d+)" YCoordinate="(\d+)"/g)];
  check('a Transition tem pelo menos 2 pontos (início e fim)', coordMatches.length >= 2);
  if (coordMatches.length >= 2) {
    const firstX = Number(coordMatches[0][1]);
    const firstY = Number(coordMatches[0][2]);
    // Nas posições do fixture (n1 start em x:100,y:100,160x48; n2 process
    // em x:300,y:100,210x60; deslocados pro espaço do Bizagi com margem
    // 50 a partir do (minX,minY) global de todos os nós), "Início" fica em
    // x:[50,210] y:[100,148] — como "Receber Pedido" está à direita dele, a
    // linha tem de sair exatamente da borda direita (x=210, y=124 =
    // centro vertical), não do centro da forma (que seria x=130).
    check('o ponto de partida da linha fica na borda direita de "Início" (x=210), não no centro (x=130)', firstX === 210, 'firstX=' + firstX);
    check('o ponto de partida fica no centro vertical de "Início" (y=124)', firstY === 124, 'firstY=' + firstY);
  }
}

console.log(R.join('\n'));
