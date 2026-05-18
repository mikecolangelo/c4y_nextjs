export const formatCurrency = (
  value: number,
  {
    locale = "es-PA",
    currency = "PAB",
    maximumFractionDigits = 0,
  }: {
    locale?: string;
    currency?: string;
    maximumFractionDigits?: number;
  } = {}
) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(value);





