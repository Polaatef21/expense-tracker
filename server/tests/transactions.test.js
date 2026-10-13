import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiContext } from './helpers/api.js';

const ctx = createApiContext();
let alice;
let bob;
let cat; // alice's category ids by name

beforeAll(async () => {
  alice = await ctx.registerUser({ name: 'Alice' });
  bob = await ctx.registerUser({ name: 'Bob' });
  const res = await ctx.api().get('/api/categories').set(alice.auth);
  cat = Object.fromEntries(res.body.data.map((c) => [c.name, c.id]));
});

afterAll(() => ctx.close());

const valid = () => ({ type: 'expense', categoryId: cat.Groceries, amount: '42.50', date: '2026-03-15', description: 'Weekly shop' });

describe('POST /api/transactions', () => {
  it('creates a transaction and returns it with its category', async () => {
    const res = await ctx.api().post('/api/transactions').set(alice.auth).send(valid());
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      id: expect.any(Number),
      type: 'expense',
      amount: '42.50',
      description: 'Weekly shop',
      date: '2026-03-15',
      category: { id: cat.Groceries, name: 'Groceries' },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('accepts a numeric amount, trims the description, and stores blank as null', async () => {
    const res = await ctx.api().post('/api/transactions').set(alice.auth)
      .send({ ...valid(), amount: 7, description: '   ' });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe('7.00');
    expect(res.body.data.description).toBeNull();
  });

  it.each([
    ['zero', '0'],
    ['negative', '-5'],
    ['three decimals', '12.345'],
    ['text', 'abc'],
    ['an exponent', '1e5'],
    ['too large', '10000000000'],
  ])('rejects an amount that is %s', async (_label, amount) => {
    const res = await ctx.api().post('/api/transactions').set(alice.auth).send({ ...valid(), amount });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('amount');
  });

  it.each([['an impossible date', '2026-02-30'], ['the wrong format', '15/03/2026'], ['out of range', '1899-12-31']])(
    'rejects %s', async (_label, date) => {
      const res = await ctx.api().post('/api/transactions').set(alice.auth).send({ ...valid(), date });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.field)).toContain('date');
    });

  it('rejects a description over 255 characters', async () => {
    const res = await ctx.api().post('/api/transactions').set(alice.auth).send({ ...valid(), description: 'd'.repeat(256) });
    expect(res.status).toBe(400);
  });

  it('reports every missing field at once', async () => {
    const res = await ctx.api().post('/api/transactions').set(alice.auth).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['amount', 'categoryId', 'date', 'type']);
  });

  it("rejects another user's category with 400 INVALID_CATEGORY", async () => {
    const bobsGroceries = await ctx.categoryId(bob.auth, 'Groceries');
    const res = await ctx.api().post('/api/transactions').set(alice.auth).send({ ...valid(), categoryId: bobsGroceries });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CATEGORY');
  });

  it('rejects a category whose type does not match', async () => {
    const res = await ctx.api().post('/api/transactions').set(alice.auth).send({ ...valid(), categoryId: cat.Salary });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CATEGORY_TYPE_MISMATCH');
  });

  it('ignores a user_id supplied by the client', async () => {
    const res = await ctx.api().post('/api/transactions').set(alice.auth).send({ ...valid(), user_id: bob.user.id, userId: bob.user.id });
    expect(res.status).toBe(201);
    const { rows } = await ctx.db.query('SELECT user_id FROM transactions WHERE id = $1', [res.body.data.id]);
    expect(rows[0].user_id).toBe(alice.user.id);
  });
});

describe('reading, updating and deleting: ownership', () => {
  let mine;
  let bobs;
  beforeAll(async () => {
    mine = await ctx.createTransaction(alice.auth, valid());
    const bobsCategory = await ctx.categoryId(bob.auth, 'Salary');
    bobs = await ctx.createTransaction(bob.auth, { type: 'income', categoryId: bobsCategory, amount: '1000', date: '2026-03-01' });
  });

  it('reads my own transaction', async () => {
    const res = await ctx.api().get(`/api/transactions/${mine.id}`).set(alice.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(mine.id);
  });

  it("returns 404 for another user's transaction on GET, PUT and DELETE, and leaves it untouched", async () => {
    const get = await ctx.api().get(`/api/transactions/${bobs.id}`).set(alice.auth);
    const put = await ctx.api().put(`/api/transactions/${bobs.id}`).set(alice.auth).send(valid());
    const del = await ctx.api().delete(`/api/transactions/${bobs.id}`).set(alice.auth);
    expect([get.status, put.status, del.status]).toEqual([404, 404, 404]);

    const stillThere = await ctx.api().get(`/api/transactions/${bobs.id}`).set(bob.auth);
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.data.amount).toBe('1000.00');
  });

  it('updates my transaction (full replacement), including switching type and category', async () => {
    const res = await ctx.api().put(`/api/transactions/${mine.id}`).set(alice.auth)
      .send({ type: 'income', categoryId: cat.Freelance, amount: '250.00', date: '2026-03-20', description: 'Logo design' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: mine.id, type: 'income', amount: '250.00', date: '2026-03-20',
      description: 'Logo design', category: { id: cat.Freelance, name: 'Freelance' },
    });
  });

  it('validates updates the same way as creates', async () => {
    const res = await ctx.api().put(`/api/transactions/${mine.id}`).set(alice.auth).send({ ...valid(), amount: '-1' });
    expect(res.status).toBe(400);
  });

  it('deletes my transaction', async () => {
    const t = await ctx.createTransaction(alice.auth, valid());
    expect((await ctx.api().delete(`/api/transactions/${t.id}`).set(alice.auth)).status).toBe(204);
    expect((await ctx.api().get(`/api/transactions/${t.id}`).set(alice.auth)).status).toBe(404);
  });
});

