// Builds the Express application. Does not open a network port (see server.js),
// so tests can exercise it directly with supertest.
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createErrorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { createRequestLogger } from './middleware/requestLogger.js';
import { createRequireAuth } from './middleware/requireAuth.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createCategoryRouter } from './routes/category.routes.js';
import { createDashboardRouter } from './routes/dashboard.routes.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createTransactionRouter } from './routes/transaction.routes.js';
import { createAuthService } from './services/auth.service.js';
import { createCategoryService } from './services/category.service.js';
import { createDashboardService } from './services/dashboard.service.js';
import { createTransactionService } from './services/transaction.service.js';

export function createApp({ db, config, logger, healthTimeoutMs = 2_000 }) {
  const app = express();
  app.disable('x-powered-by'); // don't advertise the framework

  app.use(createRequestLogger(logger));

  // Security headers (Content-Security-Policy, X-Content-Type-Options, ...)
  app.use(helmet());

  // Only the configured front-end origin(s) may call the API from a browser.
  // Auth uses the Authorization header (not cookies), so credentials stay off.
  app.use(
    cors({
      origin: config.clientOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Disposition'], // lets the client read export file names
      maxAge: 600,
    }),
  );

  // Parse JSON bodies; reject anything larger than 10 KB
  app.use(express.json({ limit: '10kb' }));

  // Private financial data must never be stored by browsers or proxies
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const services = {
    authService: createAuthService({ db, auth: config.auth }),
    categoryService: createCategoryService({ db }),
    transactionService: createTransactionService({ db }),
    dashboardService: createDashboardService({ db }),
  };
  const requireAuth = createRequireAuth(config.auth);

  // Public routes
  app.use('/api/health', createHealthRouter({ db, logger, timeoutMs: healthTimeoutMs }));
  app.use('/api/auth', createAuthRouter({ ...services, requireAuth, rateLimit: config.rateLimit }));

  // Private routes: everything below requires a valid JWT
  app.use('/api/categories', requireAuth, createCategoryRouter(services));
  app.use('/api/transactions', requireAuth, createTransactionRouter(services));
  app.use('/api/dashboard', requireAuth, createDashboardRouter(services));

  app.use(notFound);
  app.use(createErrorHandler(logger));

  return app;
}
