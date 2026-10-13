import { z } from 'zod';
import { optionalParam, transactionType } from './common.js';

export const categoryBodySchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(50, 'Name must be at most 50 characters'),
  type: transactionType,
});

export const listCategoriesQuerySchema = z.object({
  type: optionalParam(transactionType),
});