describe('GET /api/transactions: filtering, pagination, summary', () => {
  let carol;
  let c; // carol's category ids
  beforeAll(async () => {
    carol = await ctx.registerUser({ name: 'Carol' });
    const res = await ctx.api().get('/api/categories').set(carol.auth);
    c = Object.fromEntries(res.body.data.map((x) => [x.name, x.id]));
    const rows = [
      ['income', 'Salary', '3000.00', '2026-01-31'],
      ['expense', 'Housing', '1200.00', '2026-01-01'],
      ['expense', 'Groceries', '85.40', '2026-01-10'],
      ['expense', 'Groceries', '64.60', '2026-02-12'],
      ['income', 'Salary', '3000.00', '2026-02-28'],
      ['expense', 'Dining Out', '0.10', '2026-02-14'],
      ['expense', 'Dining Out', '0.20', '2026-03-02'],
    ];
    for (const [type, name, amount, date] of rows) {
      await ctx.createTransaction(carol.auth, { type, categoryId: c[name], amount, date });
    }
  });

  const list = (query = '') => ctx.api().get(`/api/transactions${query}`).set(carol.auth);

  it('lists newest first with pagination info and an exact summary', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.data.map((t) => t.date)).toEqual([
      '2026-03-02', '2026-02-28', '2026-02-14', '2026-02-12', '2026-01-31', '2026-01-10', '2026-01-01',
    ]);
    expect(res.body.pagination).toEqual({ page: 1, pageSize: 20, total: 7, totalPages: 1 });
    expect(res.body.summary).toEqual({ count: 7, income: '6000.00', expense: '1350.30', net: '4649.70' });
  });

  it('paginates', async () => {
    const page2 = await list('?page=2&pageSize=3');
    expect(page2.body.data.map((t) => t.date)).toEqual(['2026-02-12', '2026-01-31', '2026-01-10']);
    expect(page2.body.pagination).toEqual({ page: 2, pageSize: 3, total: 7, totalPages: 3 });
    const beyond = await list('?page=9&pageSize=3');
    expect(beyond.body.data).toEqual([]);
  });

  it('filters by an inclusive date range', async () => {
    const res = await list('?startDate=2026-02-01&endDate=2026-02-28');
    expect(res.body.data.map((t) => t.date)).toEqual(['2026-02-28', '2026-02-14', '2026-02-12']);
    expect(res.body.summary).toEqual({ count: 3, income: '3000.00', expense: '64.70', net: '2935.30' });
  });

  it('filters by type', async () => {
    const res = await list('?type=income');
    expect(res.body.data.every((t) => t.type === 'income')).toBe(true);
    expect(res.body.summary.count).toBe(2);
  });

  it('filters by category', async () => {
    const res = await list(`?categoryId=${c['Dining Out']}`);
    expect(res.body.summary).toEqual({ count: 2, income: '0.00', expense: '0.30', net: '-0.30' });
  });

  it('combines filters', async () => {
    const res = await list(`?type=expense&categoryId=${c.Groceries}&startDate=2026-02-01`);
    expect(res.body.data.map((t) => t.amount)).toEqual(['64.60']);
  });

  it("returns nothing when filtering by another user's category", async () => {
    const res = await list(`?categoryId=${cat.Groceries}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('never includes other users\' transactions', async () => {
    const res = await list('?pageSize=100');
    const { rows } = await ctx.db.query('SELECT id FROM transactions WHERE user_id = $1', [carol.user.id]);
    expect(res.body.data.map((t) => t.id).sort()).toEqual(rows.map((r) => r.id).sort());
  });

  it('ignores empty filter values', async () => {
    const res = await list('?startDate=&endDate=&type=&categoryId=');
    expect(res.status).toBe(200);
    expect(res.body.summary.count).toBe(7);
  });

  it.each([
    ['a start date after the end date', '?startDate=2026-03-01&endDate=2026-02-01', 'endDate'],
    ['an invalid type', '?type=refund', 'type'],
    ['a page size over 100', '?pageSize=101', 'pageSize'],
    ['an invalid date', '?startDate=2026-13-01', 'startDate'],
  ])('rejects %s', async (_label, query, field) => {
    const res = await list(query);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain(field);
  });
});
