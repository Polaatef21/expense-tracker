import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';

// Protects private routes. Expects "Authorization: Bearer <token>".
// On success sets req.user = { id }, which every service uses to scope queries.
export function createRequireAuth({ jwtSecret }) {
  return (req, res, next) => {
    const [scheme, token, extra] = (req.get('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token || extra !== undefined) {
      return next(new AppError(401, 'AUTH_REQUIRED', 'Please log in to continue'));
    }

    try {
      const payload = verifyToken(token, jwtSecret);
      req.user = { id: Number(payload.sub) };
      return next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.'));
      }
      return next(new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token. Please log in again.'));
    }
  };
}
