// Usage:
//   npm run db:migrate        -> development database (DB_NAME)
//   npm run db:migrate:test   -> test database (DB_NAME_TEST)
import { fileURLToPath } from 'node:url';
import { getDbConfig } from '../src/config/db.js';
import { runMigrations } from '../src/db/migrator.js';

const test = process.argv.includes('--test');
const dir = fileURLToPath(new URL('../db/migrations/', import.meta.url));

try {
  const connection = getDbConfig({ test });
  console.log(`Migrating database "${connection.database}"...`);
  const { applied, skipped } = await runMigrations({ connection, dir, log: console.log });
  console.log(`Done: ${applied.length} applied, ${skipped.length} already applied.`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
