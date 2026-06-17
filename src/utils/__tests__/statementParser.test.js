import { describe, it, expect } from 'vitest';
import {
  normalizeMoney,
  normalizeDate,
  detectTransactionType,
  createTransactionHash,
  parseStatementText,
  parseMultipleStatementTexts,
  markDuplicates,
  descriptionsAreSimilar,
} from '../statementParser.js';
import { inferCategory } from '../categoryDetection.js';

describe('normalizeMoney', () => {
  it('parseia valor com R$', () => {
    expect(normalizeMoney('R$ 89,90')).toBe(89.9);
  });

  it('parseia valor negativo como absoluto', () => {
    expect(normalizeMoney('-89,90')).toBe(89.9);
  });

  it('parseia valor entre parênteses', () => {
    expect(normalizeMoney('(89,90)')).toBe(89.9);
  });

  it('parseia valor com milhar', () => {
    expect(normalizeMoney('1.234,56')).toBe(1234.56);
  });
});

describe('normalizeDate', () => {
  it('parseia DD/MM/YYYY', () => {
    const date = normalizeDate('15/03/2026');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(15);
  });

  it('usa ano de referência em DD/MM', () => {
    const date = normalizeDate('10/06', 2025);
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(10);
  });
});

describe('detectTransactionType', () => {
  it('identifica PIX enviado como despesa', () => {
    expect(detectTransactionType('15/03 PIX enviado mercado', '-50,00')).toBe('expense');
  });

  it('identifica PIX recebido como receita', () => {
    expect(detectTransactionType('15/03 PIX recebido cliente', '500,00')).toBe('income');
  });

  it('identifica compra no cartão como despesa', () => {
    expect(detectTransactionType('15/03 COMPRA CARTAO LOJA', '120,00')).toBe('expense');
  });

  it('identifica salário como receita', () => {
    expect(detectTransactionType('05/03 SALARIO FOLHA', '3500,00')).toBe('income');
  });

  it('valor negativo indica despesa', () => {
    expect(detectTransactionType('15/03 TRANSFERENCIA', '-89,90')).toBe('expense');
  });
});

describe('parseStatementText', () => {
  const sampleText = `
    EXTRATO BANCARIO
    10/06/2026 PIX MERCADO SAO LUIZ -89,90
    11/06/2026 PIX RECEBIDO CLIENTE 500,00
    12/06/2026 COMPRA CARTAO RESTAURANTE 45,50
    05/06/2026 SALARIO EMPRESA 3500,00
  `;

  it('extrai transações de texto de extrato', () => {
    const txs = parseStatementText(sampleText, { referenceYear: 2026 });
    expect(txs.length).toBeGreaterThanOrEqual(3);
    expect(txs.some((t) => t.description.toLowerCase().includes('mercado'))).toBe(true);
  });

  it('infere categoria automática via categoryDetection', () => {
    const txs = parseStatementText('10/06/2026 PIX MERCADO EXTRA 50,00', { referenceYear: 2026 });
    expect(txs[0].category).toBe('Alimentação');
    expect(inferCategory('mercado extra', 'expense', {})).toBe('Alimentação');
  });
});

describe('parseMultipleStatementTexts', () => {
  it('processa múltiplos textos', () => {
    const results = parseMultipleStatementTexts(
      [
        { fileName: 'a.pdf', text: '10/06/2026 PIX LOJA 10,00' },
        { fileName: 'b.pdf', text: '11/06/2026 SALARIO 1000,00' },
      ],
      { referenceYear: 2026 }
    );
    expect(results).toHaveLength(2);
    expect(results[0].fileName).toBe('a.pdf');
    expect(results[0].transactions).toHaveLength(1);
    expect(results[1].transactions[0].type).toBe('income');
  });
});

describe('createTransactionHash e duplicidade', () => {
  it('gera hash estável', () => {
    const date = new Date(2026, 5, 10, 12, 0, 0);
    const hash = createTransactionHash({
      date,
      amount: 89.9,
      description: 'PIX Mercado Sao Luiz',
    });
    expect(hash).toMatch(/^2026-06-10\|89\.90\|/);
    expect(hash).toContain('pixmercadosaoluiz');
  });

  it('marca duplicata exata como desmarcada', () => {
    const existing = [
      {
        date: '2026-06-10T12:00:00.000Z',
        amount: 89.9,
        description: 'PIX Mercado Sao Luiz',
      },
    ];
    const parsed = [
      {
        date: new Date(2026, 5, 10, 12, 0, 0),
        amount: 89.9,
        description: 'PIX Mercado Sao Luiz',
      },
    ];
    const marked = markDuplicates(parsed, existing);
    expect(marked[0].isDuplicate).toBe(true);
    expect(marked[0].selected).toBe(false);
  });

  it('marca possível duplicata por descrição parecida', () => {
    const existing = [
      {
        date: '2026-06-10T12:00:00.000Z',
        amount: 89.9,
        description: 'PIX Mercado Sao Luiz',
      },
    ];
    const parsed = [
      {
        date: new Date(2026, 5, 10, 12, 0, 0),
        amount: 89.9,
        description: 'PIX Mercado Sao Lu',
      },
    ];
    const marked = markDuplicates(parsed, existing);
    expect(marked[0].isPossibleDuplicate).toBe(true);
    expect(marked[0].selected).toBe(false);
  });

  it('descriptionsAreSimilar detecta variações', () => {
    expect(descriptionsAreSimilar('PIX Mercado Sao Luiz', 'PIX Mercado Sao Lu')).toBe(true);
    expect(descriptionsAreSimilar('Uber viagem', 'Netflix assinatura')).toBe(false);
  });
});
