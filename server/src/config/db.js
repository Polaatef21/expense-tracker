// Builds PostgreSQL connection settings from server/.env.
// Shared by the API, the migration runner, and the tests.
import './loadEnv.js';

const REQUIRED = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_NAME_TEST'];

export function getDbConfig({ test = false } = {}) {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required database variables in server/.env: ${missing.join(', ')}`);
  }
  if (process.env.DB_NAME === process.env.DB_NAME_TEST) {
    throw new Error('DB_NAME and DB_NAME_TEST must point to different databases');
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: test ? process.env.DB_NAME_TEST : process.env.DB_NAME,
  };
}
