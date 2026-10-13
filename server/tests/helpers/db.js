import pg from 'pg';
import { getDbConfig } from '../../src/config/db.js';

// Safety guard: tests must never touch the development database
export function testDbConfig() {
  const config = getDbConfig({ test: true });
  if (!config.database.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${config.database}": the test database name must end with _test`);
  }
  return config;
}

export async function connectTestDb() {
  const client = new pg.Client(testDbConfig());
  await client.connect();
  return client;
}

// Runs a statement that is expected to fail, inside a savepoint so the
// surrounding test transaction stays usable. Returns the PostgreSQL error.
export async function expectDbError(client, sql, params = []) {
  await client.query('SAVEPOINT expect_error');
  try {
    await client.query(sql, params);
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT expect_error');
    return err;
  }
  await client.query('RELEASE SAVEPOINT expect_error');
  throw new Error(`Expected statement to fail, but it succeeded: ${sql}`);
}
