import { computeAlignmentSnap } from '../.tmp-alignmentGuides.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const outra = { x: 100, y: 100, width: 200, height: 60 };

// 1. Arrastando uma forma do mesmo tamanho quase alinhada pela esquerda
{
  const snap = computeAlignmentSnap([{ x: 104, y: 300, width: 200, height: 60 }], [outra], 8);
  check('encaixa na borda/centro (desloca 4px pra esquerda)', snap.dx === -4, JSON.stringify(snap));
  check('mostra linha vertical no x alinhado', snap.vertical && [100, 200, 300].includes(snap.vertical.pos));
  check('linha vertical cobre as duas formas', snap.vertical && snap.vertical.from < 100 && snap.vertical.to > 360);
  check('sem alinhamento horizontal (longe no eixo y)', snap.horizontal === null && snap.dy === 0);
}

// 2. Centro com centro, formas de tamanhos diferentes
{
  const snap = computeAlignmentSnap([{ x: 145, y: 400, width: 100, height: 40 }], [outra], 8);
  check('centraliza no centro da outra forma (x=200)', snap.vertical?.pos === 200 && snap.dx === 5, JSON.stringify(snap));
}

// 3. Mesma altura (linha horizontal) arrastando ao lado
{
  const snap = computeAlignmentSnap([{ x: 500, y: 97, width: 200, height: 60 }], [outra], 8);
  check('alinha no eixo y (desloca 3px pra baixo)', snap.dy === 3 && snap.horizontal !== null, JSON.stringify(snap));
}

// 4. Longe de tudo: nada acontece
{
  const snap = computeAlignmentSnap([{ x: 700, y: 700, width: 200, height: 60 }], [outra], 8);
  check('longe de tudo: sem guia e sem deslocamento', !snap.vertical && !snap.horizontal && snap.dx === 0 && snap.dy === 0);
}

// 5. Várias formas arrastadas juntas: usa a caixa do conjunto
{
  const grupo = [
    { x: 102, y: 300, width: 100, height: 40 },
    { x: 260, y: 360, width: 100, height: 40 },
  ];
  const snap = computeAlignmentSnap(grupo, [outra], 8);
  check('grupo arrastado encaixa pela caixa do conjunto', snap.dx === -2, JSON.stringify(snap));
}

console.log(R.join('\n'));
