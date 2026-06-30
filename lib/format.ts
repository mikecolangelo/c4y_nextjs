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

/**
 * Build up to two uppercase initials from a person/display name.
 *
 * Null/empty safe and resilient to extra whitespace. Returns "" when there is
 * no usable input so callers can decide on a fallback (e.g. an icon).
 *
 * @example getInitials("John Doe")     // "JD"
 * @example getInitials("  ada  byron") // "AB"
 * @example getInitials("madonna")      // "M"
 * @example getInitials("")             // ""
 */
export const getInitials = (name: string | null | undefined): string => {
  if (!name) return "";

  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};
