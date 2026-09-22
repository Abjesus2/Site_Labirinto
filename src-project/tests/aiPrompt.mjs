import { buildPrompt } from '../.tmp-aiBridge.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

// O prompt voltou à base original (a que gerava os fluxos bem organizados,
// com ramificações e raias) + três acréscimos curtos pedidos pelo usuário.
// As versões longas ("máximo de detalhe sem teto", notes obrigatórios,
// exemplos enormes) pioraram a geração: fila reta, 100+ etapas, resposta
// cortada — este teste garante que elas não voltem sem querer.
const prompt = buildPrompt({
  prompt: 'Processo de recebimento de mercadorias no CD.',
  complexities: ['simples', 'normal', 'detalhado'],
  allowedShapeTypes: ['start', 'end', 'process', 'decision'],
});

// Base original preservada
check('pede ramificações e evita cadeia reta', /Avoid simplistic straight-line chains/.test(prompt));
check('mantém os níveis originais (detalhado 16 to 28+)', /'detalhado' \(Operational Deep-Dive\): 16 to 28\+ nodes/.test(prompt));
check('mantém convergência e loops de retrabalho', /Convergence \(Merges\)/.test(prompt) && /Feedback \/ Correction Loops/.test(prompt));
check('mantém a regra do losango com no mínimo 2 saídas', /NO MÍNIMO 2 arestas de saída/.test(prompt));
check('pede setores/raias (department)', /department/i.test(prompt) && /RAIAS E QUADROS/.test(prompt));
check('nunca gera swimlane/frame como nó', /NÃO os utilize para gerar nós/.test(prompt));

// Acréscimos curtos
check('exemplo curto de granularidade (etiquetas)', /Bipar Cada Volume para Gerar Etiqueta/.test(prompt) && /Bipar Volumes para Imprimir Etiquetas/.test(prompt));
check('verificação implícita vira losango', /verificação implícita/.test(prompt));
check('fluxo único, sem ilhas', /ilhas/.test(prompt) && /EXPLÍCITO que são processos totalmente distintos/.test(prompt));
check('isDubious só em dúvida real, esperado nenhuma', /isDubious/.test(prompt) && /esperado é nenhuma aresta com "isDubious"/.test(prompt));

// O que piorou a geração não pode voltar
check('exemplo de formato não traz isDubious (a IA copiava para todas as linhas)', !/"isDubious": true\}/.test(prompt));
check('sem "máximo de detalhe sem teto"', !/NO UPPER CEILING|SEM TETO/.test(prompt));
check('sem notes obrigatórios', !/"notes"/.test(prompt));

console.log(R.join('\n'));
