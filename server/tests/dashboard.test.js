import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiContext } from './helpers/api.js';

const ctx = createApiContext();
let dana;
let erin;

beforeAll(async () => {
  dana = await ctx.registerUser({ name: 'Dana' });
  erin = await ctx.registerUser({ name: 'Erin' });
  const res = await ctx.api().get('/api/categories').set(dana.auth);
  const c = Object.fromEntries(res.body.data.map((x) => [x.name, x.id]));

  const rows = [
    ['income', 'Salary', '2500.00', '2025-11-30'],
    ['expense', 'Housing', '900.00', '2025-11-02'],
    ['income', 'Salary', '2500.00', '2026-01-31'],
    ['income', 'Freelance', '400.55', '2026-01-15'],
    ['expense', 'Housing', '900.00', '2026-01-02'],
    ['expense', 'Groceries', '120.10', '2026-01-09'],
    ['expense', 'Groceries', '79.90', '2026-01-23'],
    ['expense', 'Dining Out', '0.10', '2026-01-24'],
    ['expense', 'Dining Out', '0.20', '2026-01-25'],
  ];
  for (const [type, name, amount, date] of rows) {
    await ctx.createTransaction(dana.auth, { type, categoryId: c[name], amount, date });
  }

  // Another user's data must never leak into Dana's numbers
  const erinsSalary = await ctx.categoryId(erin.auth, 'Salary');
  await ctx.createTransaction(erin.auth, { type: 'income', categoryId: erinsSalary, amount: '99999.00', date: '2026-01-15' });
});

afterAll(() => ctx.close());

const dashboard = (user, query = '') => ctx.api().get(`/api/dashboard${query}`).set(user.auth);

describe('GET /api/dashboard', () => {
  it('computes exact totals for the selected period', async () => {
    const res = await dashboard(dana, '?startDate=2026-01-01&endDate=2026-01-31');
    expect(res.status).toBe(200);
    expect(res.body.period).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(res.body.totals).toEqual({ count: 7, income: '2900.55', expense: '1100.30', net: '1800.25' });
  });

  it('reports the all-time current balance regardless of the period', async () => {
    const res = await dashboard(dana, '?startDate=2026-01-01&endDate=2026-01-31');
    // (2500 + 2500 + 400.55) - (900 + 900 + 120.10 + 79.90 + 0.10 + 0.20)
    expect(res.body.currentBalance).toBe('3400.25');
  });

  it('breaks down spending and income by category, largest first', async () => {
    const res = await dashboard(dana, '?startDate=2026-01-01&endDate=2026-01-31');
    expect(res.body.expenseByCategory.map(({ name, total, count }) => ({ name, total, count }))).toEqual([
      { name: 'Housing', total: '900.00', count: 1 },
      { name: 'Groceries', total: '200.00', count: 2 },
      { name: 'Dining Out', total: '0.30', count: 2 },
    ]);
    expect(res.body.incomeByCategory.map((r) => [r.name, r.total])).toEqual([
      ['Salary', '2500.00'],
      ['Freelance', '400.55'],
    ]);
  });

  it('returns a monthly trend that includes months with no activity', async () => {
    const res = await dashboard(dana); // all time: Nov 2025 .. Jan 2026
    expect(res.body.monthly).toEqual([
      { month: '2025-11', income: '2500.00', expense: '900.00', net: '1600.00' },
      { month: '2025-12', income: '0.00', expense: '0.00', net: '0.00' },
      { month: '2026-01', income: '2900.55', expense: '1100.30', net: '1800.25' },
    ]);
    expect(res.body.totals.net).toBe(res.body.currentBalance);
  });

  it('spans the whole requested range even beyond the data', async () => {
    const res = await dashboard(dana, '?startDate=2026-01-01&endDate=2026-03-31');
    expect(res.body.monthly.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(res.body.monthly[2]).toEqual({ month: '2026-03', income: '0.00', expense: '0.00', net: '0.00' });
  });

  it('isolates users completely', async () => {
    const res = await dashboard(erin);
    expect(res.body.totals).toEqual({ count: 1, income: '99999.00', expense: '0.00', net: '99999.00' });
    expect(res.body.expenseByCategory).toEqual([]);
  });

  it('returns zeros and empty lists for a brand-new user', async () => {
    const fresh = await ctx.registerUser();
    const res = await dashboard(fresh);
    expect(res.body).toEqual({
      period: { startDate: null, endDate: null },
      totals: { count: 0, income: '0.00', expense: '0.00', net: '0.00' },
      currentBalance: '0.00',
      expenseByCategory: [],
      incomeByCategory: [],
      monthly: [],
    });
  });

  it('rejects an inverted date range', async () => {
    const res = await dashboard(dana, '?startDate=2026-02-01&endDate=2026-01-01');
    expect(res.status).toBe(400);
  });
});
