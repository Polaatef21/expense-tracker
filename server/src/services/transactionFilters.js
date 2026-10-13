// Builds the WHERE clause shared by the transaction list, the exports, and the
// dashboard, so all three always apply exactly the same filters.
// The authenticated user's id is ALWAYS the first condition.
// Values only ever go into `params` ($1, $2, ...), never into the SQL text.
export function buildTransactionFilter(userId, { startDate, endDate, type, categoryId } = {}) {
  const params = [userId];
  const conditions = ['t.user_id = $1'];

  const add = (column, operator, value) => {
    params.push(value);
    conditions.push(`${column} ${operator} $${params.length}`);
  };

  if (startDate) add('t.transaction_date', '>=', startDate);
  if (endDate) add('t.transaction_date', '<=', endDate);
  if (type) add('t.type', '=', type);
  if (categoryId) add('t.category_id', '=', categoryId);

  return { where: conditions.join(' AND '), params };
}

// SUM over NUMERIC money columns (optionally only rows matching `filter`),
// formatted as an exact string with 2 decimals; 0.00 when there are no rows.
export const moneySum = (expression, filter) =>
  `COALESCE(SUM(${expression})${filter ? ` FILTER (WHERE ${filter})` : ''}, 0)::numeric(20,2)::text`;

// Income counts positive, expenses negative
export const signedAmount = (alias) =>
  `CASE WHEN ${alias}.type = 'income' THEN ${alias}.amount ELSE -${alias}.amount END`;

// count / income / expense / net for the rows of `transactions t`
export const SUMMARY_COLUMNS = `count(*)::int AS count,
  ${moneySum('t.amount', "t.type = 'income'")} AS income,
  ${moneySum('t.amount', "t.type = 'expense'")} AS expense,
  ${moneySum(signedAmount('t'))} AS net`;
