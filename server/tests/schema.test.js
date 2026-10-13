// Verifies the database itself enforces the schema rules, independent of the API.
// Every test runs inside a transaction that is rolled back afterwards,
// so the test database is left empty.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb, expectDbError } from './helpers/db.js';

let db;

beforeAll(async () => {
  db = await connectTestDb();
});

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await db.query('BEGIN');
});

afterEach(async () => {
  await db.query('ROLLBACK');
});

// ---------- helpers ----------
async function createUser(email, name = 'Test User') {
  const { rows } = await db.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [name, email, '$2b$12$placeholderhashplaceholderhashplaceholderhashpla'],
  );
  return rows[0].id;
}

async function createCategory(userId, name, type) {
  const { rows } = await db.query(
    'INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3) RETURNING id',
    [userId, name, type],
  );
  return rows[0].id;
}

async function createTransaction(userId, categoryId, type, amount = '10.00', description = null) {
  const { rows } = await db.query(
    `INSERT INTO transactions (user_id, category_id, type, amount, description, transaction_date)
     VALUES ($1, $2, $3, $4, $5, '2026-10-01') RETURNING id, amount`,
    [userId, categoryId, type, amount, description],
  );
  return rows[0];
}

async function count(table, where = 'TRUE', params = []) {
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, params);
  return rows[0].n;
}

const INSERT_TX = `INSERT INTO transactions (user_id, category_id, type, amount, description, transaction_date)
                   VALUES ($1, $2, $3, $4, $5, '2026-10-01')`;

