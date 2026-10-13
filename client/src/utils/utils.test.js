import { describe, expect, it } from 'vitest';
import { groupCategories } from './chartData.js';
import { periodRange, todayISO, toISODate } from './dates.js';
import { filenameFromDisposition } from './download.js';
import { formatDate, formatMoney, formatMoneyCompact, formatMonth } from './format.js';
import { tokenExpiresAt } from './jwt.js';
import { validateRegistration, validateTransaction } from './validation.js';

describe('format', () => {
  it('formats money from exact decimal strings', () => {
    expect(formatMoney('1234.5', { currency: 'USD', locale: 'en-US' })).toBe('$1,234.50');
    expect(formatMoney('-20', { currency: 'USD', locale: 'en-US' })).toBe('−$20.00');
    expect(formatMoney('20', { currency: 'USD', locale: 'en-US', signed: true })).toBe('+$20.00');
    expect(formatMoney('0', { currency: 'USD', locale: 'en-US', signed: true })).toBe('$0.00');
  });

  it('formats compact axis labels', () => {
    expect(formatMoneyCompact(1250, { currency: 'USD', locale: 'en-US' })).toBe('$1.3K');
  });

  it('formats calendar dates without time-zone shifts', () => {
    expect(formatDate('2026-03-01')).toBe('Mar 1, 2026');
    expect(formatDate('2026-12-31')).toBe('Dec 31, 2026');
    expect(formatMonth('2026-01')).toBe('Jan 2026');
  });
});

describe('dates', () => {
  const now = new Date(2026, 9, 13, 23, 30); // Oct 13 2026, 23:30 local time

  it('uses the local calendar day', () => {
    expect(toISODate(now)).toBe('2026-10-13');
    expect(todayISO(now)).toBe('2026-10-13');
  });

  it.each([
    ['this-month', '2026-10-01'],
    ['last-3-months', '2026-08-01'],
    ['last-6-months', '2026-05-01'],
    ['last-12-months', '2025-11-01'],
    ['this-year', '2026-01-01'],
  ])('%s starts on %s and ends today', (period, start) => {
    expect(periodRange(period, now)).toEqual({ startDate: start, endDate: '2026-10-13' });
  });

  it('handles year boundaries', () => {
    expect(periodRange('last-3-months', new Date(2026, 0, 15)).startDate).toBe('2025-11-01');
  });

  it('returns open ranges for all-time and incomplete custom ranges', () => {
    expect(periodRange('all', now)).toEqual({ startDate: undefined, endDate: undefined });
    expect(periodRange('custom', now, { startDate: '2026-01-01', endDate: '' })).toEqual({
      startDate: '2026-01-01',
      endDate: undefined,
    });
  });
});

describe('validation', () => {
  const valid = { type: 'expense', categoryId: '3', amount: '12.50', date: '2026-10-01', description: '' };

  it('accepts a valid transaction', () => {
    expect(validateTransaction(valid)).toEqual({});
  });

  it.each([['0'], ['-1'], ['1.234'], ['abc'], ['1e5'], ['']])('rejects amount %j', (amount) => {
    expect(validateTransaction({ ...valid, amount })).toHaveProperty('amount');
  });

  it('requires category and date, and limits the description', () => {
    const errors = validateTransaction({ ...valid, categoryId: '', date: '', description: 'x'.repeat(256) });
    expect(Object.keys(errors).sort()).toEqual(['categoryId', 'date', 'description']);
  });

  it('checks registration fields', () => {
    expect(validateRegistration({ name: 'Ann', email: 'ann@example.com', password: 'secret123', confirmPassword: 'secret123' })).toEqual({});
    const errors = validateRegistration({ name: ' ', email: 'nope', password: 'letters', confirmPassword: 'x' });
    expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'email', 'name', 'password']);
  });
});

describe('downloads and tokens', () => {
  it('reads the file name from Content-Disposition', () => {
    expect(filenameFromDisposition('attachment; filename="transactions-2026-10-13.csv"')).toBe('transactions-2026-10-13.csv');
    expect(filenameFromDisposition("attachment; filename*=UTF-8''report%20one.xlsx")).toBe('report one.xlsx');
    expect(filenameFromDisposition(null)).toBeNull();
  });

  it('reads the JWT expiry and tolerates garbage', () => {
    const payload = Buffer.from(JSON.stringify({ sub: '1', exp: 1_800_000_000 })).toString('base64url');
    expect(tokenExpiresAt(`header.${payload}.signature`)).toBe(1_800_000_000_000);
    expect(tokenExpiresAt('not-a-token')).toBeNull();
  });
});

describe('groupCategories', () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => ({ name: `C${i + 1}`, total: String(10 - i * 0.5) }));

  it('keeps up to 7 categories as-is', () => {
    expect(groupCategories(rows(7))).toHaveLength(7);
  });

  it('folds the tail into "Other (n)" with an exact total', () => {
    const grouped = groupCategories(rows(10));
    expect(grouped).toHaveLength(7);
    expect(grouped[6]).toEqual({ name: 'Other (4)', total: 7 + 6.5 + 6 + 5.5 });
  });
});
