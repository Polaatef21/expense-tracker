// Verifies that the credentials in server/.env can connect to both databases.
// Usage: npm run db:check
// Prints only non-sensitive info — never the password.
import pg from 'pg';
import { getDbConfig } from '../src/config/db.js';

async function check(config) {
  const client = new pg.Client(config);
  try {
    await client.connect();
    const { rows } = await client.query(
      'SELECT current_user, current_database(), current_setting($1) AS version',
      ['server_version'],
    );
    const { current_user: user, current_database: db, version } = rows[0];
    console.log(`OK   ${db} as ${user} (PostgreSQL ${version})`);
    return true;
  } catch (err) {
    console.error(`FAIL ${config.database}: ${err.message}`);
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

try {
  const results = [await check(getDbConfig()), await check(getDbConfig({ test: true }))];
  process.exitCode = results.every(Boolean) ? 0 : 1;
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
