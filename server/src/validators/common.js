// Reusable zod building blocks for request validation.
import { z } from 'zod';

const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Query strings send "" for empty inputs; treat that as "not provided"
export const optionalParam = (schema) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

export const id = z.coerce
  .number({ error: 'Must be a valid ID' })
  .int('Must be a valid ID')
  .positive('Must be a valid ID')
  .max(Number.MAX_SAFE_INTEGER, 'Must be a valid ID');

export const idParams = z.object({ id });

export const transactionType = z.enum(['income', 'expense'], {
  error: 'Type must be "income" or "expense"',
});

// A real calendar date in YYYY-MM-DD form, between 1900 and 2100
export const isoDate = z.string({ error: 'Date is required (YYYY-MM-DD)' }).superRefine((value, ctx) => {
  if (!DATE_PATTERN.test(value)) {
    ctx.addIssue({ code: 'custom', message: 'Date must use the YYYY-MM-DD format' });
    return;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    ctx.addIssue({ code: 'custom', message: 'Date is not a real calendar date' });
    return;
  }
  if (value < '1900-01-01' || value > '2100-12-31') {
    ctx.addIssue({ code: 'custom', message: 'Date must be between 1900 and 2100' });
  }
});

// Accepts 12, 12.5, "12.50"; rejects 0, negatives, >2 decimals, exponents, NaN.
// Output is the exact decimal string, which PostgreSQL stores without rounding.
export const amount = z
  .union([z.string(), z.number()], { error: 'Amount is required' })
  .transform((v) => (typeof v === 'number' ? String(v) : v.trim()))
  .superRefine((value, ctx) => {
    if (!AMOUNT_PATTERN.test(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Amount must be a positive number with at most 2 decimal places (max 9,999,999,999.99)',
      });
    } else if (Number(value) <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Amount must be greater than 0' });
    }
  });

// Optional text up to 255 characters; blank becomes null
export const description = z
  .union([z.string(), z.null()], { error: 'Description must be text' })
  .optional()
  .transform((v) => {
    if (v == null) return null;
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((v) => v === null || [...v].length <= 255, 'Description must be at most 255 characters');

// Shared by list, export, and dashboard: an optional date range in the query string
export const dateRangeFields = {
  startDate: optionalParam(isoDate),
  endDate: optionalParam(isoDate),
};

export const validDateRange = [
  (q) => !q.startDate || !q.endDate || q.startDate <= q.endDate,
  { message: 'Start date must be on or before end date', path: ['endDate'] },
];
