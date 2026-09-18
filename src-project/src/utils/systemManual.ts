import jsPDF from 'jspdf';

/**
 * Utilitário de Geração e Exportação do Manual do Sistema em Múltiplos Formatos
 * Suporta os formatos: PDF, DOCX, TXT e Markdown (.md)
 */

export function generateSystemManualMarkdown(): string {
  return `# Labirinto - Manual Completo do Sistema e Engenharia de Processos
**Versão:** 3.5.0
**Atualizado em:** ${new Date().toLocaleDateString('pt-BR')}

## 1. Visão Geral
O **Labirinto** é uma plataforma avançada para modelagem, engenharia de processos, visualização e exportação de fluxogramas com suporte a **Value Stream Mapping (VSM)**. Ele combina uma interface gráfica interativa (arrastar-e-soltar, conexões magnéticas ortogonais e curvas, alinhamento inteligente e customização de nós) com um motor de Inteligência Artificial avançado (à sua escolha: modo gratuito, Gemini, ChatGPT, Claude, DeepSeek, OpenRouter ou GitHub Models) calibrado nas normas internacionais de modelagem de processos (**ISO 5807** e **BPMN 2.0**).

## 2. Estrutura de Versões (Níveis de Complexidade)
O sistema suporta a visualização e gestão de um mesmo processo em 3 níveis de complexidade complementares:
- **Simples (Visão Executiva / Macro):** 4 a 6 etapas essenciais. Destaca o objetivo final e os grandes marcos do processo sem sobrecarregar com detalhes operacionais.
- **Normal (Visão Tática / Padrão de Processo):** 9 a 15 etapas. Apresenta os pontos de decisão, ramificações condicionais, caminhos alternativos de exceção e reconvergência no fluxo principal.
- **Detalhado (Visão Operacional / Deep Dive):** 16 a 28+ etapas. Mapeia exaustivamente todas as micro-atividades, preparações/setups, validações prévias, geração de documentos/registros em banco, múltiplos cenários condicionais, caminhos paralelos, loops de correção e checkpoints de qualidade.

**Memória de Tela (Viewport Individual):** Cada aba possui seu próprio estado de coordenadas e zoom em cache. Ao alternar entre as abas (ex: Detalhado para Simples), a visualização se ajusta com precisão para onde você estava trabalhando, eliminando deslocamentos indesejados.

## 3. Critérios de Engenharia de IA (BPMN & ISO 5807)
A geração por Inteligência Artificial foi calibrada para seguir os mais altos padrões de modelagem de processos do mercado:
- **Ramificações e Separação de Atividades (Branching):** Nós de decisão (\`decision\`) criam caminhos distintos para situações diferentes (ex: Aprovação vs Reprovação, Sucesso vs Falha, Atendimento Padrão vs Terceirizado/Urgente).
- **Rótulos Mandatórios nas Decisões:** Cada aresta que sai de um nó de decisão possui rótulos explícitos (ex: *"Sim"*, *"Não"*, *"Aprovado"*, *"Reprovado"*, *"Erro"*).
- **Loops de Feedback e Correção (Rework Loops):** Quando uma atividade é rejeitada ou apresenta inconformidade, o fluxo aponta de volta para a etapa anterior necessária para ajuste.
- **Convergência de Caminhos (Merges):** Atividades ramificadas para situações diferentes voltam a se encontrar (convergência) em etapas subsequentes compartilhadas (ex: faturamento, auditoria ou entrega final).
- **Equivalência Numérica Absoluta dos Tempos:**
  - O **Tempo Total de Ciclo** (soma de duração, setup e espera) é **rigorosamente idêntico** em todas as três versões (Simples, Normal e Detalhado).
  - A IA deriva as versões mantendo a conservação exata da soma dos tempos individuais das micro-etapas nas macro-etapas.
- **Modo "Derivar" (Usar fluxo atual):** Permite usar um diagrama existente desenhado na tela como fonte de verdade matemática e lógica para criar as outras versões automaticamente.
- **Prevenção de Sobrescrita:** Ao gerar conteúdo para abas que já possuem elementos, o usuário escolhe entre *Substituir tudo* ou *Adicionar (Sem apagar)*.

## 4. Gestão de Tempos (Value Stream Mapping - VSM)
Cada nó do fluxograma possui um painel configurável para Value Stream Mapping (VSM):
- **Campos de Tempo:**
  - *Duração Principal:* Tempo de agregação de valor real.
  - *Setup / Preparação:* Troca de insumos e setup de máquina/sistema.
  - *Espera / Fila:* Tempos de gargalo e atrasos não-agregadores.
  - *Pausas e Outros Extras:* Deslocamentos e intervalos.
- **Cálculos Automáticos em Tempo Real:** O motor calcula a jornada cumulativa do início ao fim (Lead Time Total) e a Eficiência do Processo (%).
- **Formatos e Precisão:** Suporta formato clássico (HH:MM:SS) ou decimal (segundos), com precisão ajustável de 0 a 3 casas decimais.

## 5. Tipos de Formas Suportadas
- **Início / Fim (\`start\` / \`end\`):** Terminadores de fluxo.
- **Processo (\`process\`):** Etapas operacionais.
- **Decisão (\`decision\`):** Losangos de bifurcação condicional.
- **Documento (\`document\`):** Emissão de relatórios, notas fiscais, ordens de serviço.
- **Banco de Dados (\`database\`):** Armazenamento em ERP, CRM, nuvem.
- **Entrada / Saída (\`inputoutput\`):** Recebimento de dados do cliente ou envio de entregáveis.
- **Subprocesso, Swimlane, Anotações e Conectores de Junção.**

## 6. Exportação, Nuvem e Relatórios
- **Salvamento:** os fluxogramas ficam no navegador; o modal "Guardar como..." exporta o arquivo para você guardar ou enviar.
- **Exportação Multiformatos:** Download em JSON (backup integral re-editável), XML Draw.io, BPMN 2.0, PDF (A4), PNG de alta resolução, SVG vetorial e Planilha CSV com todos os tempos calculados.
- **Planilha do Fluxo (Tabela Dinâmica):** Edição tabular bidirecional simultânea ao diagrama.
- **Manual do Sistema:** Disponível para exportação na tela inicial do sistema em múltiplos formatos (PDF, DOCX, TXT e Markdown).
`;
}

