import { buildPrompt } from '../.tmp-aiBridge.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

// Confere se as instruções corrigidas depois do feedback do usuário (raias
// sumindo, blocos desconectados, "detalhado" raso demais) realmente estão
// no texto final que vai pra IA — não só nos comentários do código.
const prompt = buildPrompt({
  prompt: 'Processo de recebimento de mercadorias no CD.',
  complexities: ['simples', 'normal', 'detalhado'],
  allowedShapeTypes: ['start', 'end', 'process', 'decision'],
});

check('pede setores/raias (department) sempre que houver área/setor', /department/i.test(prompt) && /setor/i.test(prompt));
check(
  'reforça que a regra de department não é enfraquecida pelas instruções novas de detalhe',
  /nada do que está nesta seção 1\.1 substitui ou reduz a obrigação da seção 3\.2/.test(prompt),
);

check('tem a seção de conectividade global do fluxo (5.1)', /CONECTIVIDADE GLOBAL DO FLUXO/.test(prompt));
check('proíbe blocos desconectados ("ilhas")', /ilhas/.test(prompt));
check('explica o mecanismo isDubious pra conexão incerta', /isDubious/.test(prompt) && /vermelho/i.test(prompt));
check(
  'só permite fluxos separados quando o texto é EXPLICITAMENTE sobre processos distintos',
  /EXPLÍCITO que são processos totalmente distintos/.test(prompt),
);

check('tem o exemplo obrigatório de granularidade (seção 1.2)', /EXEMPLO OBRIGATÓRIO DE GRANULARIDADE/.test(prompt));
check('o exemplo cobre o caso "Etiquetagem de Volumes" do usuário', /Etiquetagem de Volumes|etiquetas de Recebimento Agrupado/.test(prompt));
check(
  'o exemplo mostra o detalhado quebrando em várias etapas atômicas + decisão + loop',
  /Bipar Etiqueta de Cada Volume/.test(prompt) && /Todas as Caixas Estão com Etiquetas Coladas\?/.test(prompt),
);
check('o exemplo também mostra a versão normal, menor', /Bipar Volumes para Imprimir Etiquetas/.test(prompt));
check(
  'instrui a tratar verificações implícitas no texto como decisão (losango) faltante',
  /verificação implícita/.test(prompt) || /Uma verificação implícita/.test(prompt),
);

check('mantém a regra de nunca gerar swimlane/frame como nó (raia é desenhada pelo app)', /NÃO os utilize para gerar nós/.test(prompt));
check('mantém a regra do losango com no mínimo 2 saídas', /NO MÍNIMO 2 arestas de saída/.test(prompt));

console.log(R.join('\n'));
