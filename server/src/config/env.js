// Reads and validates the non-database application settings.
// Fails fast with a clear message instead of starting with a broken config.
import './loadEnv.js';

const NODE_ENVS = ['development', 'production', 'test'];

function parseOrigins(raw) {
  const origins = (raw ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0) {
    throw new Error('CLIENT_ORIGIN must list at least one allowed front-end origin');
  }
  for (const origin of origins) {
    let url;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CLIENT_ORIGIN contains an invalid URL: ${origin}`);
    }
    // An origin is scheme + host + port only, e.g. http://localhost:5173
    if (url.origin !== origin) {
      throw new Error(`CLIENT_ORIGIN must be a bare origin without path or trailing slash: ${origin}`);
    }
  }
  return origins;
}

function parseAuth() {
  const jwtSecret = process.env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be a random string of at least 32 characters');
  }

  const rawExpiry = process.env.JWT_EXPIRES_IN || '1d';
  if (!/^\d+[smhd]?$/.test(rawExpiry)) {
    throw new Error('JWT_EXPIRES_IN must look like 15m, 12h, 1d, or a number of seconds');
  }
  // jsonwebtoken reads a unit-less *string* as milliseconds, so pass plain numbers as seconds
  const jwtExpiresIn = /^\d+$/.test(rawExpiry) ? Number(rawExpiry) : rawExpiry;

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
  if (!Number.isInteger(saltRounds) || saltRounds < 10 || saltRounds > 15) {
    throw new Error('BCRYPT_SALT_ROUNDS must be an integer between 10 and 15');
  }

  return { jwtSecret, jwtExpiresIn, saltRounds };
}

export function getAppConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (!NODE_ENVS.includes(nodeEnv)) {
    throw new Error(`NODE_ENV must be one of: ${NODE_ENVS.join(', ')}`);
  }

  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return {
    nodeEnv,
    port,
    clientOrigins: parseOrigins(process.env.CLIENT_ORIGIN),
    auth: parseAuth(),
    // Brute-force protection for login/register: attempts per IP per window
    rateLimit: { windowMs: 15 * 60 * 1000, authMax: 20 },
  };
}
