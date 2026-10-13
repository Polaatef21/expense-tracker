import { z } from 'zod';
import {
  amount,
  dateRangeFields,
  description,
  id,
  isoDate,
  optionalParam,
  transactionType,
  validDateRange,
} from './common.js';

export const transactionBodySchema = z.object({
  type: transactionType,
  categoryId: id,
  amount,
  description,
  date: isoDate,
});

const filterFields = {
  ...dateRangeFields,
  type: optionalParam(transactionType),
  categoryId: optionalParam(id),
};

export const listTransactionsQuerySchema = z
  .object({
    ...filterFields,
    page: optionalParam(z.coerce.number().int().min(1, 'Page must be 1 or more')).default(1),
    pageSize: optionalParam(
      z.coerce.number().int().min(1).max(100, 'Page size must be at most 100'),
    ).default(20),
  })
  .refine(...validDateRange);

export const exportQuerySchema = z
  .object({
    ...filterFields,
    format: z.enum(['csv', 'xlsx'], { error: 'Format must be "csv" or "xlsx"' }),
  })
  .refine(...validDateRange);
