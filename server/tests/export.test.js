import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { toCsv } from '../src/services/export.service.js';
import { createApiContext } from './helpers/api.js';

const ctx = createApiContext();
let alice;
let bob;
let cat;

// supertest helper: collect a binary response body into a Buffer
const binary = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

beforeAll(async () => {
  alice = await ctx.registerUser({ name: 'Alice' });
  bob = await ctx.registerUser({ name: 'Bob' });
  const res = await ctx.api().get('/api/categories').set(alice.auth);
  cat = Object.fromEntries(res.body.data.map((c) => [c.name, c.id]));

  await ctx.createTransaction(alice.auth, { type: 'income', categoryId: cat.Salary, amount: '3000', date: '2026-01-31', description: 'January salary' });
  await ctx.createTransaction(alice.auth, { type: 'expense', categoryId: cat.Groceries, amount: '12.30', date: '2026-02-03', description: 'Milk, eggs & "organic" bread' });
  await ctx.createTransaction(alice.auth, { type: 'expense', categoryId: cat['Dining Out'], amount: '45.00', date: '2026-02-10', description: '=HYPERLINK("http://evil.example")' });

  const bobsCategory = await ctx.categoryId(bob.auth, 'Groceries');
  await ctx.createTransaction(bob.auth, { type: 'expense', categoryId: bobsCategory, amount: '999.99', date: '2026-02-05', description: 'BOB SECRET' });
});

afterAll(() => ctx.close());

describe('CSV export', () => {
  it('downloads all of my transactions as an attachment', async () => {
    const res = await ctx.api().get('/api/transactions/export?format=csv').set(alice.auth);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="transactions-\d{4}-\d{2}-\d{2}\.csv"$/);

    const lines = res.text.replace(/^﻿/, '').trimEnd().split('\r\n');
    expect(lines[0]).toBe('Date,Type,Category,Description,Amount');
    expect(lines).toHaveLength(4);
    expect(res.text).not.toContain('BOB SECRET');
  });

  it('escapes commas and quotes, and neutralizes formulas', async () => {
    const res = await ctx.api().get('/api/transactions/export?format=csv').set(alice.auth);
    expect(res.text).toContain('2026-02-03,Expense,Groceries,"Milk, eggs & ""organic"" bread",12.30');
    expect(res.text).toContain(`2026-02-10,Expense,Dining Out,"'=HYPERLINK(""http://evil.example"")",45.00`);
  });

  it('respects the active filters', async () => {
    const res = await ctx.api()
      .get(`/api/transactions/export?format=csv&type=expense&startDate=2026-02-01&endDate=2026-02-05&categoryId=${cat.Groceries}`)
      .set(alice.auth);
    const lines = res.text.replace(/^﻿/, '').trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/^2026-02-03,Expense,Groceries,/);
  });

  it('returns just the header row when nothing matches', async () => {
    const res = await ctx.api().get('/api/transactions/export?format=csv&startDate=2030-01-01').set(alice.auth);
    expect(res.text.replace(/^﻿/, '').trimEnd()).toBe('Date,Type,Category,Description,Amount');
  });

  it('rejects a missing or unknown format', async () => {
    expect((await ctx.api().get('/api/transactions/export').set(alice.auth)).status).toBe(400);
    expect((await ctx.api().get('/api/transactions/export?format=pdf').set(alice.auth)).status).toBe(400);
  });

  it('toCsv handles newlines and leading +, -, @ characters', () => {
    const csv = toCsv([
      { date: '2026-01-01', type: 'expense', category: { name: '@Home' }, description: 'line1\nline2', amount: '1.00' },
      { date: '2026-01-02', type: 'income', category: { name: 'Other' }, description: '-10 refund', amount: '2.00' },
    ]);
    expect(csv).toContain(`2026-01-01,Expense,'@Home,"line1\nline2",1.00`);
    expect(csv).toContain(`2026-01-02,Income,Other,'-10 refund,2.00`);
  });
});

describe('Excel export', () => {
  async function download(query) {
    const res = await ctx.api().get(`/api/transactions/export?format=xlsx${query}`).set(alice.auth).buffer().parse(binary);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    return { res, workbook };
  }

  it('produces a valid workbook with typed date and number cells', async () => {
    const { res, workbook } = await download('');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toMatch(/filename="transactions-\d{4}-\d{2}-\d{2}\.xlsx"/);

    const sheet = workbook.getWorksheet('Transactions');
    expect(sheet.getRow(1).values.slice(1)).toEqual(['Date', 'Type', 'Category', 'Description', 'Amount']);
    expect(sheet.rowCount).toBe(4);

    const salary = sheet.getRow(4).values.slice(1);
    expect(salary[0]).toBeInstanceOf(Date);
    expect(salary[0].toISOString().slice(0, 10)).toBe('2026-01-31');
    expect(salary.slice(1)).toEqual(['Income', 'Salary', 'January salary', 3000]);

    const allText = JSON.stringify(sheet.getSheetValues());
    expect(allText).not.toContain('BOB SECRET');
    // Stored as plain text, not as an executable formula
    expect(sheet.getRow(2).getCell(4).type).toBe(ExcelJS.ValueType.String);
  });

  it('respects filters and summarizes them on a second sheet', async () => {
    const { workbook } = await download(`&type=expense&categoryId=${cat.Groceries}`);
    expect(workbook.getWorksheet('Transactions').rowCount).toBe(2);

    const summary = Object.fromEntries(
      workbook.getWorksheet('Summary').getSheetValues().filter(Boolean).map((r) => [r[1], r[2]]),
    );
    expect(summary).toMatchObject({
      Type: 'Expense', Category: 'Groceries', From: 'Any', To: 'Any',
      Transactions: 1, Income: 0, Expenses: 12.3, Net: -12.3,
    });
  });
});
