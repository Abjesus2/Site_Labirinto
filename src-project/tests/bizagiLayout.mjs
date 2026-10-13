import { computeBizagiGeometry, computeBizagiLanes, stackSectorsIntoLanes, computeLanesFromGroups, sectorKey } from '../.tmp-bizagiLayout.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const box = (x, y, w = 200, h = 60) => ({ x, y, width: w, height: h });
const hit = (a, b, n, pad = 1) =>
  Math.min(a.x, b.x) < n.x + n.width - pad && Math.max(a.x, b.x) > n.x + pad && Math.min(a.y, b.y) < n.y + n.height - pad && Math.max(a.y, b.y) > n.y + pad;
const crossings = (g) => {
  let c = 0;
  for (const e of g.edges) for (let i = 0; i < e.points.length - 1; i++) for (const n of g.nodes.values()) if (n.id !== e.source && n.id !== e.target && hit(e.points[i], e.points[i + 1], n.box)) c++;
  return c;
};
const orthogonal = (g) => g.edges.every((e) => e.points.every((p, i) => i === 0 || p.x === e.points[i - 1].x || p.y === e.points[i - 1].y));

// Fluxo vertical com decisão (dois ramos), volta ("Não" -> etapa anterior)
// e uma seta longa que passaria por dentro de outras formas.
const nodes = [
  { id: 'ini', type: 'start', box: box(300, 0, 160, 48) },
  { id: 'a', type: 'process', box: box(280, 150) },
  { id: 'b', type: 'process', box: box(280, 300) },
  { id: 'dec', type: 'decision', box: box(275, 450, 210, 110) },
  { id: 'sim', type: 'process', box: box(100, 650) },
  { id: 'nao', type: 'process', box: box(460, 650) },
  { id: 'c', type: 'process', box: box(100, 800) },
  { id: 'fim', type: 'end', box: box(300, 1000, 160, 48) },
];
const edges = [
  { id: 'e1', source: 'ini', target: 'a' },
  { id: 'e2', source: 'a', target: 'b' },
  { id: 'e3', source: 'b', target: 'dec' },
  { id: 'e4', source: 'dec', target: 'sim', label: 'Sim' },
  { id: 'e5', source: 'dec', target: 'nao', label: 'Não' },
  { id: 'e6', source: 'nao', target: 'a', label: 'Refazer' }, // volta para cima
  { id: 'e7', source: 'sim', target: 'c' },
  { id: 'e8', source: 'c', target: 'fim' },
  { id: 'e9', source: 'ini', target: 'fim' }, // longa, atravessaria tudo em linha reta
];
const g = computeBizagiGeometry(nodes, edges);
const E = (id) => g.edges.find((e) => e.id === id);

check('direção detectada: de cima para baixo', g.direction === 'TB');
check('eventos com 30x30 e decisão com 40x40, mantendo o centro do site', g.nodes.get('ini').box.width === 30 && g.nodes.get('dec').box.width === 40 && g.nodes.get('dec').box.x + 20 === 275 + 105 && g.nodes.get('ini').box.y + 15 === 24);
check('nenhuma seta atravessa outra forma', crossings(g) === 0, String(crossings(g)));
check('todas as setas só com trechos horizontais/verticais', orthogonal(g));
check('seta para baixo sai pela base (2) e entra pelo topo (1)', E('e2').fromPort === 2 && E('e2').toPort === 1 && E('e2').points.length === 2);
check('os dois ramos da decisão saem do vértice de baixo', E('e4').fromPort === 2 && E('e5').fromPort === 2 && E('e4').points[0].y === g.nodes.get('dec').box.y + 40);
{
  const pts = E('e4').points;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const c = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  // 1 px de tolerância: as coordenadas do arquivo são inteiras.
  const onLine = pts.some((p, i) => i > 0 && Math.min(p.y, pts[i - 1].y) - 1 <= c.y && Math.max(p.y, pts[i - 1].y) + 1 >= c.y && Math.min(p.x, pts[i - 1].x) - 1 <= c.x && Math.max(p.x, pts[i - 1].x) + 1 >= c.x);
  check('texto "Sim" (centro da caixa da seta, onde o Bizagi escreve) cai em cima da própria seta', onLine, JSON.stringify(c));
}
check('volta para cima usa corredor lateral (sai e entra pelo mesmo lado)', [3, 4].includes(E('e6').fromPort) && E('e6').fromPort === E('e6').toPort);
check('seta longa desvia pelas laterais em vez de cruzar as formas', E('e9').points.length > 2);
const lab = g.nodes.get('dec').labelBox, db = g.nodes.get('dec').box;
check('texto da decisão fica fora do losango', lab.x + lab.width <= db.x || lab.x >= db.x + db.width || lab.y + lab.height <= db.y || lab.y >= db.y + db.height);
const il = g.nodes.get('ini').labelBox, ib = g.nodes.get('ini').box;
check('texto do início fica fora do círculo', il.x + il.width <= ib.x || il.x >= ib.x + ib.width || il.y + il.height <= ib.y || il.y >= ib.y + ib.height);

