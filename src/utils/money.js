export const formatMoney = (val) =>
  (typeof val === 'number' ? val : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const parseMoneyInput = (str) => {
  if (!str || typeof str !== 'string') return 0;
  const cleaned = str.replace(/\D/g, '');
  if (cleaned === '') return 0;
  return parseInt(cleaned, 10) / 100;
};

export const parseAmountField = (amount) =>
  parseFloat(amount.replace(/\./g, '').replace(',', '.'));
