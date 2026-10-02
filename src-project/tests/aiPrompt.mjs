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
check('pede setores/raias (department)', /department/i.test(prompt) && /SETORES, ÁREAS OU DEPARTAMENTOS DIFERENTES \(RAIAS\)/.test(prompt));
check('setor obrigatório em todos os nós quando há 2+ executores', /OBRIGATÓRIO em TODOS os nós/.test(prompt) && /inclusive "start"/.test(prompt));
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

// Geração pela IA configurada: formato compacto (só a codificação), sem
// reduzir o fluxo; o "Gerar manualmente" continua no JSONL completo.
{
  const compacto = buildPrompt({ prompt: 'Recebimento.', complexities: ['detalhado'], compactOutput: true,
    referenceVersions: { normal: { nodes: [{ id: 'n1', type: 'start', data: { label: 'Início', timing: { duration: 0, department: 'Recebimento' } } }], edges: [] } } });
  check('prompt compacto pede o formato curto', /COMPACT ENCODING/.test(compacto) && /N\|<id>\|<type>\|<label>/.test(compacto) && !/Format to follow line by line/.test(compacto));
  check('prompt compacto proíbe reduzir o fluxo', /NEVER reduce, merge or skip steps/.test(compacto) && /FULL detail/.test(compacto));
  check('prompt compacto mantém as regras (setores, decisões, tempo total)', /OBRIGATÓRIO em TODOS os nós/.test(compacto) && /CRITICAL DECISION RULE/.test(compacto) && /TIME PRESERVATION/.test(compacto));
  check('versões já geradas vão como referência curta', /VERSÕES JÁ GERADAS/.test(compacto) && /V\|normal\nN\|n1\|start\|Início\|0\|Recebimento/.test(compacto));
  const manual = buildPrompt({ prompt: 'Recebimento.', complexities: ['simples', 'normal', 'detalhado'], manualMode: true });
  check('"Gerar manualmente": prompt completo em JSONL, sem formato compacto', /JSON Lines format \(JSONL\)/.test(manual) && !/COMPACT ENCODING/.test(manual) && /\[simples, normal, detalhado\]/.test(manual));
}

console.log(R.join('\n'));
