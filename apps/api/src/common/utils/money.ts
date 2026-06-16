export function normalizeMoney(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return amount;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value: unknown) {
  const amount = normalizeMoney(value);
  return amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
