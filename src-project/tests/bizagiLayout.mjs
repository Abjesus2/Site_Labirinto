import { computeBizagiGeometry } from '../.tmp-bizagiLayout.mjs';

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

console.log(R.join('\n'));
