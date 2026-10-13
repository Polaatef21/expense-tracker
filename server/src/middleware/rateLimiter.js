import { rateLimit } from 'express-rate-limit';

// Limits how many attempts one IP address can make per time window,
// slowing down password-guessing and mass sign-ups.
export function createAuthRateLimiter({ windowMs, max, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit: max,
    skipSuccessfulRequests, // for login: only failed attempts count
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many attempts. Please wait a few minutes and try again.',
        },
      });
    },
  });
}
