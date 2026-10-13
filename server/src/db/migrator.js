// Applies numbered .sql migration files in order.
//  - Records each applied file (with a checksum) in a tracking table.
//  - Skips files already recorded there, so running it twice is safe.
//  - Runs each file inside its own transaction: it either fully applies
//    (including its tracking row) or changes nothing.
//  - Holds an advisory lock so two runners can't migrate at the same time.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const LOCK_KEY = 482_917_301; // arbitrary app-wide constant for pg_advisory_lock
const MIGRATION_FILE = /^\d+_[\w-]+\.sql$/;
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
// A migration must not manage its own transaction, or atomicity is lost.
// (Bare "END;" is not matched: it legitimately closes PL/pgSQL function bodies.)
const TRANSACTION_CONTROL = /^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\s*;/im;

// Normalize line endings so a Windows (CRLF) checkout hashes the same as LF
const checksumOf = (sql) => createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');

export async function runMigrations({
  connection,
  dir,
  table = 'schema_migrations',
  log = () => {},
}) {
  // The table name is interpolated into SQL, so only allow plain identifiers
  if (!SAFE_IDENTIFIER.test(table)) throw new Error(`Invalid migrations table name: ${table}`);

  const files = (await readdir(dir)).filter((f) => MIGRATION_FILE.test(f)).sort();
  const client = new pg.Client(connection);
  await client.connect();

  const applied = [];
  const skipped = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        filename   TEXT        PRIMARY KEY,
        checksum   TEXT        NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    // Read the tracking table only after taking the lock, so the list is current
    const { rows } = await client.query(`SELECT filename, checksum FROM ${table}`);
    const recorded = new Map(rows.map((r) => [r.filename, r.checksum]));

    for (const file of files) {
      const sql = await readFile(path.join(dir, file), 'utf8');
      const checksum = checksumOf(sql);

      if (recorded.has(file)) {
        if (recorded.get(file) !== checksum) {
          throw new Error(
            `Migration ${file} was modified after it was applied. ` +
              'Create a new migration file instead of editing an applied one.',
          );
        }
        skipped.push(file);
        continue;
      }

      if (TRANSACTION_CONTROL.test(sql)) {
        throw new Error(`Migration ${file} must not contain BEGIN/COMMIT/ROLLBACK; the runner manages transactions.`);
      }

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(`INSERT INTO ${table} (filename, checksum) VALUES ($1, $2)`, [file, checksum]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`Migration ${file} failed and was rolled back: ${err.message}`, { cause: err });
      }
      applied.push(file);
      log(`applied  ${file}`);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    await client.end();
  }

  return { applied, skipped };
}
