import { Router } from 'express';
import { createHealthController } from '../controllers/health.controller.js';

export function createHealthRouter(deps) {
  const router = Router();
  router.get('/', createHealthController(deps));
  return router;
}
