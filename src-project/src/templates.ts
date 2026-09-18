import { Node, Edge, MarkerType } from '@xyflow/react';

export interface FlowTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  nodes: Node[];
  edges: Edge[];
}

export const MIRO_FLOWCHART_TEMPLATES: FlowTemplate[] = [
  {
    id: 'auth_flow',
    name: 'Autenticação & Login de Usuário',
    category: 'Engenharia & Produto',
    description: 'Fluxo completo de login, validação de credenciais, MFA e recuperação de senha.',
    icon: 'Lock',
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 320, y: 40 },
        data: { label: 'Início: Acessa App', styleOverride: { backgroundColor: '#dcfce7', borderColor: '#22c55e' } }
      },
      {
        id: 'input_creds',
        type: 'process',
        position: { x: 300, y: 150 },
        data: { label: 'Preenche E-mail e Senha', styleOverride: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' } }
      },
      {
        id: 'check_db',
        type: 'database',
        position: { x: 310, y: 260 },
        data: { label: 'Base de Usuários (Firestore)', styleOverride: { backgroundColor: '#f3e8ff', borderColor: '#a855f7' } }
      },
      {
        id: 'is_valid',
        type: 'decision',
        position: { x: 310, y: 380 },
        data: { label: 'Credenciais Válidas?', styleOverride: { backgroundColor: '#fef9c3', borderColor: '#eab308' } }
      },
      {
        id: 'error_msg',
        type: 'process',
        position: { x: 580, y: 397 },
        data: { label: 'Exibe Erro e Sugere Reset', styleOverride: { backgroundColor: '#fee2e2', borderColor: '#ef4444' } }
      },
      {
        id: 'mfa_check',
        type: 'decision',
        position: { x: 310, y: 530 },
        data: { label: 'MFA Ativado?', styleOverride: { backgroundColor: '#fef9c3', borderColor: '#eab308' } }
      },
      {
        id: 'send_sms',
        type: 'process',
        position: { x: 580, y: 547 },
        data: { label: 'Envia Token por SMS / Authenticator', styleOverride: { backgroundColor: '#ffedd5', borderColor: '#f97316' } }
      },
      {
        id: 'gen_jwt',
        type: 'subprocess',
        position: { x: 300, y: 680 },
        data: { label: 'Gera JWT & Sessão Segura', styleOverride: { backgroundColor: '#e0e7ff', borderColor: '#6366f1' } }
      },
      {
        id: 'end_success',
        type: 'end',
        position: { x: 320, y: 790 },
        data: { label: 'Dashboard Principal', styleOverride: { backgroundColor: '#dcfce7', borderColor: '#22c55e' } }
      },
      {
        id: 'sticky_note',
        type: 'sticky',
        position: { x: 50, y: 200 },
        data: { label: '💡 Nota do Time:\nBloquear após 5 tentativas consecutivas de senha incorreta.', styleOverride: { backgroundColor: '#fef08a' } }
      }
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'input_creds', sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'e2', source: 'input_creds', target: 'check_db', sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'e3', source: 'check_db', target: 'is_valid', sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'e4', source: 'is_valid', target: 'mfa_check', sourceHandle: 'bottom', targetHandle: 'top', label: 'Sim', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'e5', source: 'is_valid', target: 'error_msg', sourceHandle: 'right', targetHandle: 'left', label: 'Não', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'e6', source: 'mfa_check', target: 'gen_jwt', sourceHandle: 'bottom', targetHandle: 'top', label: 'Não', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'e7', source: 'mfa_check', target: 'send_sms', sourceHandle: 'right', targetHandle: 'left', label: 'Sim', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'e8', source: 'send_sms', target: 'gen_jwt', sourceHandle: 'bottom', targetHandle: 'right', label: 'Código OK', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'e9', source: 'gen_jwt', target: 'end_success', sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } }
    ]
  },
  {
    id: 'ecommerce_checkout',
    name: 'Checkout & Pagamento E-Commerce',
    category: 'Negócios & Vendas',
    description: 'Processamento de carrinho, gateway de pagamento, verificação antifraude e envio.',
    icon: 'ShoppingCart',
    nodes: [
      {
        id: 'start_cart',
        type: 'start',
        position: { x: 320, y: 40 },
        data: { label: 'Início: Finalizar Compra', styleOverride: { backgroundColor: '#dcfce7', borderColor: '#22c55e' } }
      },
      {
        id: 'calc_freight',
        type: 'process',
        position: { x: 300, y: 140 },
        data: { label: 'Calcula Frete & Prazos', styleOverride: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' } }
      },
      {
        id: 'select_payment',
        type: 'process',
        position: { x: 300, y: 240 },
        data: { label: 'Seleciona PIX / Cartão de Crédito', styleOverride: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' } }
      },
      {
        id: 'antifraud',
        type: 'decision',
        position: { x: 310, y: 350 },
        data: { label: 'Antifraude Aprovado?', styleOverride: { backgroundColor: '#fef9c3', borderColor: '#eab308' } }
      },
      {
        id: 'cancel_order',
        type: 'end',
        position: { x: 580, y: 371 },
        data: { label: 'Pedido Cancelado / Estorno', styleOverride: { backgroundColor: '#fee2e2', borderColor: '#ef4444' } }
      },
      {
        id: 'gateway_charge',
        type: 'subprocess',
        position: { x: 300, y: 490 },
        data: { label: 'Cobrança no Gateway (Stripe/Pix)', styleOverride: { backgroundColor: '#e0e7ff', borderColor: '#6366f1' } }
      },
      {
        id: 'fiscal_doc',
        type: 'document',
        position: { x: 310, y: 600 },
        data: { label: 'Emissão de Nota Fiscal (NF-e)', styleOverride: { backgroundColor: '#ffedd5', borderColor: '#f97316' } }
      },
      {
        id: 'logistics_hub',
        type: 'process',
        position: { x: 300, y: 710 },
        data: { label: 'Separação no Centro de Distribuição', styleOverride: { backgroundColor: '#f0fdf4', borderColor: '#16a34a' } }
      },
      {
        id: 'order_success',
        type: 'end',
        position: { x: 320, y: 820 },
        data: { label: 'E-mail de Rastreio Enviado', styleOverride: { backgroundColor: '#dcfce7', borderColor: '#22c55e' } }
      }
    ],
    edges: [
      { id: 'c1', source: 'start_cart', target: 'calc_freight', sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'c2', source: 'calc_freight', target: 'select_payment', sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'c3', source: 'select_payment', target: 'antifraud', sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'c4', source: 'antifraud', target: 'gateway_charge', sourceHandle: 'bottom', targetHandle: 'top', label: 'Aprovado', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'c5', source: 'antifraud', target: 'cancel_order', sourceHandle: 'right', targetHandle: 'left', label: 'Reprovado', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'c6', source: 'gateway_charge', target: 'fiscal_doc', sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'c7', source: 'fiscal_doc', target: 'logistics_hub', sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'c8', source: 'logistics_hub', target: 'order_success', sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } }
    ]
  },
  {
    id: 'cicd_pipeline',
    name: 'Pipeline CI/CD & Deploy Cloud',
    category: 'DevOps & Nuvem',
    description: 'Pipeline de build, testes unitários, validação de lint, imagem Docker e deploy em produção.',
    icon: 'GitBranch',
    nodes: [
      {
        id: 'git_push',
        type: 'start',
        position: { x: 50, y: 196 },
        data: { label: 'Git Push main', styleOverride: { backgroundColor: '#dcfce7', borderColor: '#22c55e' } }
      },
      {
        id: 'run_tests',
        type: 'process',
        position: { x: 260, y: 192 },
        data: { label: 'Executa Testes & Lint', styleOverride: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' } }
      },
      {
        id: 'tests_pass',
        type: 'decision',
        position: { x: 510, y: 175 },
        data: { label: 'Build & Testes OK?', styleOverride: { backgroundColor: '#fef9c3', borderColor: '#eab308' } }
      },
      {
        id: 'notify_fail',
        type: 'process',
        position: { x: 500, y: 340 },
        data: { label: 'Notifica Slack / Discord Falha', styleOverride: { backgroundColor: '#fee2e2', borderColor: '#ef4444' } }
      },
      {
        id: 'build_docker',
        type: 'subprocess',
        position: { x: 750, y: 192 },
        data: { label: 'Gera Docker Image & Push Registry', styleOverride: { backgroundColor: '#e0e7ff', borderColor: '#6366f1' } }
      },
      {
        id: 'deploy_prod',
        type: 'cloud',
        position: { x: 1000, y: 190 },
        data: { label: 'Cloud Run Deploy', styleOverride: { backgroundColor: '#ede9fe', borderColor: '#8b5cf6' } }
      },
      {
        id: 'deploy_success',
        type: 'end',
        position: { x: 1240, y: 196 },
        data: { label: 'Produção Online (v1.2.0)', styleOverride: { backgroundColor: '#dcfce7', borderColor: '#22c55e' } }
      }
    ],
    edges: [
      { id: 'p1', source: 'git_push', target: 'run_tests', sourceHandle: 'right', targetHandle: 'left', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'p2', source: 'run_tests', target: 'tests_pass', sourceHandle: 'right', targetHandle: 'left', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'p3', source: 'tests_pass', target: 'build_docker', sourceHandle: 'right', targetHandle: 'left', label: 'Sucesso', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'p4', source: 'tests_pass', target: 'notify_fail', sourceHandle: 'bottom', targetHandle: 'top', label: 'Falhou', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'p5', source: 'build_docker', target: 'deploy_prod', sourceHandle: 'right', targetHandle: 'left', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'p6', source: 'deploy_prod', target: 'deploy_success', sourceHandle: 'right', targetHandle: 'left', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } }
    ]
  },
  {
    id: 'swimlane_flow',
    name: 'Fluxo em Swimlanes (Multi-Departamentos)',
    category: 'Processos & Negócios',
    description: 'Processo distribuído entre Cliente, Suporte e Time Técnico de Engenharia.',
    icon: 'Columns',
    nodes: [
      {
        id: 'swimlane_1',
        type: 'swimlane',
        position: { x: 50, y: 50 },
        data: { label: '👤 Cliente (Usuário Final)', width: 900, height: 180, styleOverride: { backgroundColor: '#f8fafc' } }
      },
      {
        id: 'swimlane_2',
        type: 'swimlane',
        position: { x: 50, y: 250 },
        data: { label: '🎧 Suporte & Atendimento', width: 900, height: 180, styleOverride: { backgroundColor: '#f0fdf4' } }
      },
      {
        id: 'swimlane_3',
        type: 'swimlane',
        position: { x: 50, y: 450 },
        data: { label: '💻 Engenharia / Desenvolvedor', width: 900, height: 180, styleOverride: { backgroundColor: '#eff6ff' } }
      },
      {
        id: 'user_ticket',
        type: 'start',
        position: { x: 100, y: 116 },
        data: { label: 'Abre Ticket de Dúvida', styleOverride: { backgroundColor: '#dcfce7', borderColor: '#22c55e' } }
      },
      {
        id: 'support_triage',
        type: 'process',
        position: { x: 280, y: 312 },
        data: { label: 'Triagem & Diagnóstico Inicial', styleOverride: { backgroundColor: '#ffffff', borderColor: '#16a34a' } }
      },
      {
        id: 'is_bug',
        type: 'decision',
        position: { x: 530, y: 295 },
        data: { label: 'É Bug Crítico?', styleOverride: { backgroundColor: '#fef9c3', borderColor: '#eab308' } }
      },
      {
        id: 'support_reply',
        type: 'process',
        position: { x: 520, y: 112 },
        data: { label: 'Envia Instrução de Uso ao Cliente', styleOverride: { backgroundColor: '#ffffff', borderColor: '#22c55e' } }
      },
      {
        id: 'dev_fix',
        type: 'process',
        position: { x: 740, y: 512 },
        data: { label: 'Correção de Código & Hotfix', styleOverride: { backgroundColor: '#ffffff', borderColor: '#3b82f6' } }
      },
      {
        id: 'resolved',
        type: 'end',
        position: { x: 760, y: 116 },
        data: { label: 'Ticket Concluído & Avaliado', styleOverride: { backgroundColor: '#dcfce7', borderColor: '#22c55e' } }
      }
    ],
    edges: [
      { id: 'sw1', source: 'user_ticket', target: 'support_triage', sourceHandle: 'right', targetHandle: 'left', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'sw2', source: 'support_triage', target: 'is_bug', sourceHandle: 'right', targetHandle: 'left', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'sw3', source: 'is_bug', target: 'support_reply', sourceHandle: 'top', targetHandle: 'bottom', label: 'Não (Dúvida)', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'sw4', source: 'is_bug', target: 'dev_fix', sourceHandle: 'bottom', targetHandle: 'top', label: 'Sim (Bug)', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'sw5', source: 'support_reply', target: 'resolved', sourceHandle: 'right', targetHandle: 'left', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } },
      { id: 'sw6', source: 'dev_fix', target: 'resolved', sourceHandle: 'top', targetHandle: 'bottom', label: 'Deploy Realizado', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' }, style: { stroke: '#0f172a', strokeWidth: 2 } }
    ]
  }
];
