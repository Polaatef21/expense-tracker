import { Router } from 'express';
import { createTransactionController } from '../controllers/transaction.controller.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import {
  exportQuerySchema,
  listTransactionsQuerySchema,
  transactionBodySchema,
} from '../validators/transaction.validators.js';

// Mounted behind requireAuth (see app.js)
export function createTransactionRouter({ transactionService, categoryService }) {
  const router = Router();
  const controller = createTransactionController({ transactionService, categoryService });

  router.get('/', validate({ query: listTransactionsQuerySchema }), controller.list);
  // Must come before '/:id' so "export" isn't treated as an id
  router.get('/export', validate({ query: exportQuerySchema }), controller.exportFile);
  router.get('/:id', validate({ params: idParams }), controller.getById);
  router.post('/', validate({ body: transactionBodySchema }), controller.create);
  router.put('/:id', validate({ params: idParams, body: transactionBodySchema }), controller.update);
  router.delete('/:id', validate({ params: idParams }), controller.remove);
  return router;
}
