import { AppError } from '../utils/AppError.js';
import { isForeignKeyViolation } from '../utils/pgErrors.js';
import { buildTransactionFilter, SUMMARY_COLUMNS } from './transactionFilters.js';

export const MAX_EXPORT_ROWS = 50_000;

const COLUMNS = `t.id, t.type, t.amount, t.description, t.transaction_date, t.created_at, t.updated_at,
                 c.id AS category_id, c.name AS category_name`;

const toTransaction = (row) => ({
  id: row.id,
  type: row.type,
  amount: row.amount, // exact decimal string, e.g. "42.50"
  description: row.description,
  date: row.transaction_date, // 'YYYY-MM-DD'
  category: { id: row.category_id, name: row.category_name },
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const notFound = () => new AppError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');
const invalidCategory = () =>
  new AppError(400, 'INVALID_CATEGORY', 'Selected category does not exist', [
    { field: 'categoryId', message: 'Choose one of your categories' },
  ]);

const toSummary = (row) => ({ count: row.count, income: row.income, expense: row.expense, net: row.net });

export function createTransactionService({ db }) {
  // Clear API errors for a bad category; the database FK is the backstop
  async function assertCategory(userId, categoryId, type) {
    const { rows: [category] } = await db.query('SELECT type FROM categories WHERE id = $1 AND user_id = $2', [
      categoryId,
      userId,
    ]);
    if (!category) throw invalidCategory();
    if (category.type !== type) {
      throw new AppError(400, 'CATEGORY_TYPE_MISMATCH', `This category is for ${category.type}, not ${type}`, [
        { field: 'categoryId', message: `Choose an ${type} category` },
      ]);
    }
  }

  // A category deleted between the check and the write still fails safely
  async function mapWriteErrors(promise) {
    try {
      return await promise;
    } catch (err) {
      if (isForeignKeyViolation(err, 'transactions_category_fk')) throw invalidCategory();
      throw err;
    }
  }

  return {
    async list(userId, { page, pageSize, ...filters }) {
      const { where, params } = buildTransactionFilter(userId, filters);
      const offset = (page - 1) * pageSize;

      const [summaryResult, rowsResult] = await Promise.all([
        db.query(`SELECT ${SUMMARY_COLUMNS} FROM transactions t WHERE ${where}`, params),
        db.query(
          `SELECT ${COLUMNS} FROM transactions t JOIN categories c ON c.id = t.category_id
           WHERE ${where}
           ORDER BY t.transaction_date DESC, t.id DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, pageSize, offset],
        ),
      ]);

      const summary = toSummary(summaryResult.rows[0]);
      return {
        data: rowsResult.rows.map(toTransaction),
        pagination: {
          page,
          pageSize,
          total: summary.count,
          totalPages: Math.max(1, Math.ceil(summary.count / pageSize)),
        },
        summary,
      };
    },

    async getById(userId, transactionId) {
      const { rows: [row] } = await db.query(
        `SELECT ${COLUMNS} FROM transactions t JOIN categories c ON c.id = t.category_id
         WHERE t.id = $1 AND t.user_id = $2`,
        [transactionId, userId],
      );
      if (!row) throw notFound();
      return toTransaction(row);
    },

    async create(userId, { type, categoryId, amount, description, date }) {
      await assertCategory(userId, categoryId, type);
      const { rows: [row] } = await mapWriteErrors(
        db.query(
          `WITH t AS (
             INSERT INTO transactions (user_id, category_id, type, amount, description, transaction_date)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
           )
           SELECT ${COLUMNS} FROM t JOIN categories c ON c.id = t.category_id`,
          [userId, categoryId, type, amount, description, date],
        ),
      );
      return toTransaction(row);
    },

    async update(userId, transactionId, { type, categoryId, amount, description, date }) {
      await assertCategory(userId, categoryId, type);
      const { rows: [row] } = await mapWriteErrors(
        db.query(
          `WITH t AS (
             UPDATE transactions
             SET category_id = $3, type = $4, amount = $5, description = $6, transaction_date = $7
             WHERE id = $1 AND user_id = $2
             RETURNING *
           )
           SELECT ${COLUMNS} FROM t JOIN categories c ON c.id = t.category_id`,
          [transactionId, userId, categoryId, type, amount, description, date],
        ),
      );
      if (!row) throw notFound();
      return toTransaction(row);
    },

    async remove(userId, transactionId) {
      const { rowCount } = await db.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [
        transactionId,
        userId,
      ]);
      if (rowCount === 0) throw notFound();
    },

    // All rows matching the filters (no pagination), for CSV/Excel export
    async listForExport(userId, filters) {
      const { where, params } = buildTransactionFilter(userId, filters);
      const [summaryResult, rowsResult] = await Promise.all([
        db.query(`SELECT ${SUMMARY_COLUMNS} FROM transactions t WHERE ${where}`, params),
        db.query(
          `SELECT ${COLUMNS} FROM transactions t JOIN categories c ON c.id = t.category_id
           WHERE ${where}
           ORDER BY t.transaction_date DESC, t.id DESC
           LIMIT ${MAX_EXPORT_ROWS + 1}`,
          params,
        ),
      ]);
      if (rowsResult.rows.length > MAX_EXPORT_ROWS) {
        throw new AppError(400, 'EXPORT_TOO_LARGE',
          `Exports are limited to ${MAX_EXPORT_ROWS.toLocaleString('en-US')} rows. Narrow the filters and try again.`);
      }
      return { rows: rowsResult.rows.map(toTransaction), summary: toSummary(summaryResult.rows[0]) };
    },
  };
}
