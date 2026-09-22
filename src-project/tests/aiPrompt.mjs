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

// Correções depois do vídeo com 113 linhas vermelhas em fila reta e losangos
// de uma saída só.
check('exige escrever as arestas logo depois de cada nó (resposta cortada não perde as ligações)', /LOGO EM SEGUIDA todas as arestas que SAEM dele/.test(prompt));
check('exemplo principal do formato não usa isDubious', !/"isDubious": true/.test(prompt.split('O que este exemplo ensina')[0]));
check('isDubious descrito como exceção raríssima, esperado zero', /EXCEÇÃO RARÍSSIMA/.test(prompt) && /esperado é ZERO/.test(prompt));
check('linha reta proibida em normal/detalhado', /LINHA RETA/.test(prompt));
check('alternativas (2º ou 3º andar) viram um ramo para cada', /UM RAMO PARA CADA alternativa/.test(prompt));
check('exemplo completo tem losango com duas saídas rotuladas', /"source": "n3", "target": "n4", "label": "Sim"/.test(prompt) && /"source": "n3", "target": "n6", "label": "Não"/.test(prompt));
check('tem checklist final', /CHECKLIST FINAL/.test(prompt));
check('notes curtos pra não estourar o tamanho', /no máximo ~200 caracteres/.test(prompt));

console.log(R.join('\n'));
