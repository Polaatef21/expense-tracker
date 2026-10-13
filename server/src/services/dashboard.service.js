import { buildTransactionFilter, moneySum, signedAmount, SUMMARY_COLUMNS } from './transactionFilters.js';

// All figures are computed in SQL with exact NUMERIC arithmetic and returned
// as decimal strings ("1234.50"), scoped to the authenticated user.
export function createDashboardService({ db }) {
  return {
    async summary(userId, { startDate, endDate } = {}) {
      const { where, params } = buildTransactionFilter(userId, { startDate, endDate });

      const totalsSql = `SELECT ${SUMMARY_COLUMNS} FROM transactions t WHERE ${where}`;

      // "Current balance" is all-time, independent of the selected period
      const balanceSql = `SELECT ${moneySum(signedAmount('t'))} AS balance FROM transactions t WHERE t.user_id = $1`;

      const byCategorySql = `
        SELECT c.id, c.name, t.type, ${moneySum('t.amount')} AS total, count(*)::int AS count
        FROM transactions t JOIN categories c ON c.id = t.category_id
        WHERE ${where}
        GROUP BY c.id, c.name, t.type
        ORDER BY SUM(t.amount) DESC, c.name`;

      // One row per month in the period, including months with no activity.
      // Without explicit dates the range spans the user's first..last transaction.
      const startParam = params.length + 1;
      const endParam = params.length + 2;
      const monthlySql = `
        WITH filtered AS (
          SELECT t.transaction_date, t.type, t.amount FROM transactions t WHERE ${where}
        ),
        bounds AS (
          SELECT date_trunc('month', COALESCE($${startParam}::date, MIN(transaction_date))::timestamp)::date AS first_month,
                 date_trunc('month', COALESCE($${endParam}::date, MAX(transaction_date))::timestamp)::date AS last_month
          FROM filtered
        ),
        months AS (
          SELECT generate_series(first_month, last_month, interval '1 month')::date AS month
          FROM bounds WHERE first_month IS NOT NULL AND last_month IS NOT NULL
        )
        SELECT to_char(m.month, 'YYYY-MM') AS month,
               ${moneySum('f.amount', "f.type = 'income'")} AS income,
               ${moneySum('f.amount', "f.type = 'expense'")} AS expense,
               ${moneySum(signedAmount('f'))} AS net
        FROM months m
        LEFT JOIN filtered f ON date_trunc('month', f.transaction_date::timestamp)::date = m.month
        GROUP BY m.month
        ORDER BY m.month`;

      const [totals, balance, byCategory, monthly] = await Promise.all([
        db.query(totalsSql, params),
        db.query(balanceSql, [userId]),
        db.query(byCategorySql, params),
        db.query(monthlySql, [...params, startDate ?? null, endDate ?? null]),
      ]);

      const categoryRows = (type) =>
        byCategory.rows
          .filter((r) => r.type === type)
          .map((r) => ({ categoryId: r.id, name: r.name, total: r.total, count: r.count }));

      return {
        period: { startDate: startDate ?? null, endDate: endDate ?? null },
        totals: totals.rows[0],
        currentBalance: balance.rows[0].balance,
        expenseByCategory: categoryRows('expense'),
        incomeByCategory: categoryRows('income'),
        monthly: monthly.rows,
      };
    },
  };
}