export function generateSystemManualPlainText(): string {
  const md = generateSystemManualMarkdown();
  return md
    .replace(/^# (.*$)/gm, (_, match) => `==================================================\n${match}\n==================================================`)
    .replace(/^## (.*$)/gm, '\n--------------------------------------------------\n$1\n--------------------------------------------------')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*/g, '');
}

export function generateSystemManualHTML(): string {
  const dateStr = new Date().toLocaleDateString('pt-BR');
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Labirinto - Manual Completo do Sistema</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 20mm 15mm 20mm 15mm;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    h1 {
      color: #1e3a8a;
      font-size: 26px;
      margin: 0 0 8px 0;
    }
    .badge {
      display: inline-block;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
    }
    h2 {
      color: #1d4ed8;
      font-size: 18px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    p {
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 14px;
    }
    ul {
      margin-top: 0;
      margin-bottom: 16px;
      padding-left: 20px;
    }
    li {
      margin-bottom: 6px;
      font-size: 14px;
    }
    strong {
      color: #0f172a;
    }
    code {
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
    }
    .highlight-box {
      background-color: #f8fafc;
      border-left: 4px solid #3b82f6;
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 0 8px 8px 0;
    }
    .footer {
      margin-top: 40px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Labirinto - Manual Completo do Sistema</h1>
    <div>
      <span class="badge">Versão 3.5.0</span>
      <span style="font-size: 13px; color: #64748b; margin-left: 10px;">Atualizado em ${dateStr}</span>
    </div>
  </div>

  <h2>1. Visão Geral</h2>
  <p>O <strong>Labirinto</strong> é uma plataforma avançada para modelagem, engenharia de processos, visualização e exportação de fluxogramas com suporte a <strong>Value Stream Mapping (VSM)</strong>. Ele combina uma interface gráfica interativa (arrastar-e-soltar, conexões magnéticas ortogonais e curvas, alinhamento inteligente e customização de nós) com um motor de Inteligência Artificial avançado (à sua escolha: modo gratuito, Gemini, ChatGPT, Claude, DeepSeek, OpenRouter ou GitHub Models) calibrado nas normas internacionais de modelagem de processos (<strong>ISO 5807</strong> e <strong>BPMN 2.0</strong>).</p>

  <h2>2. Estrutura de Versões (Níveis de Complexidade)</h2>
  <p>O sistema suporta a visualização e gestão de um mesmo processo em 3 níveis de complexidade complementares:</p>
  <ul>
    <li><strong>Simples (Visão Executiva / Macro):</strong> 4 a 6 etapas essenciais. Destaca o objetivo final e os grandes marcos do processo sem sobrecarregar com detalhes operacionais.</li>
    <li><strong>Normal (Visão Tática / Padrão de Processo):</strong> 9 a 15 etapas. Apresenta os pontos de decisão, ramificações condicionais, caminhos alternativos de exceção e reconvergência no fluxo principal.</li>
    <li><strong>Detalhado (Visão Operacional / Deep Dive):</strong> 16 a 28+ etapas. Mapeia exaustivamente todas as micro-atividades, preparações/setups, validações prévias, geração de documentos/registros em banco, múltiplos cenários condicionais, caminhos paralelos, loops de correção e checkpoints de qualidade.</li>
  </ul>
  <div class="highlight-box">
    <strong>Memória de Tela (Viewport Individual):</strong> Cada aba possui seu próprio estado de coordenadas e zoom em cache. Ao alternar entre as abas, a visualização se ajusta com precisão para onde você estava trabalhando.
  </div>

  <h2>3. Critérios de Engenharia de IA (BPMN & ISO 5807)</h2>
  <ul>
    <li><strong>Ramificações (Branching):</strong> Nós de decisão (<code>decision</code>) criam caminhos distintos para situações diferentes.</li>
    <li><strong>Rótulos Mandatórios nas Decisões:</strong> Cada aresta que sai de um nó de decisão possui rótulos explícitos (ex: "Sim", "Não", "Aprovado", "Reprovado").</li>
    <li><strong>Loops de Feedback:</strong> Ajustes e correções retornam para as etapas prévias corretas.</li>
    <li><strong>Convergência de Caminhos:</strong> Atividades paralelas ou alternativas reconvergem em etapas subsequentes compartilhadas.</li>
    <li><strong>Equivalência Numérica de Tempos:</strong> O Tempo Total de Ciclo é rigorosamente idêntico em todas as três versões.</li>
  </ul>

  <h2>4. Gestão de Tempos (Value Stream Mapping - VSM)</h2>
  <p>Cada nó do fluxograma possui um painel configurável para Value Stream Mapping (VSM):</p>
  <ul>
    <li><strong>Duração Principal:</strong> Tempo de agregação de valor real.</li>
    <li><strong>Setup / Preparação:</strong> Troca de insumos e setup de máquina.</li>
    <li><strong>Espera / Fila:</strong> Tempos de gargalo e atrasos.</li>
    <li><strong>Cálculos Automáticos:</strong> Cálculo em tempo real do Lead Time Total e Eficiência do Processo (%).</li>
  </ul>

  <h2>5. Tipos de Formas Suportadas</h2>
  <ul>
    <li><strong>Início / Fim:</strong> Terminadores de fluxo.</li>
    <li><strong>Processo:</strong> Etapas operacionais retangulares.</li>
    <li><strong>Decisão:</strong> Losangos de bifurcação condicional.</li>
    <li><strong>Documento, Banco de Dados, Entrada / Saída, Subprocesso e Swimlanes.</strong></li>
  </ul>

  <h2>6. Exportação e Nuvem</h2>
  <ul>
    <li><strong>Salvo na Nuvem:</strong> Integração instantânea com salvamento por versão.</li>
    <li><strong>Exportação Multiformatos:</strong> Download em JSON, XML Draw.io, BPMN 2.0, PDF, PNG, SVG e CSV.</li>
    <li><strong>Manual do Sistema:</strong> Disponível para download nos formatos PDF, DOCX, TXT e Markdown.</li>
  </ul>

  <div class="footer">
    Labirinto • Manual Oficial do Sistema • Todos os direitos reservados
  </div>
</body>
</html>`;
}

export type ManualExportFormat = 'md' | 'pdf' | 'docx' | 'txt';

export function exportSystemManualPDF(fileName: string): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 16;
  const marginY = 16;
  const contentWidth = pageWidth - marginX * 2;
  const maxY = pageHeight - marginY - 12;

  let y = marginY;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > maxY) {
      doc.addPage();
      y = marginY + 4;
    }
  };

  // Header Banner
  doc.setFillColor(30, 58, 138); // Blue 900
  doc.roundedRect(marginX, y, contentWidth, 24, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Labirinto - Manual do Sistema e Engenharia de Processos', marginX + 6, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(219, 234, 254); // Blue 100
  const dateStr = new Date().toLocaleDateString('pt-BR');
  doc.text(`Versão 3.5.0  •  Documento Oficial de Engenharia e Operação  •  Atualizado em: ${dateStr}`, marginX + 6, y + 17);

  y += 30;

  const renderSectionHeader = (title: string) => {
    checkPageBreak(14);
    doc.setFillColor(239, 246, 255); // Blue 50
    doc.setDrawColor(191, 219, 254); // Blue 200
    doc.roundedRect(marginX, y, contentWidth, 8, 2, 2, 'FD');

    doc.setTextColor(29, 78, 216); // Blue 700
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, marginX + 4, y + 5.5);
    y += 12;
  };

  const renderParagraph = (text: string, isBold = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85); // Slate 700
    const lines = doc.splitTextToSize(text, contentWidth);
    const textHeight = lines.length * 4.5;
    checkPageBreak(textHeight);
    doc.text(lines, marginX, y);
    y += textHeight + 3;
  };

  const renderBullet = (title: string, desc: string) => {
    doc.setFontSize(9);
    const fullText = `• ${title}: ${desc}`;
    const lines = doc.splitTextToSize(fullText, contentWidth - 4);
    const textHeight = lines.length * 4.2;

    checkPageBreak(textHeight + 1);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(`• ${title}:`, marginX + 2, y);

    const prefixWidth = doc.getTextWidth(`• ${title}: `);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    const descLines = doc.splitTextToSize(desc, contentWidth - 4 - prefixWidth);
    if (descLines.length > 0) {
      doc.text(descLines[0], marginX + 2 + prefixWidth, y);
    }
    if (descLines.length > 1) {
      const rest = doc.splitTextToSize(descLines.slice(1).join(' '), contentWidth - 8);
      doc.text(rest, marginX + 6, y + 4.2);
      y += rest.length * 4.2;
    }

    y += 4.5;
  };

  const renderCallout = (title: string, text: string) => {
    const fullText = `${title}: ${text}`;
    const lines = doc.splitTextToSize(fullText, contentWidth - 10);
    const boxHeight = lines.length * 4.2 + 6;

    checkPageBreak(boxHeight);

    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(59, 130, 246); // Blue 500
    doc.rect(marginX, y, contentWidth, boxHeight, 'F');

    // Left accent bar
    doc.setFillColor(59, 130, 246);
    doc.rect(marginX, y, 2.5, boxHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 138);
    doc.text(`${title}: `, marginX + 6, y + 4.5);
    const pWidth = doc.getTextWidth(`${title}: `);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const textLines = doc.splitTextToSize(text, contentWidth - 12 - pWidth);
    if (textLines.length > 0) {
      doc.text(textLines[0], marginX + 6 + pWidth, y + 4.5);
    }
    if (textLines.length > 1) {
      const remaining = doc.splitTextToSize(textLines.slice(1).join(' '), contentWidth - 12);
      doc.text(remaining, marginX + 6, y + 8.7);
    }

    y += boxHeight + 4;
  };

  // Section 1
  renderSectionHeader('1. Visão Geral');
  renderParagraph('O Labirinto é uma plataforma avançada para modelagem, engenharia de processos, visualização e exportação de fluxogramas com suporte a Value Stream Mapping (VSM). Ele combina uma interface gráfica interativa (arrastar-e-soltar, conexões magnéticas ortogonais e curvas, alinhamento inteligente e customização de nós) com um motor de Inteligência Artificial avançado calibrado nas normas internacionais de modelagem de processos (ISO 5807 e BPMN 2.0).');

  // Section 2
  renderSectionHeader('2. Estrutura de Versões (Níveis de Complexidade)');
  renderParagraph('O sistema suporta a visualização e gestão de um mesmo processo em 3 níveis de complexidade complementares:');
  renderBullet('Simples (Visão Executiva / Macro)', '4 a 6 etapas essenciais. Destaca o objetivo final e os grandes marcos do processo sem sobrecarregar com detalhes operacionais.');
  renderBullet('Normal (Visão Tática / Padrão)', '9 a 15 etapas. Apresenta os pontos de decisão, ramificações condicionais, caminhos alternativos de exceção e reconvergência no fluxo principal.');
  renderBullet('Detalhado (Visão Operacional / Deep Dive)', '16 a 28+ etapas. Mapeia exaustivamente todas as micro-atividades, preparações/setups, validações prévias, geração de documentos/registros em banco, múltiplos cenários condicionais, caminhos paralelos, loops de correção e checkpoints de qualidade.');
  renderCallout('Memória de Tela (Viewport Individual)', 'Cada aba possui seu próprio estado de coordenadas e zoom em cache. Ao alternar entre abas, a visualização se ajusta com precisão para onde você estava trabalhando.');

  // Section 3
  renderSectionHeader('3. Critérios de Engenharia de IA (BPMN & ISO 5807)');
  renderParagraph('A geração por Inteligência Artificial foi calibrada para seguir os mais altos padrões de engenharia de processos:');
  renderBullet('Ramificações (Branching)', 'Nós de decisão criam caminhos distintos para situações diferentes (Aprovação vs Reprovação, Sucesso vs Falha).');
  renderBullet('Rótulos Mandatórios', 'Cada aresta que sai de uma decisão possui rótulos explícitos ("Sim", "Não", "Aprovado", "Reprovado").');
  renderBullet('Loops de Feedback', 'Quando uma atividade é rejeitada, o fluxo aponta de volta para a etapa anterior necessária para ajuste.');
  renderBullet('Convergência de Caminhos', 'Atividades ramificadas voltam a se encontrar em etapas subsequentes compartilhadas.');
  renderBullet('Equivalência Numérica de Tempos', 'O Tempo Total de Ciclo é rigorosamente idêntico em todas as três versões (Simples, Normal e Detalhado).');
  renderBullet('Modo Derivar', 'Permite usar um diagrama desenhado na tela como fonte de verdade para criar as outras versões automaticamente.');

  // Section 4
  renderSectionHeader('4. Gestão de Tempos (Value Stream Mapping - VSM)');
  renderParagraph('Cada nó do fluxograma possui um painel configurável para Value Stream Mapping (VSM):');
  renderBullet('Duração Principal', 'Tempo de agregação de valor real na atividade.');
  renderBullet('Setup / Preparação', 'Troca de insumos e setup de máquina/ferramental.');
  renderBullet('Espera / Fila', 'Tempos de gargalo e atrasos não-agregadores de valor.');
  renderBullet('Pausas e Extras', 'Deslocamentos, intervalos operacionais e checagens.');
  renderBullet('Cálculos em Tempo Real', 'Cálculo automatizado do Lead Time Total da jornada e da Eficiência do Processo (%).');

  // Section 5
  renderSectionHeader('5. Tipos de Formas Suportadas');
  renderBullet('Início / Fim (start / end)', 'Terminadores de fluxo ovais ou arredondados.');
  renderBullet('Processo (process)', 'Etapas operacionais retangulares.');
  renderBullet('Decisão (decision)', 'Losangos de bifurcação condicional com saídas nomeadas.');
  renderBullet('Documento & Banco de Dados', 'Emissão de relatórios e persistência em ERP/CRM.');
  renderBullet('Entrada / Saída & Subprocessos', 'Recebimento de dados, entregáveis e blocos modulares.');

  // Section 6
  renderSectionHeader('6. Nuvem, Compartilhamento e Exportação');
  renderBullet('Armazenamento local', 'Diagramas guardados no navegador, com exportação em JSON/Draw.io/BPMN/PDF e cópia de fluxos entre arquivos.');
  renderBullet('Exportação Multiformatos', 'Download em JSON re-editável, XML Draw.io, BPMN 2.0, PDF vetorial, PNG HD, SVG e CSV.');
  renderBullet('Planilha do Fluxo', 'Edição tabular dinâmica bidirecional sincronizada com os nós do canvas.');

  // Add Footers and Page Numbers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(marginX, pageHeight - marginY + 2, marginX + contentWidth, pageHeight - marginY + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text('Labirinto • Manual Oficial do Sistema • Todos os direitos reservados', marginX, pageHeight - marginY + 6);
    doc.text(`Página ${i} de ${totalPages}`, marginX + contentWidth, pageHeight - marginY + 6, { align: 'right' });
  }

  // Trigger download directly
  doc.save(fileName);
}

export function downloadSystemManualFormat(format: ManualExportFormat = 'md'): void {
  const dateSuffix = new Date().toISOString().split('T')[0];
  const filenameBase = `Labirinto-Manual-do-Sistema-${dateSuffix}`;

  if (format === 'md') {
    const content = generateSystemManualMarkdown();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    triggerDownload(blob, `${filenameBase}.md`);
  } else if (format === 'txt') {
    const content = generateSystemManualPlainText();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, `${filenameBase}.txt`);
  } else if (format === 'docx') {
    const htmlContent = generateSystemManualHTML();
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/vnd.ms-word;charset=utf-8' });
    triggerDownload(blob, `${filenameBase}.docx`);
  } else if (format === 'pdf') {
    try {
      exportSystemManualPDF(`${filenameBase}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF do manual com jsPDF:', err);
      // Fallback
      const htmlContent = generateSystemManualHTML();
      const blob = new Blob(['\ufeff', htmlContent], { type: 'text/html;charset=utf-8' });
      triggerDownload(blob, `${filenameBase}.html`);
    }
  }
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadSystemManual(): void {
  downloadSystemManualFormat('md');
}
