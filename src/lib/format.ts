export function formatMoney(amount: number | null | undefined, currency: string | null | undefined = "EUR") {
  if (amount == null || isNaN(Number(amount))) return "—";
  const cur = (currency || "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat("nl-BE", { style: "currency", currency: cur }).format(Number(amount));
  } catch {
    return `${cur} ${Number(amount).toFixed(2)}`;
  }
}
