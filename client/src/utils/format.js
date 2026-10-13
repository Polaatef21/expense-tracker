// Display formatting. Amounts arrive from the API as exact decimal strings ("1234.50");
// they are only converted to numbers here, for display.
export const CURRENCY = import.meta.env.VITE_CURRENCY || 'USD';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMoney(value, { currency = CURRENCY, locale, signed = false } = {}) {
  const n = Number(value);
  const formatted = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Math.abs(n));
  if (n < 0) return `−${formatted}`;
  if (signed && n > 0) return `+${formatted}`;
  return formatted;
}

// 1,250 -> "$1.3K"; for chart axes
export function formatMoneyCompact(value, { currency = CURRENCY, locale } = {}) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value));
}

// "2026-03-15" -> "Mar 15, 2026" (parsed by hand: new Date('2026-03-15') is UTC
// and would show the previous day in time zones west of UTC)
export function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// "2026-03" -> "Mar 2026"
export function formatMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