// Fluxo horizontal (esquerda -> direita): a mesma lógica, girada.
const hn = [
  { id: 's', type: 'start', box: box(0, 100, 160, 48) },
  { id: 'p', type: 'process', box: box(250, 94) },
  { id: 'q', type: 'process', box: box(550, 94) },
  { id: 'f', type: 'end', box: box(850, 100, 160, 48) },
];
const he = [
  { id: 'h1', source: 's', target: 'p' },
  { id: 'h2', source: 'p', target: 'q' },
  { id: 'h3', source: 'q', target: 'f' },
  { id: 'h4', source: 'q', target: 'p', label: 'Não' },
];
const hg = computeBizagiGeometry(hn, he);
const H = (id) => hg.edges.find((e) => e.id === id);
check('direção detectada: esquerda para direita', hg.direction === 'LR');
check('no horizontal a seta sai pela direita (4) e entra pela esquerda (3)', H('h2').fromPort === 4 && H('h2').toPort === 3);
check('no horizontal a volta usa corredor por cima/baixo e não cruza formas', [1, 2].includes(H('h4').fromPort) && crossings(hg) === 0);
check('no horizontal todas as setas são retas/ortogonais', orthogonal(hg));

// Uma única seta diagonal (decisão -> ramo bem aberto) continua sendo
// tratada como fluxo vertical, saindo pela base.
{
  const one = computeBizagiGeometry(
    [{ id: 'd', type: 'decision', box: box(275, 450, 210, 110) }, { id: 't', type: 'process', box: box(100, 650) }],
    [{ id: 'x', source: 'd', target: 't', label: 'Sim' }],
  );
  check('seta única e diagonal de decisão continua vertical (sai pela base)', one.direction === 'TB' && one.edges[0].fromPort === 2 && one.edges[0].points.length <= 4, JSON.stringify(one.edges[0].points));
}

// Seta ligada a algo que não existe (raia/junção) é descartada.
const g2 = computeBizagiGeometry(nodes, [...edges, { id: 'x', source: 'a', target: 'nao_existe' }]);
check('seta para forma inexistente é descartada', g2.edges.length === edges.length);

