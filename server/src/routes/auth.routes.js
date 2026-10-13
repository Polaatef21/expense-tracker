import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import { createAuthRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/auth.validators.js';

export function createAuthRouter({ authService, requireAuth, rateLimit }) {
  const router = Router();
  const controller = createAuthController({ authService });

  const registerLimiter = createAuthRateLimiter({ windowMs: rateLimit.windowMs, max: rateLimit.authMax });
  const loginLimiter = createAuthRateLimiter({
    windowMs: rateLimit.windowMs,
    max: rateLimit.authMax,
    skipSuccessfulRequests: true,
  });

  router.post('/register', registerLimiter, validate({ body: registerSchema }), controller.register);
  router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
  router.get('/me', requireAuth, controller.me);
  return router;
}
