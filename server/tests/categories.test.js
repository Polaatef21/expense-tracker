import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiContext } from './helpers/api.js';

const ctx = createApiContext();
let alice;
let bob;

beforeAll(async () => {
  alice = await ctx.registerUser({ name: 'Alice' });
  bob = await ctx.registerUser({ name: 'Bob' });
});

afterAll(() => ctx.close());

describe('GET /api/categories', () => {
  it('lists only my categories, sorted by type then name, with usage counts', async () => {
    const res = await ctx.api().get('/api/categories').set(alice.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(15);
    expect(res.body.data[0]).toEqual({ id: expect.any(Number), name: 'Dining Out', type: 'expense', transactionCount: 0 });
    const types = res.body.data.map((c) => c.type);
    expect(types.indexOf('income')).toBe(10); // all expenses first, then incomes

    const bobIds = (await ctx.api().get('/api/categories').set(bob.auth)).body.data.map((c) => c.id);
    expect(res.body.data.some((c) => bobIds.includes(c.id))).toBe(false);
  });

  it('filters by type', async () => {
    const res = await ctx.api().get('/api/categories?type=income').set(alice.auth);
    expect(res.body.data.map((c) => c.name)).toEqual(['Freelance', 'Gifts', 'Investments', 'Other Income', 'Salary']);
  });

  it('rejects an invalid type filter', async () => {
    const res = await ctx.api().get('/api/categories?type=transfer').set(alice.auth);
    expect(res.status).toBe(400);
  });
});

describe('creating, renaming and deleting categories', () => {
  it('creates a category (trimmed) and rejects case-insensitive duplicates', async () => {
    const created = await ctx.api().post('/api/categories').set(alice.auth).send({ name: '  Pets ', type: 'expense' });
    expect(created.status).toBe(201);
    expect(created.body.data).toEqual({ id: expect.any(Number), name: 'Pets', type: 'expense', transactionCount: 0 });

    const dup = await ctx.api().post('/api/categories').set(alice.auth).send({ name: 'PETS', type: 'expense' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CATEGORY_EXISTS');
  });

  it('allows the same name for the other type and for another user', async () => {
    expect((await ctx.api().post('/api/categories').set(alice.auth).send({ name: 'Pets', type: 'income' })).status).toBe(201);
    expect((await ctx.api().post('/api/categories').set(bob.auth).send({ name: 'Pets', type: 'expense' })).status).toBe(201);
  });

  it('validates the body', async () => {
    const res = await ctx.api().post('/api/categories').set(alice.auth).send({ name: 'x'.repeat(51), type: 'loan' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['name', 'type']);
  });

  it('renames my category', async () => {
    const id = await ctx.categoryId(alice.auth, 'Shopping');
    const res = await ctx.api().put(`/api/categories/${id}`).set(alice.auth).send({ name: 'Clothing', type: 'expense' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, name: 'Clothing', type: 'expense' });
  });

  it("returns 404 when renaming or deleting another user's category, and leaves it unchanged", async () => {
    const bobsId = await ctx.categoryId(bob.auth, 'Groceries');
    const rename = await ctx.api().put(`/api/categories/${bobsId}`).set(alice.auth).send({ name: 'Hacked', type: 'expense' });
    const remove = await ctx.api().delete(`/api/categories/${bobsId}`).set(alice.auth);
    expect(rename.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(await ctx.categoryId(bob.auth, 'Groceries')).toBe(bobsId);
  });

  it('deletes an unused category', async () => {
    const id = await ctx.categoryId(alice.auth, 'Education');
    expect((await ctx.api().delete(`/api/categories/${id}`).set(alice.auth)).status).toBe(204);
    expect((await ctx.api().delete(`/api/categories/${id}`).set(alice.auth)).status).toBe(404);
  });

  it('refuses to delete a category in use, or change its type, with 409', async () => {
    const id = await ctx.categoryId(alice.auth, 'Healthcare');
    await ctx.createTransaction(alice.auth, { type: 'expense', categoryId: id, amount: '30', date: '2026-01-05' });

    const del = await ctx.api().delete(`/api/categories/${id}`).set(alice.auth);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('CATEGORY_IN_USE');

    const retype = await ctx.api().put(`/api/categories/${id}`).set(alice.auth).send({ name: 'Healthcare', type: 'income' });
    expect(retype.status).toBe(409);
    expect(retype.body.error.code).toBe('CATEGORY_IN_USE');

    // Renaming while keeping the type is fine, and the count is reported
    const rename = await ctx.api().put(`/api/categories/${id}`).set(alice.auth).send({ name: 'Health', type: 'expense' });
    expect(rename.status).toBe(200);
    expect(rename.body.data.transactionCount).toBe(1);
  });

  it('rejects a non-numeric id', async () => {
    const res = await ctx.api().delete('/api/categories/abc').set(alice.auth);
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('id');
  });
});
