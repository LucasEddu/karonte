import { createActivityLog } from '../services/activityService.js';

export const ACTIVITY_TYPES = {
  TRANSACTION_CREATED: 'transaction_created',
  TRANSACTION_UPDATED: 'transaction_updated',
  TRANSACTION_DELETED: 'transaction_deleted',
  TASK_CREATED: 'task_created',
  TASK_COMPLETED: 'task_completed',
  TASK_UPDATED: 'task_updated',
  TASK_DELETED: 'task_deleted',
  TASK_PAYMENT: 'task_payment',
  BUDGET_UPDATED: 'budget_updated',
  CARD_CREATED: 'card_created',
  CARD_DELETED: 'card_deleted',
  COLLABORATOR_JOINED: 'collaborator_joined',
  INVITE_SENT: 'invite_sent',
  INVITE_ACCEPTED: 'invite_accepted',
  INVITE_REJECTED: 'invite_rejected',
  IMPORT_COMPLETED: 'import_completed',
  IMPORT_UNDONE: 'import_undone',
};

const formatMoney = (val) =>
  (Number(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const buildActivityMessage = (type, actorName, metadata = {}) => {
  const who = actorName || 'Alguém';
  switch (type) {
    case ACTIVITY_TYPES.TRANSACTION_CREATED:
      return `${who} adicionou uma ${metadata.type === 'income' ? 'receita' : 'despesa'} de R$ ${formatMoney(metadata.amount)} em ${metadata.categoryName || 'Outros'}`;
    case ACTIVITY_TYPES.TRANSACTION_UPDATED:
      return `${who} editou um lançamento de R$ ${formatMoney(metadata.amount)}`;
    case ACTIVITY_TYPES.TRANSACTION_DELETED:
      return `${who} excluiu o lançamento "${metadata.description || ''}"`;
    case ACTIVITY_TYPES.TASK_CREATED:
      return `${who} criou a tarefa "${metadata.title || ''}"`;
    case ACTIVITY_TYPES.TASK_COMPLETED:
      return `${who} concluiu a tarefa "${metadata.title || ''}"`;
    case ACTIVITY_TYPES.TASK_UPDATED:
      return `${who} editou a tarefa "${metadata.title || ''}"`;
    case ACTIVITY_TYPES.TASK_DELETED:
      return `${who} excluiu a tarefa "${metadata.title || ''}"`;
    case ACTIVITY_TYPES.TASK_PAYMENT:
      return `${who} registrou pagamento de R$ ${formatMoney(metadata.amount)} na tarefa "${metadata.title || ''}"`;
    case ACTIVITY_TYPES.BUDGET_UPDATED:
      return `${who} alterou o orçamento de ${metadata.categoryName || 'categoria'}`;
    case ACTIVITY_TYPES.CARD_CREATED:
      return `${who} adicionou o cartão "${metadata.name || ''}"`;
    case ACTIVITY_TYPES.CARD_DELETED:
      return `${who} removeu o cartão "${metadata.name || ''}"`;
    case ACTIVITY_TYPES.COLLABORATOR_JOINED:
      return `${who} entrou no projeto`;
    case ACTIVITY_TYPES.INVITE_SENT:
      return `${who} enviou convite para ${metadata.toEmail || 'colaborador'}`;
    case ACTIVITY_TYPES.INVITE_ACCEPTED:
      return `${who} aceitou convite para o projeto`;
    case ACTIVITY_TYPES.INVITE_REJECTED:
      return `${who} rejeitou convite para o projeto`;
    case ACTIVITY_TYPES.IMPORT_COMPLETED:
      return `${who} importou ${metadata.count || 0} transação(ões) de extrato PDF`;
    case ACTIVITY_TYPES.IMPORT_UNDONE:
      return `${who} desfez importação de extrato (${metadata.count || 0} itens)`;
    default:
      return `${who} realizou uma ação`;
  }
};

export const entityTypeFromActivity = (type) => {
  if (type.startsWith('transaction')) return 'transaction';
  if (type.startsWith('task')) return 'task';
  if (type.startsWith('import')) return 'import';
  if (type.includes('invite') || type.includes('collaborator')) return 'project';
  if (type.includes('budget')) return 'budget';
  if (type.includes('card')) return 'credit_card';
  return 'other';
};

export const filterActivityLogs = (logs, filter) => {
  if (filter === 'all') return logs;
  if (filter === 'transactions') return logs.filter((l) => l.entityType === 'transaction');
  if (filter === 'tasks') return logs.filter((l) => l.entityType === 'task');
  if (filter === 'projects') return logs.filter((l) => l.entityType === 'project');
  if (filter === 'imports') return logs.filter((l) => l.entityType === 'import');
  if (filter === 'budgets') return logs.filter((l) => l.entityType === 'budget' || l.entityType === 'credit_card');
  return logs;
};

export const groupActivityLogsByDate = (logs) => {
  const groups = {};
  for (const log of logs) {
    const key = String(log.createdAt || '').slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(log);
  }
  return groups;
};

export const formatRelativeTime = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} hora${hours > 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} dia${days > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR');
};

export const logActivity = async ({
  userId,
  projectId = null,
  actorUid,
  actorName,
  type,
  entityId = null,
  metadata = {},
}) => {
  const message = buildActivityMessage(type, actorName, metadata);
  return createActivityLog({
    userId,
    projectId,
    actorUid,
    actorName,
    type,
    entityType: entityTypeFromActivity(type),
    entityId,
    message,
    metadata,
  });
};
