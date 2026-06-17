import { describe, it, expect } from 'vitest';
import {
  buildActivityMessage,
  filterActivityLogs,
  groupActivityLogsByDate,
  ACTIVITY_TYPES,
} from '../activityLog.js';

describe('activityLog utils', () => {
  it('monta mensagem de transação criada', () => {
    const msg = buildActivityMessage(ACTIVITY_TYPES.TRANSACTION_CREATED, 'Lucas', {
      amount: 89.9,
      categoryName: 'Alimentação',
      type: 'expense',
    });
    expect(msg).toContain('Lucas');
    expect(msg).toContain('89,90');
    expect(msg).toContain('Alimentação');
  });

  it('filtra logs por tipo', () => {
    const logs = [
      { entityType: 'transaction', message: 'a' },
      { entityType: 'task', message: 'b' },
      { entityType: 'import', message: 'c' },
    ];
    expect(filterActivityLogs(logs, 'transactions')).toHaveLength(1);
    expect(filterActivityLogs(logs, 'tasks')).toHaveLength(1);
    expect(filterActivityLogs(logs, 'imports')).toHaveLength(1);
  });

  it('agrupa logs por data', () => {
    const logs = [
      { createdAt: '2026-06-10T10:00:00.000Z' },
      { createdAt: '2026-06-10T12:00:00.000Z' },
      { createdAt: '2026-06-11T09:00:00.000Z' },
    ];
    const grouped = groupActivityLogsByDate(logs);
    expect(grouped['2026-06-10']).toHaveLength(2);
    expect(grouped['2026-06-11']).toHaveLength(1);
  });
});
