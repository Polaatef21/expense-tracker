import { Router } from 'express';
import { createDashboardController } from '../controllers/dashboard.controller.js';
import { validate } from '../middleware/validate.js';
import { dashboardQuerySchema } from '../validators/dashboard.validators.js';

// Mounted behind requireAuth (see app.js)
export function createDashboardRouter({ dashboardService }) {
  const router = Router();
  const controller = createDashboardController({ dashboardService });

  router.get('/', validate({ query: dashboardQuerySchema }), controller.summary);
  return router;
}
