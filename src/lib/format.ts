export const EUR_RATES: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  CHF: 1.07,
  CAD: 0.67,
  AUD: 0.6,
  NZD: 0.55,
  JPY: 0.0059,
  CNY: 0.13,
  HKD: 0.12,
  SGD: 0.71,
  DKK: 0.134,
  NOK: 0.086,
  SEK: 0.091,
  PLN: 0.235,
  CZK: 0.041,
  HUF: 0.0026,
  RON: 0.2,
  TRY: 0.024,
  INR: 0.011,
  IDR: 0.000056,
  VND: 0.000035,
  KRW: 0.00063,
  THB: 0.025,
  MXN: 0.05,
  BRL: 0.16,
  ZAR: 0.051,
  CLP: 0.00094,
  COP: 0.00023,
  ARS: 0.00079,
  AED: 0.25,
  SAR: 0.25,
  BBD: 0.46,
};

export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined = "EUR",
) {
  if (amount == null || isNaN(Number(amount))) return "—";
  const cur = (currency || "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat("nl-BE", { style: "currency", currency: cur }).format(
      Number(amount),
    );
  } catch {
    return `${cur} ${Number(amount).toFixed(2)}`;
  }
}

export function estimateEuro(
  amount: number | null | undefined,
  currency: string | null | undefined = "EUR",
) {
  if (amount == null || isNaN(Number(amount))) return null;
  const cur = (currency || "EUR").toUpperCase();
  const rate = EUR_RATES[cur];
  if (!rate) return Number(amount);
  return Number(amount) * rate;
}

export function formatWithEuroEstimate(
  amount: number | null | undefined,
  currency: string | null | undefined = "EUR",
) {
  const cur = (currency || "EUR").toUpperCase();
  const original = formatMoney(amount, cur);
  if (amount == null || cur === "EUR") return original;
  const euro = estimateEuro(amount, cur);
  return euro == null ? original : `${original} · ≈ ${formatMoney(euro, "EUR")}`;
}
