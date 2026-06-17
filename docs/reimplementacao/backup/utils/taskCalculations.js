export const computeParcelaValue = (meta, parcelas) =>
  meta > 0 && parcelas > 0 ? meta / parcelas : 0;

export const computeParcelasPagas = (paidAmount, parcelaValue, parcelas) =>
  parcelaValue > 0 ? Math.min(parcelas, Math.floor((paidAmount + 1e-9) / parcelaValue)) : 0;

export const computeParcelasRestantes = (parcelas, parcelasPagas) =>
  parcelas > 0 ? Math.max(0, parcelas - parcelasPagas) : 0;

export const computeTaskProgressPct = (task) => {
  const meta = Number(task.metaValue) || 0;
  const paid = Number(task.paidAmount) || 0;
  const isDespesa = task.type === 'despesa';

  if (meta > 0) {
    if (isDespesa) return Math.min(100, (paid / meta) * 100);
    return task.completed ? 100 : Math.min(100, (paid / meta) * 100);
  }
  return task.completed ? 100 : 0;
};

export const resolveTaskMetaValue = (metaFromInput, parcelas, parcelaFromInput) =>
  metaFromInput > 0
    ? metaFromInput
    : parcelas > 0 && parcelaFromInput > 0
      ? parcelas * parcelaFromInput
      : 0;

export const computeInitialPaidAmount = (parcelas, parcelaFromInput, parcelasPagas) =>
  parcelas > 0 && parcelaFromInput > 0 && parcelasPagas > 0
    ? Math.min(parcelasPagas, parcelas) * parcelaFromInput
    : null;