// Raias: setores em sequência viram faixas horizontais empilhadas.
{
  const dept = new Map([['ini', 'Recebimento'], ['a', 'Recebimento'], ['b', 'Recebimento'], ['dec', 'Recebimento'], ['sim', 'Estoque'], ['nao', 'Estoque'], ['c', 'Estoque'], ['fim', '']]);
  const lanes = computeBizagiLanes(g, dept);
  check('dois setores em sequência viram duas raias, na ordem', lanes.length === 2 && lanes[0].name === 'Recebimento' && lanes[1].name === 'Estoque', lanes.map((l) => l.name).join(', '));
  check('raias encostadas uma na outra (sem buraco nem sobreposição)', lanes.length === 2 && lanes[0].y2 === lanes[1].y1);
  check('cada forma dentro da faixa da sua raia', lanes.every((l) => l.nodeIds.every((id) => { const b = g.nodes.get(id).box; return b.y >= l.y1 && b.y + b.height <= l.y2; })));
  check('forma sem setor (fim) acompanha a faixa em que está', lanes[1].nodeIds.includes('fim'));
  const hys = g.edges.flatMap((e) => e.points.slice(1).map((p, i) => (p.y === e.points[i].y ? p.y : null)).filter((v) => v !== null));
  check("divisa entre raias não fica em cima de trecho horizontal de seta", hys.every((y) => Math.abs(y - lanes[0].y2) > 14));
}
{
  // Setores diferentes lado a lado na mesma altura: a faixa leva os dois nomes.
  const dept = new Map([['ini', 'A'], ['a', 'A'], ['b', 'A'], ['dec', 'A'], ['sim', 'B'], ['nao', 'C'], ['c', 'B'], ['fim', 'B']]);
  const lanes = computeBizagiLanes(g, dept);
  // Só a função de faixas: com quadros de setores lado a lado o export troca
  // esse caso por uma raia por setor (stackSectorsIntoLanes; ver o teste de
  // quadros em grade em bizagiBpm.mjs).
  check('setores lado a lado na mesma altura dividem uma faixa com os dois nomes', lanes.some((l) => l.name === 'B / C' || l.name === 'C / B'), lanes.map((l) => l.name).join(' | '));
}
check('um setor só: sem raias', computeBizagiLanes(g, new Map([...g.nodes.keys()].map((id) => [id, 'Único']))).length === 0);
// Só a função de faixas; o export, com 2+ setores, usa stackSectorsIntoLanes.
check('fluxo horizontal: sem raias (evita arquivo que o Bizagi não represente)', computeBizagiLanes(hg, new Map([['s', 'A'], ['p', 'A'], ['q', 'B'], ['f', 'B']])).length === 0);


// Setores lado a lado → uma raia por setor (stackSectorsIntoLanes)
{
  const box = (x, y, w = 160, h = 60) => ({ x, y, width: w, height: h });
  const nodes = [
    { id: 'i', box: box(20, 20, 30, 30), sector: '', holderId: 'qa' },
    { id: 'a1', box: box(0, 100), sector: 'A', holderId: 'qa' },
    { id: 'b1', box: box(400, 100), sector: 'B', holderId: 'qb' },
    { id: 'a2', box: box(800, 100), sector: 'A', holderId: 'qa2' },
    { id: 'solta', box: box(400, 600), sector: '' },
  ];
  const containers = [
    { id: 'qa', label: 'A', box: box(-40, -40, 300, 300) },
    { id: 'qb', label: 'B', box: box(360, -40, 300, 300) },
    { id: 'qa2', label: 'A', box: box(760, -40, 300, 300) },
  ];
  const edges = [{ source: 'i', target: 'a1' }, { source: 'a1', target: 'b1' }, { source: 'b1', target: 'solta' }, { source: 'solta', target: 'a2' }];
  const st = stackSectorsIntoLanes(nodes, containers, edges);
  check('um grupo por setor, na ordem do fluxo', st.groups.map((g) => g.name).join() === 'A,B', st.groups.map((g) => g.name).join());
  check('forma sem setor vai para o setor da forma ligada mais próxima (antes no fluxo)', st.groups[0].nodeIds.includes('i') && st.groups[1].nodeIds.includes('solta'));
  // Bloco = só o conteúdo do quadro (sem a área vazia); blocos da mesma raia
  // alinhados pelo topo do conteúdo.
  check('dois quadros do mesmo setor ficam lado a lado na mesma raia', st.groups[0].nodeIds.includes('a1') && st.groups[0].nodeIds.includes('a2') && st.boxes.get('a2').x > st.boxes.get('a1').x + 160 && st.boxes.get('a2').y === st.boxes.get('i').y);
  check('posição relativa dentro do quadro mantida', st.boxes.get('a1').x - st.boxes.get('i').x === -20 && st.boxes.get('a1').y - st.boxes.get('i').y === 80);
  check('raia seguinte começa abaixo da anterior', Math.min(...st.groups[1].nodeIds.map((id) => st.boxes.get(id).y)) > Math.max(...st.groups[0].nodeIds.map((id) => st.boxes.get(id).y + st.boxes.get(id).height)));
  const g = computeBizagiGeometry(nodes.map((n) => ({ id: n.id, type: n.id === 'i' ? 'start' : 'process', box: st.boxes.get(n.id) })), edges.map((e, k) => ({ id: 'z' + k, ...e })));
  const lanes = computeLanesFromGroups(g, st.groups);
  check('raias dos grupos: uma por setor, encostadas, cada forma dentro da sua', lanes.length === 2 && lanes[0].y2 === lanes[1].y1 && lanes.every((l) => l.sectors.length === 1 && l.nodeIds.every((id) => { const b = g.nodes.get(id).box; return b.y >= l.y1 && b.y + b.height <= l.y2; })));
}

