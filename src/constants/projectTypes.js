export const PROJECT_TYPE_OPTIONS = [
  { id: 'default', label: 'Padrão' },
  { id: 'family', label: 'Família' },
  { id: 'couple', label: 'Casal' },
  { id: 'shared_house', label: 'República' },
  { id: 'trip', label: 'Viagem' },
];

export const DEFAULT_FAMILY_CONFIG = {
  monthlyIncomeMode: 'sum_members',
  manualMonthlyIncome: 0,
  showMemberContribution: true,
  showSettlement: true,
};

export const getProjectTypeLabel = (type) =>
  PROJECT_TYPE_OPTIONS.find((o) => o.id === type)?.label || 'Padrão';
