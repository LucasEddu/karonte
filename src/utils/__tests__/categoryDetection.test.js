import { describe, it, expect } from 'vitest';
import { inferCategory, findCustomCategoryInText } from '../categoryDetection.js';
import { buildInsightCacheId } from '../../services/insightService.js';

describe('categoryDetection', () => {
  it('infere categoria de despesa por regex compartilhada', () => {
    expect(inferCategory('mercado extra ontem', 'expense', {})).toBe('Alimentação');
    expect(inferCategory('uber para trabalho', 'expense', {})).toBe('Transporte');
  });

  it('reconhece categorias customizadas v2 por nome', () => {
    const custom = {
      expense: [{ id: 'expense-academia-1', name: 'Academia' }],
      income: [],
    };
    expect(findCustomCategoryInText('mensalidade academia', custom.expense)).toBe('Academia');
    expect(inferCategory('mensalidade academia', 'expense', custom)).toBe('Academia');
  });

  it('infere receita por regra de salário', () => {
    expect(inferCategory('salario mensal', 'income', {})).toBe('Salário');
  });
});

describe('insightService cache id', () => {
  it('inclui escopo de projeto na chave de cache', () => {
    expect(buildInsightCacheId('user1', 6, 2026, null)).toBe('user1_geral_6_2026');
    expect(buildInsightCacheId('user1', 6, 2026, 'proj-abc')).toBe('user1_proj-abc_6_2026');
  });
});