// Achados da revisão do empilhamento por setor
{
  const box = (x, y, w = 160, h = 60) => ({ x, y, width: w, height: h });
  const q = (id, label, x, y = -40, w = 300, h = 400) => ({ id, label, box: box(x, y, w, h) });
  const top = (st, ids) => Math.min(...ids.map((id) => st.boxes.get(id).y));
  const cxOf = (st, id) => st.boxes.get(id).x + st.boxes.get(id).width / 2;

  // Nomes que só diferem em maiúsculas/espaços são o mesmo setor.
  check('sectorKey ignora maiúsculas e espaços', sectorKey('  Logística   Reversa ') === sectorKey('logística reversa'));
  const s1 = stackSectorsIntoLanes(
    [{ id: 'v1', box: box(0, 0), sector: 'Vendas', holderId: 'qv' }, { id: 'e1', box: box(400, 0), sector: 'Estoque', holderId: 'qe' }, { id: 'v2', box: box(800, 0), sector: ' vendas ', holderId: 'qv2' }],
    [q('qv', 'Vendas', -40), q('qe', 'Estoque', 360), q('qv2', ' vendas ', 760)],
    [{ source: 'v1', target: 'e1' }, { source: 'e1', target: 'v2' }],
  );
  check('mesmo setor escrito diferente: uma raia só, com o primeiro nome', s1.groups.map((g) => g.name).join() === 'Vendas,Estoque', s1.groups.map((g) => g.name).join());

  // Anotação ligada a uma forma (sem vir do início) não puxa o setor dela
  // para o começo.
  const s2 = stackSectorsIntoLanes(
    [{ id: 's', type: 'start', box: box(0, 0, 30, 30), sector: 'A', holderId: 'qa' }, { id: 'a1', box: box(0, 100), sector: 'A', holderId: 'qa' },
      { id: 'b1', box: box(400, 100), sector: 'B', holderId: 'qb' }, { id: 'c1', box: box(800, 100), sector: 'C', holderId: 'qc' }, { id: 'nota', type: 'note', box: box(800, 250), sector: 'C', holderId: 'qc' }],
    [q('qa', 'A', -40), q('qb', 'B', 360), q('qc', 'C', 760)],
    [{ source: 's', target: 'a1' }, { source: 'a1', target: 'b1' }, { source: 'b1', target: 'c1' }, { source: 'nota', target: 'c1' }],
  );
  check('anotação com seta não muda a ordem das raias', s2.groups.map((g) => g.name).join() === 'A,B,C', s2.groups.map((g) => g.name).join());

  // Quadros em colunas com o fluxo DESCENDO dentro de cada um: as setas entre
  // colunas não transformam o fluxo em "esquerda para a direita" (escada).
  const colNodes = [];
  const colEdges = [];
  ['A', 'B', 'C'].forEach((k, i) => {
    colNodes.push({ id: k + '1', box: box(i * 560 + 150, 160), sector: k, holderId: 'q' + k }, { id: k + '2', box: box(i * 560 + 150, 460), sector: k, holderId: 'q' + k });
    colEdges.push({ source: k + '1', target: k + '2' });
    if (i) colEdges.push({ source: ['A', 'B', 'C'][i - 1] + '2', target: k + '1' });
  });
  const s3 = stackSectorsIntoLanes(colNodes, ['A', 'B', 'C'].map((k, i) => q('q' + k, k, i * 560, 0, 520, 600)), colEdges, 'LR');
  check('colunas com fluxo descendo: direção de cima para baixo', s3.direction === 'TB', s3.direction);
  check('colunas com fluxo descendo: raias sem escada (mesma coluna)', cxOf(s3, 'A1') === cxOf(s3, 'B1') && cxOf(s3, 'B1') === cxOf(s3, 'C1'));

  // Fluxo da esquerda para a direita dentro dos quadros: escada.
  const s4 = stackSectorsIntoLanes(
    [{ id: 'a1', box: box(0, 0), sector: 'A', holderId: 'qa' }, { id: 'a2', box: box(300, 0), sector: 'A', holderId: 'qa' },
      { id: 'b1', box: box(0, 500), sector: 'B', holderId: 'qb' }, { id: 'b2', box: box(300, 500), sector: 'B', holderId: 'qb' }],
    [q('qa', 'A', -40, -40, 600, 300), q('qb', 'B', -40, 460, 600, 300)],
    [{ source: 'a1', target: 'a2' }, { source: 'a2', target: 'b1' }, { source: 'b1', target: 'b2' }],
  );
  check('fluxo esquerda→direita: direção LR e bloco seguinte começa depois do anterior', s4.direction === 'LR' && s4.boxes.get('b1').x > s4.boxes.get('a2').x + 160, s4.direction);

  // Fim fora do quadro, um pouco abaixo, ligado a ele: continua embaixo.
  const s5 = stackSectorsIntoLanes(
    [{ id: 'a1', box: box(120, 100), sector: 'A', holderId: 'qa' }, { id: 'b1', box: box(570, 100), sector: 'B', holderId: 'qb' }, { id: 'b2', box: box(570, 300), sector: 'B', holderId: 'qb' },
      { id: 'fim', type: 'end', box: box(610, 650, 60, 60), sector: '' }],
    [q('qa', 'A', 0, 0, 400, 500), q('qb', 'B', 450, 0, 400, 500)],
    [{ source: 'a1', target: 'b1' }, { source: 'b1', target: 'b2' }, { source: 'b2', target: 'fim' }],
  );
  check('fim solto ligado ao quadro: na raia do quadro e abaixo dele', s5.groups[1].nodeIds.includes('fim') && s5.boxes.get('fim').y > s5.boxes.get('b2').y + 60 && Math.abs(cxOf(s5, 'fim') - cxOf(s5, 'b2')) < 100);

  // Nota solta (sem setor e sem seta) fica junto do quadro mais próximo, sem
  // abrir raia nem esticar um bloco.
  const s6 = stackSectorsIntoLanes(
    [{ id: 'a1', box: box(0, 100), sector: 'A', holderId: 'qa' }, { id: 'b1', box: box(400, 100), sector: 'B', holderId: 'qb' }, { id: 'titulo', type: 'text', box: box(0, -150), sector: '' }],
    [q('qa', 'A', -40), q('qb', 'B', 360)],
    [{ source: 'a1', target: 'b1' }],
  );
  check('título solto acompanha o quadro mais próximo, sem raia própria', s6.groups.length === 2 && s6.groups[0].nodeIds.includes('titulo') && top(s6, ['titulo']) < top(s6, ['a1']));
}

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
