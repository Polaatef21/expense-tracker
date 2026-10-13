// Date helpers that work in the user's LOCAL calendar (not UTC), so "today"
// and "this month" match what the user sees on their own clock.
const pad = (n) => String(n).padStart(2, '0');

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayISO = (now = new Date()) => toISODate(now);

const startOfMonth = (now, monthsBack = 0) => new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

export const PERIODS = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-3-months', label: 'Last 3 months' },
  { id: 'last-6-months', label: 'Last 6 months' },
  { id: 'this-year', label: 'This year' },
  { id: 'last-12-months', label: 'Last 12 months' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom range' },
];

// Returns { startDate, endDate } (YYYY-MM-DD or undefined for open ends).
// "Last N months" includes the current month.
export function periodRange(periodId, now = new Date(), custom = {}) {
  const today = toISODate(now);
  switch (periodId) {
    case 'this-month':
      return { startDate: toISODate(startOfMonth(now)), endDate: today };
    case 'last-3-months':
      return { startDate: toISODate(startOfMonth(now, 2)), endDate: today };
    case 'last-6-months':
      return { startDate: toISODate(startOfMonth(now, 5)), endDate: today };
    case 'last-12-months':
      return { startDate: toISODate(startOfMonth(now, 11)), endDate: today };
    case 'this-year':
      return { startDate: `${now.getFullYear()}-01-01`, endDate: today };
    case 'custom':
      return { startDate: custom.startDate || undefined, endDate: custom.endDate || undefined };
    case 'all':
    default:
      return { startDate: undefined, endDate: undefined };
  }
}
