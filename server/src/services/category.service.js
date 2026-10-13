import { DEFAULT_CATEGORIES } from '../constants/defaultCategories.js';
import { AppError } from '../utils/AppError.js';
import { isForeignKeyViolation, isUniqueViolation } from '../utils/pgErrors.js';

const toCategory = (row) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  transactionCount: row.transaction_count ?? 0,
});

const notFound = () => new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
const duplicate = () =>
  new AppError(409, 'CATEGORY_EXISTS', 'You already have a category with this name and type', [
    { field: 'name', message: 'This name is already used' },
  ]);

// Inserts the default categories for a new user. Must run on the same `client`
// as the user INSERT so both succeed or fail together.
export async function insertDefaultCategories(client, userId) {
  await client.query(
    `INSERT INTO categories (user_id, name, type)
     SELECT $1, d.name, d.type FROM unnest($2::text[], $3::text[]) AS d(name, type)`,
    [userId, DEFAULT_CATEGORIES.map((c) => c.name), DEFAULT_CATEGORIES.map((c) => c.type)],
  );
}

// Every query includes `user_id = <authenticated user>`: another user's
// category simply doesn't exist from this user's point of view (404).
export function createCategoryService({ db }) {
  return {
    async list(userId, { type } = {}) {
      const params = [userId];
      let typeFilter = '';
      if (type) {
        params.push(type);
        typeFilter = 'AND c.type = $2';
      }
      const { rows } = await db.query(
        `SELECT c.id, c.name, c.type, count(t.id)::int AS transaction_count
         FROM categories c
         LEFT JOIN transactions t ON t.category_id = c.id
         WHERE c.user_id = $1 ${typeFilter}
         GROUP BY c.id
         ORDER BY c.type, lower(c.name)`,
        params,
      );
      return rows.map(toCategory);
    },

    async create(userId, { name, type }) {
      try {
        const { rows } = await db.query(
          'INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3) RETURNING id, name, type',
          [userId, name, type],
        );
        return toCategory(rows[0]);
      } catch (err) {
        if (isUniqueViolation(err, 'categories_user_type_name_unique')) throw duplicate();
        throw err;
      }
    },

    async update(userId, categoryId, { name, type }) {
      try {
        const { rows } = await db.query(
          `UPDATE categories SET name = $3, type = $4
           WHERE id = $1 AND user_id = $2
           RETURNING id, name, type,
             (SELECT count(*)::int FROM transactions WHERE category_id = categories.id) AS transaction_count`,
          [categoryId, userId, name, type],
        );
        if (!rows[0]) throw notFound();
        return toCategory(rows[0]);
      } catch (err) {
        if (isUniqueViolation(err, 'categories_user_type_name_unique')) throw duplicate();
        if (isForeignKeyViolation(err, 'transactions_category_fk')) {
          throw new AppError(409, 'CATEGORY_IN_USE',
            "This category's type can't change because it has transactions. Create a new category instead.");
        }
        throw err;
      }
    },

    async remove(userId, categoryId) {
      try {
        const { rowCount } = await db.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [
          categoryId,
          userId,
        ]);
        if (rowCount === 0) throw notFound();
      } catch (err) {
        if (isForeignKeyViolation(err, 'transactions_category_fk')) {
          throw new AppError(409, 'CATEGORY_IN_USE',
            'This category has transactions. Move or delete those transactions first.');
        }
        throw err;
      }
    },
  };
}