// ---------- structure ----------
describe('schema structure', () => {
  it('records the initial migration exactly once', async () => {
    const { rows } = await db.query('SELECT filename FROM schema_migrations ORDER BY filename');
    expect(rows.map((r) => r.filename)).toEqual(['001_initial_schema.sql']);
  });

  it('creates the expected tables', async () => {
    const { rows } = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual(['categories', 'schema_migrations', 'transactions', 'users']);
  });

  it('creates the expected named constraints', async () => {
    const { rows } = await db.query(
      `SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE n.nspname = 'public' AND conrelid::regclass::text IN ('users','categories','transactions')`,
    );
    const names = rows.map((r) => r.conname);
    for (const expected of [
      'users_email_unique', 'users_email_format', 'users_name_length',
      'categories_type_check', 'categories_name_format', 'categories_id_user_type_unique',
      'transactions_type_check', 'transactions_amount_positive',
      'transactions_description_length', 'transactions_category_fk',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('creates the planned indexes', async () => {
    const { rows } = await db.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const byName = Object.fromEntries(rows.map((r) => [r.indexname, r.indexdef]));
    expect(byName.transactions_user_date_idx).toMatch(/\(user_id, transaction_date DESC, id DESC\)/);
    expect(byName.transactions_category_date_idx).toMatch(/\(category_id, transaction_date DESC\)/);
    expect(byName.categories_user_type_name_unique).toMatch(/UNIQUE.*\(user_id, type, lower\(name\)\)/);
    expect(byName.categories_id_user_type_unique).toMatch(/UNIQUE.*\(id, user_id, type\)/);
    expect(byName.users_email_unique).toMatch(/UNIQUE.*\(email\)/);
  });
});

// ---------- users ----------
describe('users', () => {
  it('accepts a valid user and sets timestamps', async () => {
    const id = await createUser('alice@example.com');
    const { rows } = await db.query('SELECT created_at, updated_at FROM users WHERE id = $1', [id]);
    expect(rows[0].created_at).toBeInstanceOf(Date);
    expect(rows[0].updated_at).toBeInstanceOf(Date);
  });

  it('rejects a duplicate email', async () => {
    await createUser('alice@example.com');
    const err = await expectDbError(db,
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', ['Other', 'alice@example.com', 'x']);
    expect(err.code).toBe('23505');
    expect(err.constraint).toBe('users_email_unique');
    expect(await count('users', 'email = $1', ['alice@example.com'])).toBe(1);
  });

  it.each([
    ['uppercase', 'Alice@Example.com'],
    ['surrounding spaces', ' alice@example.com '],
    ['missing @', 'alice.example.com'],
    ['@ as first character', '@example.com'],
  ])('rejects an email with %s', async (_label, email) => {
    const err = await expectDbError(db,
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', ['A', email, 'x']);
    expect(err.constraint).toBe('users_email_format');
    expect(await count('users')).toBe(0);
  });

  it.each([['empty', ''], ['untrimmed', ' Alice '], ['too long', 'a'.repeat(101)]])(
    'rejects a %s name', async (_label, name) => {
      const err = await expectDbError(db,
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', [name, 'a@example.com', 'x']);
      expect(err.constraint).toBe('users_name_length');
      expect(await count('users')).toBe(0);
    });

  it('rejects a missing password hash', async () => {
    const err = await expectDbError(db,
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, NULL)', ['A', 'a@example.com']);
    expect(err.code).toBe('23502'); // not_null_violation
    expect(await count('users')).toBe(0);
  });

  it('refreshes updated_at on update', async () => {
    const id = await createUser('alice@example.com');
    // Explicit UTC offset: a bare '2000-01-01' would be read in the session's local time zone
    await db.query(
      `UPDATE users SET updated_at = '2000-01-01T00:00:00Z', created_at = '2000-01-01T00:00:00Z' WHERE id = $1`, [id]);
    await db.query('UPDATE users SET name = $1 WHERE id = $2', ['Alice B', id]);
    const { rows } = await db.query('SELECT created_at, updated_at FROM users WHERE id = $1', [id]);
    expect(rows[0].updated_at.getTime()).toBeGreaterThan(new Date('2000-01-02').getTime());
    expect(rows[0].created_at.toISOString()).toMatch(/^2000-01-01/); // created_at untouched
  });
});

// ---------- categories ----------
describe('categories', () => {
  it('rejects the same name with different capitalization for the same user and type', async () => {
    const userId = await createUser('alice@example.com');
    await createCategory(userId, 'Groceries', 'expense');
    const err = await expectDbError(db,
      'INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3)', [userId, 'groceries', 'expense']);
    expect(err.code).toBe('23505');
    expect(err.constraint).toBe('categories_user_type_name_unique');
    expect(await count('categories', 'user_id = $1', [userId])).toBe(1);
  });

  it('allows the same name for a different type or a different user', async () => {
    const alice = await createUser('alice@example.com');
    const bob = await createUser('bob@example.com');
    await createCategory(alice, 'Other', 'expense');
    await createCategory(alice, 'Other', 'income');
    await createCategory(bob, 'Other', 'expense');
    expect(await count('categories')).toBe(3);
  });

  it('rejects an invalid type', async () => {
    const userId = await createUser('alice@example.com');
    const err = await expectDbError(db,
      'INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3)', [userId, 'Misc', 'transfer']);
    expect(err.constraint).toBe('categories_type_check');
    expect(await count('categories')).toBe(0);
  });

  it.each([['empty', ''], ['untrimmed', ' Food '], ['too long', 'x'.repeat(51)]])(
    'rejects a %s name', async (_label, name) => {
      const userId = await createUser('alice@example.com');
      const err = await expectDbError(db,
        'INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3)', [userId, name, 'expense']);
      expect(err.constraint).toBe('categories_name_format');
      expect(await count('categories')).toBe(0);
    });

  it('rejects a category for a non-existent user', async () => {
    const err = await expectDbError(db,
      'INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3)', [999999, 'Food', 'expense']);
    expect(err.code).toBe('23503'); // foreign_key_violation
    expect(await count('categories')).toBe(0);
  });
});

// ---------- transactions: ownership & type consistency ----------
describe('transactions: ownership and type consistency', () => {
  it('accepts a transaction using the owner\'s category of the same type', async () => {
    const alice = await createUser('alice@example.com');
    const food = await createCategory(alice, 'Groceries', 'expense');
    const tx = await createTransaction(alice, food, 'expense', '42.50', 'Weekly shop');
    expect(tx.amount).toBe('42.50'); // pg returns NUMERIC as an exact string
  });

  it('rejects a transaction that uses another user\'s category', async () => {
    const alice = await createUser('alice@example.com');
    const bob = await createUser('bob@example.com');
    const bobsCategory = await createCategory(bob, 'Groceries', 'expense');
    const err = await expectDbError(db, INSERT_TX, [alice, bobsCategory, 'expense', '10.00', null]);
    expect(err.code).toBe('23503');
    expect(err.constraint).toBe('transactions_category_fk');
    expect(await count('transactions')).toBe(0);
  });

  it('rejects an expense filed under an income category (and vice versa)', async () => {
    const alice = await createUser('alice@example.com');
    const salary = await createCategory(alice, 'Salary', 'income');
    const food = await createCategory(alice, 'Groceries', 'expense');
    const err1 = await expectDbError(db, INSERT_TX, [alice, salary, 'expense', '10.00', null]);
    const err2 = await expectDbError(db, INSERT_TX, [alice, food, 'income', '10.00', null]);
    expect(err1.constraint).toBe('transactions_category_fk');
    expect(err2.constraint).toBe('transactions_category_fk');
    expect(await count('transactions')).toBe(0);
  });

  it('rejects moving a transaction to another user (category stays with the original owner)', async () => {
    const alice = await createUser('alice@example.com');
    const bob = await createUser('bob@example.com');
    const food = await createCategory(alice, 'Groceries', 'expense');
    const tx = await createTransaction(alice, food, 'expense');
    const err = await expectDbError(db, 'UPDATE transactions SET user_id = $1 WHERE id = $2', [bob, tx.id]);
    expect(err.constraint).toBe('transactions_category_fk');
    expect(await count('transactions', 'user_id = $1', [alice])).toBe(1);
  });

  it('rejects switching a transaction\'s type without switching to a matching category', async () => {
    const alice = await createUser('alice@example.com');
    const food = await createCategory(alice, 'Groceries', 'expense');
    const tx = await createTransaction(alice, food, 'expense');
    const err = await expectDbError(db, `UPDATE transactions SET type = 'income' WHERE id = $1`, [tx.id]);
    expect(err.constraint).toBe('transactions_category_fk');
    expect(await count('transactions', `type = 'expense'`)).toBe(1);
  });

  it('rejects changing the type or owner of a category that is in use', async () => {
    const alice = await createUser('alice@example.com');
    const bob = await createUser('bob@example.com');
    const food = await createCategory(alice, 'Groceries', 'expense');
    await createTransaction(alice, food, 'expense');
    const err1 = await expectDbError(db, `UPDATE categories SET type = 'income' WHERE id = $1`, [food]);
    const err2 = await expectDbError(db, 'UPDATE categories SET user_id = $1 WHERE id = $2', [bob, food]);
    expect(err1.constraint).toBe('transactions_category_fk');
    expect(err2.constraint).toBe('transactions_category_fk');
    const { rows } = await db.query('SELECT user_id, type FROM categories WHERE id = $1', [food]);
    expect(rows[0]).toEqual({ user_id: alice, type: 'expense' });
  });

  it('rejects an invalid transaction type', async () => {
    const alice = await createUser('alice@example.com');
    const food = await createCategory(alice, 'Groceries', 'expense');
    const err = await expectDbError(db, INSERT_TX, [alice, food, 'refund', '10.00', null]);
    // Either the CHECK or the FK may fire first; both block the row
    expect(['transactions_type_check', 'transactions_category_fk']).toContain(err.constraint);
    expect(await count('transactions')).toBe(0);
  });
});

// ---------- transactions: amounts, description, required fields ----------
describe('transactions: field validation', () => {
  let alice;
  let food;
  beforeEach(async () => {
    alice = await createUser('alice@example.com');
    food = await createCategory(alice, 'Groceries', 'expense');
  });

  it.each([['zero', '0'], ['negative', '-5'], ['rounds to zero', '0.004']])(
    'rejects a %s amount', async (_label, amount) => {
      const err = await expectDbError(db, INSERT_TX, [alice, food, 'expense', amount, null]);
      expect(err.constraint).toBe('transactions_amount_positive');
      expect(await count('transactions')).toBe(0);
    });

  it('rejects an amount larger than NUMERIC(12,2) allows', async () => {
    const err = await expectDbError(db, INSERT_TX, [alice, food, 'expense', '10000000000.00', null]);
    expect(err.code).toBe('22003'); // numeric_value_out_of_range
    expect(await count('transactions')).toBe(0);
  });

  it('accepts the maximum amount and stores it exactly', async () => {
    const tx = await createTransaction(alice, food, 'expense', '9999999999.99');
    expect(tx.amount).toBe('9999999999.99');
  });

  it('sums decimal amounts exactly (no floating-point drift)', async () => {
    await createTransaction(alice, food, 'expense', '0.10');
    await createTransaction(alice, food, 'expense', '0.20');
    const { rows } = await db.query('SELECT sum(amount)::text AS total FROM transactions');
    expect(rows[0].total).toBe('0.30');
  });

  it('documents that PostgreSQL ROUNDS extra decimals (API must reject them)', async () => {
    const tx = await createTransaction(alice, food, 'expense', '12.345');
    expect(tx.amount).toBe('12.35');
  });

  it('accepts a NULL description and a 255-character description', async () => {
    await createTransaction(alice, food, 'expense', '1.00', null);
    await createTransaction(alice, food, 'expense', '1.00', 'd'.repeat(255));
    expect(await count('transactions')).toBe(2);
  });

  it.each([['empty', ''], ['untrimmed', ' lunch '], ['256 characters', 'd'.repeat(256)]])(
    'rejects a %s description', async (_label, description) => {
      const err = await expectDbError(db, INSERT_TX, [alice, food, 'expense', '1.00', description]);
      expect(err.constraint).toBe('transactions_description_length');
      expect(await count('transactions')).toBe(0);
    });

  it('rejects a missing date', async () => {
    const err = await expectDbError(db,
      `INSERT INTO transactions (user_id, category_id, type, amount, transaction_date)
       VALUES ($1, $2, 'expense', '1.00', NULL)`, [alice, food]);
    expect(err.code).toBe('23502');
    expect(await count('transactions')).toBe(0);
  });

  it('refreshes updated_at on update', async () => {
    const tx = await createTransaction(alice, food, 'expense');
    await db.query(`UPDATE transactions SET updated_at = '2000-01-01T00:00:00Z' WHERE id = $1`, [tx.id]);
    await db.query(`UPDATE transactions SET amount = '20.00' WHERE id = $1`, [tx.id]);
    const { rows } = await db.query('SELECT updated_at FROM transactions WHERE id = $1', [tx.id]);
    expect(rows[0].updated_at.getTime()).toBeGreaterThan(new Date('2000-01-02').getTime());
  });
});

// ---------- deletion behavior ----------
describe('deletion behavior', () => {
  it('blocks deleting a category that has transactions', async () => {
    const alice = await createUser('alice@example.com');
    const food = await createCategory(alice, 'Groceries', 'expense');
    await createTransaction(alice, food, 'expense');
    const err = await expectDbError(db, 'DELETE FROM categories WHERE id = $1', [food]);
    expect(err.code).toBe('23503');
    expect(err.constraint).toBe('transactions_category_fk');
    expect(await count('categories', 'id = $1', [food])).toBe(1);
    expect(await count('transactions')).toBe(1);
  });

  it('allows deleting an unused category', async () => {
    const alice = await createUser('alice@example.com');
    const unused = await createCategory(alice, 'Unused', 'expense');
    await db.query('DELETE FROM categories WHERE id = $1', [unused]);
    expect(await count('categories', 'id = $1', [unused])).toBe(0);
  });

  it('deleting a user cascades to their categories and transactions only', async () => {
    const alice = await createUser('alice@example.com');
    const bob = await createUser('bob@example.com');
    const aliceFood = await createCategory(alice, 'Groceries', 'expense');
    const aliceSalary = await createCategory(alice, 'Salary', 'income');
    const bobFood = await createCategory(bob, 'Groceries', 'expense');
    await createTransaction(alice, aliceFood, 'expense');
    await createTransaction(alice, aliceSalary, 'income');
    await createTransaction(bob, bobFood, 'expense');

    await db.query('DELETE FROM users WHERE id = $1', [alice]);

    expect(await count('users', 'id = $1', [alice])).toBe(0);
    expect(await count('categories', 'user_id = $1', [alice])).toBe(0);
    expect(await count('transactions', 'user_id = $1', [alice])).toBe(0);
    // Bob's data is untouched
    expect(await count('users', 'id = $1', [bob])).toBe(1);
    expect(await count('categories', 'user_id = $1', [bob])).toBe(1);
    expect(await count('transactions', 'user_id = $1', [bob])).toBe(1);
  });
});

// ---------- final state ----------
describe('test isolation', () => {
  it('leaves no rows behind (checked from a separate connection)', async () => {
    const other = await connectTestDb();
    try {
      for (const table of ['users', 'categories', 'transactions']) {
        const { rows } = await other.query(`SELECT count(*)::int AS n FROM ${table}`);
        expect(rows[0].n, table).toBe(0);
      }
    } finally {
      await other.end();
    }
  });
});
