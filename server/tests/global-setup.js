// Runs once before all tests: brings the TEST database schema up to date.
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../src/db/migrator.js';
import { testDbConfig } from './helpers/db.js';

export default async function setup() {
  await runMigrations({
    connection: testDbConfig(),
    dir: fileURLToPath(new URL('../db/migrations/', import.meta.url)),
  });
}
