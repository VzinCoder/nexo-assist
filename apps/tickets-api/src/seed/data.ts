import { computeDueAt, isOverdue, type TicketPriority, type TicketStatus } from "@nexo/shared";
import type { NewTicketCommentRow, NewTicketRow } from "../db/schema";
import type { ArticleRow, EmployeeRow } from "../db/schema";

/** Funcionária principal dos cenários (a do protótipo). */
export const MAIN_EMPLOYEE_ID = "emp-001";
/** Outra funcionária com chamados (inclui um parecido com o da principal). */
export const OTHER_EMPLOYEE_ID = "emp-002";
/** Funcionária sem nenhum chamado. */
export const EMPLOYEE_WITHOUT_TICKETS_ID = "emp-005";
export const ANALYST_N1_ID = "emp-101";
export const ANALYST_N2_ID = "emp-102";

/** Ids fixos dos cenários do seed. */
export const SEED_TICKETS = {
  overdue: "INC-20311",
  onTime: "REQ-10442",
  reopenable: "INC-20150",
  resolvedLongAgo: "INC-19877",
  closed: "INC-19410",
  highOpen: "INC-20298",
  otherSimilar: "INC-20305",
  otherRequest: "REQ-10440",
} as const;

export type SeedData = {
  employees: EmployeeRow[];
  articles: ArticleRow[];
  tickets: NewTicketRow[];
  comments: Array<Omit<NewTicketCommentRow, "id">>;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const employees: EmployeeRow[] = [
  {
    id: MAIN_EMPLOYEE_ID,
    name: "Ana Souza",
    email: "ana.souza@nexo.com.br",
    department: "Financeiro",
    role: "employee",
  },
  {
    id: OTHER_EMPLOYEE_ID,
    name: "Carla Mendes",
    email: "carla.mendes@nexo.com.br",
    department: "Comercial",
    role: "employee",
  },
  {
    id: "emp-003",
    name: "Bruno Tavares",
    email: "bruno.tavares@nexo.com.br",
    department: "Marketing",
    role: "employee",
  },
  {
    id: "emp-004",
    name: "Diego Ramos",
    email: "diego.ramos@nexo.com.br",
    department: "Logística",
    role: "employee",
  },
  {
    id: EMPLOYEE_WITHOUT_TICKETS_ID,
    name: "Elisa Prado",
    email: "elisa.prado@nexo.com.br",
    department: "Jurídico",
    role: "employee",
  },
  {
    id: ANALYST_N1_ID,
    name: "Juliana Alves",
    email: "juliana.alves@nexo.com.br",
    department: "Suporte N1",
    role: "analyst_n1",
  },
  {
    id: ANALYST_N2_ID,
    name: "Rafael Lima",
    email: "rafael.lima@nexo.com.br",
    department: "Suporte N2",
    role: "analyst_n2",
  },
];

const articles: ArticleRow[] = [
  {
    id: "kb-001",
    title: "VPN com erro 809",
    content:
      "O erro 809 indica que a conexão VPN foi bloqueada antes de autenticar. No Windows 10: " +
      "reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Esta solução " +
      "vale só para Windows 10. No Windows 11, não tente reinstalar: abra um chamado na categoria " +
      "Rede e VPN.",
    tags: ["vpn", "rede", "erro 809", "windows"],
  },
  {
    id: "kb-002",
    title: "Horário do service desk",
    content:
      "O service desk de TI atende de segunda a sexta, das 8h às 18h (horário de Brasília). " +
      "Chamados críticos, que param uma equipe ou a empresa, têm plantão 24 horas pelo ramal 4000.",
    tags: ["horário", "atendimento", "plantão"],
  },
  {
    id: "kb-003",
    title: "Redefinir a senha da rede",
    content:
      "Acesse o portal de senhas pela intranet, informe seu e-mail corporativo e siga o link " +
      "enviado. A nova senha precisa ter 12 caracteres e vale também para o e-mail e a VPN. " +
      "Se a conta estiver bloqueada, aguarde 15 minutos ou abra um chamado de Acesso.",
    tags: ["senha", "acesso", "bloqueio"],
  },
  {
    id: "kb-004",
    title: "Configurar o e-mail corporativo no celular",
    content:
      "Instale o aplicativo Outlook, entre com o e-mail corporativo e aprove o acesso no " +
      "autenticador. Se o e-mail não sincronizar, remova a conta, reinicie o celular e adicione de novo.",
    tags: ["e-mail", "outlook", "celular"],
  },
  {
    id: "kb-005",
    title: "Notebook lento: o que fazer antes de abrir chamado",
    content:
      "Reinicie o notebook, feche abas e programas que não está usando e rode o diagnóstico da " +
      "central de software. Depois de uma atualização do Windows, a lentidão pode durar algumas " +
      "horas. Se continuar lento no dia seguinte, abra um chamado de Hardware.",
    tags: ["notebook", "lentidão", "hardware", "windows"],
  },
  {
    id: "kb-006",
    title: "Pedir acesso a pastas e ao SharePoint",
    content:
      "Acesso a pastas de rede e sites do SharePoint é uma requisição de Acesso. Informe a pasta " +
      "ou o site e o nível (leitura ou edição); o gestor da área precisa aprovar antes da liberação.",
    tags: ["acesso", "sharepoint", "pasta"],
  },
  {
    id: "kb-007",
    title: "Impressora não imprime",
    content:
      "Confira se a impressora está ligada e conectada à rede, remova trabalhos travados da fila e " +
      "imprima de novo. Se aparecer erro de papel ou toner, avise a recepção do andar.",
    tags: ["impressora", "hardware"],
  },
  {
    id: "kb-008",
    title: "Solicitar equipamento (monitor, teclado, headset)",
    content:
      "Equipamentos são requisições de Hardware com prioridade baixa. Informe o item e se é para o " +
      "escritório ou home office; a entrega leva até 5 dias úteis após a aprovação do gestor.",
    tags: ["equipamento", "monitor", "home office", "requisição"],
  },
];

type TicketSeed = Omit<NewTicketRow, "dueAt" | "resolvedAt"> & {
  status: TicketStatus;
  priority: TicketPriority;
  resolvedAt: Date | null;
};

function withDueAt(ticket: TicketSeed): NewTicketRow {
  return { ...ticket, dueAt: computeDueAt(ticket.priority, ticket.updatedAt) };
}

/**
 * Monta todas as linhas do seed com datas relativas a `now`. Puro: o mesmo `now` gera o mesmo
 * conteúdo. As situações (vencido, no prazo, reabrível...) valem para qualquer hora da semana.
 */
export function buildSeed(now: Date): SeedData {
  const ago = (ms: number) => new Date(now.getTime() - ms);

  // REQ-10442 é registrado há 5 dias corridos, ou há 4 se 5 dias já o deixassem vencido.
  const reqBase = {
    priority: "low" as const,
    status: "approved" as const,
  };
  let reqUpdatedAt = ago(5 * DAY);
  if (isOverdue({ ...reqBase, dueAt: computeDueAt(reqBase.priority, reqUpdatedAt) }, now)) {
    reqUpdatedAt = ago(4 * DAY);
  }

  const tickets: NewTicketRow[] = [
    withDueAt({
      id: SEED_TICKETS.overdue,
      type: "INC",
      title: "Notebook lento após atualização do Windows",
      description:
        "Lentidão geral desde a atualização do Windows. Reiniciar e rodar o diagnóstico da " +
        "central não resolveu.",
      category: "hardware",
      priority: "medium",
      status: "waiting_analyst",
      affected: "me",
      employeeId: MAIN_EMPLOYEE_ID,
      createdAt: ago(8 * DAY),
      updatedAt: ago(6 * DAY),
      resolvedAt: null,
    }),
    withDueAt({
      id: SEED_TICKETS.onTime,
      type: "REQ",
      title: "Segundo monitor para home office",
      description: "Preciso de um segundo monitor para trabalhar com planilhas em home office.",
      category: "hardware",
      ...reqBase,
      affected: "me",
      employeeId: MAIN_EMPLOYEE_ID,
      createdAt: ago(9 * DAY),
      updatedAt: reqUpdatedAt,
      resolvedAt: null,
    }),
    withDueAt({
      id: SEED_TICKETS.reopenable,
      type: "INC",
      title: "Senha do SAP bloqueada",
      description: "A senha do SAP bloqueou depois de três tentativas e não consigo lançar notas.",
      category: "access",
      priority: "medium",
      status: "resolved",
      affected: "me",
      employeeId: MAIN_EMPLOYEE_ID,
      createdAt: ago(6 * DAY),
      updatedAt: ago(4 * DAY),
      resolvedAt: ago(4 * DAY),
    }),
    withDueAt({
      id: SEED_TICKETS.resolvedLongAgo,
      type: "INC",
      title: "Outlook não sincroniza no celular",
      description: "O e-mail corporativo parou de sincronizar no aplicativo do celular.",
      category: "email",
      priority: "low",
      status: "resolved",
      affected: "me",
      employeeId: MAIN_EMPLOYEE_ID,
      createdAt: ago(12 * DAY),
      updatedAt: ago(10 * DAY),
      resolvedAt: ago(10 * DAY),
    }),
    withDueAt({
      id: SEED_TICKETS.closed,
      type: "INC",
      title: "Troca de senha da rede",
      description: "Senha da rede expirou e o portal não aceitava a nova senha.",
      category: "access",
      priority: "medium",
      status: "closed",
      affected: "me",
      employeeId: MAIN_EMPLOYEE_ID,
      createdAt: ago(122 * DAY),
      updatedAt: ago(120 * DAY),
      resolvedAt: ago(121 * DAY),
    }),
    withDueAt({
      id: SEED_TICKETS.highOpen,
      type: "INC",
      title: "Acesso à pasta Financeiro no SharePoint",
      description:
        "Perdi o acesso à pasta Financeiro no SharePoint e preciso fechar o relatório de hoje.",
      category: "access",
      priority: "high",
      status: "open",
      affected: "me",
      employeeId: MAIN_EMPLOYEE_ID,
      createdAt: ago(1 * HOUR),
      updatedAt: ago(1 * HOUR),
      resolvedAt: null,
    }),
    withDueAt({
      id: SEED_TICKETS.otherSimilar,
      type: "INC",
      title: "Notebook lento ao abrir planilhas",
      description: "O notebook fica lento sempre que abro planilhas grandes no Excel.",
      category: "hardware",
      priority: "medium",
      status: "open",
      affected: "me",
      employeeId: OTHER_EMPLOYEE_ID,
      createdAt: ago(2 * DAY),
      updatedAt: ago(2 * DAY),
      resolvedAt: null,
    }),
    withDueAt({
      id: SEED_TICKETS.otherRequest,
      type: "REQ",
      title: "Licença do Adobe Illustrator",
      description: "Preciso de licença do Illustrator para a campanha do próximo mês.",
      category: "software",
      priority: "low",
      status: "in_progress",
      affected: "me",
      employeeId: "emp-003",
      createdAt: ago(3 * DAY),
      updatedAt: ago(1 * DAY),
      resolvedAt: null,
    }),
  ];

  const comments: SeedData["comments"] = [
    {
      ticketId: SEED_TICKETS.overdue,
      authorId: MAIN_EMPLOYEE_ID,
      kind: "comment",
      text: "Continua lento mesmo depois de reiniciar.",
      createdAt: ago(7 * DAY),
    },
    {
      ticketId: SEED_TICKETS.overdue,
      authorId: ANALYST_N1_ID,
      kind: "escalation",
      text: "Motivo: precisa de análise do driver de vídeo.\nResumo: lentidão geral após atualização; diagnóstico da central sem erros.",
      createdAt: ago(6 * DAY),
    },
    {
      ticketId: SEED_TICKETS.onTime,
      authorId: ANALYST_N1_ID,
      kind: "comment",
      text: "Pedido aprovado pelo gestor. Entrega agendada.",
      createdAt: reqUpdatedAt,
    },
    {
      ticketId: SEED_TICKETS.reopenable,
      authorId: ANALYST_N1_ID,
      kind: "comment",
      text: "Senha desbloqueada. Teste o acesso e nos avise se voltar a bloquear.",
      createdAt: ago(4 * DAY),
    },
    {
      ticketId: SEED_TICKETS.otherSimilar,
      authorId: OTHER_EMPLOYEE_ID,
      kind: "comment",
      text: "Fica pior com mais de uma planilha aberta.",
      createdAt: ago(2 * DAY),
    },
    {
      ticketId: SEED_TICKETS.otherRequest,
      authorId: ANALYST_N2_ID,
      kind: "comment",
      text: "Licença em compra; aguardando o fornecedor.",
      createdAt: ago(1 * DAY),
    },
  ];

  return { employees, articles, tickets, comments };
}
