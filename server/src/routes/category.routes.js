import { Router } from 'express';
import { createCategoryController } from '../controllers/category.controller.js';
import { validate } from '../middleware/validate.js';
import { categoryBodySchema, listCategoriesQuerySchema } from '../validators/category.validators.js';
import { idParams } from '../validators/common.js';

// Mounted behind requireAuth (see app.js)
export function createCategoryRouter({ categoryService }) {
  const router = Router();
  const controller = createCategoryController({ categoryService });

  router.get('/', validate({ query: listCategoriesQuerySchema }), controller.list);
  router.post('/', validate({ body: categoryBodySchema }), controller.create);
  router.put('/:id', validate({ params: idParams, body: categoryBodySchema }), controller.update);
  router.delete('/:id', validate({ params: idParams }), controller.remove);
  return router;
}
