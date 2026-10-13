// Verifies the migration runner: tracking, idempotency, atomicity, and tamper detection.
// Uses a temporary migrations folder and a separate tracking table
// (schema_migrations_probe) so the real schema_migrations is never touched.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../src/db/migrator.js';
import { connectTestDb, testDbConfig } from './helpers/db.js';

const TABLE = 'schema_migrations_probe';
let dir;
let db;

async function cleanup() {
  await db.query(`DROP TABLE IF EXISTS migrator_probe_a, migrator_probe_b, migrator_probe_c, ${TABLE}`);
}

async function tableExists(name) {
  const { rows } = await db.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${name}`]);
  return rows[0].exists;
}

async function recordedFiles() {
  const { rows } = await db.query(`SELECT filename FROM ${TABLE} ORDER BY filename`);
  return rows.map((r) => r.filename);
}

const run = () => runMigrations({ connection: testDbConfig(), dir, table: TABLE });

beforeAll(async () => {
  db = await connectTestDb();
  await cleanup();
  dir = await mkdtemp(path.join(os.tmpdir(), 'migrator-test-'));
});

afterAll(async () => {
  await cleanup();
  await db.end();
  await rm(dir, { recursive: true, force: true });
});

describe('migration runner', () => {
  it('applies pending migrations in order and records them', async () => {
    await writeFile(path.join(dir, '001_a.sql'), 'CREATE TABLE migrator_probe_a (id INT);');
    const result = await run();
    expect(result).toEqual({ applied: ['001_a.sql'], skipped: [] });
    expect(await tableExists('migrator_probe_a')).toBe(true);
    expect(await recordedFiles()).toEqual(['001_a.sql']);
  });

  it('skips already-applied migrations on a second run (checks the tracking table first)', async () => {
    // Re-applying 001 would fail with "relation already exists", so success proves it was skipped
    const result = await run();
    expect(result).toEqual({ applied: [], skipped: ['001_a.sql'] });
    expect(await recordedFiles()).toEqual(['001_a.sql']);
  });

  it('rolls back a failing migration completely and does not record it', async () => {
    await writeFile(
      path.join(dir, '002_b.sql'),
      'CREATE TABLE migrator_probe_b (id INT);\nINSERT INTO migrator_probe_b VALUES (1);\nSELECT 1 / 0;',
    );
    await expect(run()).rejects.toThrow(/002_b\.sql failed and was rolled back: division by zero/);
    // The CREATE TABLE and INSERT that ran before the error were undone
    expect(await tableExists('migrator_probe_b')).toBe(false);
    expect(await recordedFiles()).toEqual(['001_a.sql']);
  });

  it('applies only the fixed migration on the next run', async () => {
    await writeFile(path.join(dir, '002_b.sql'), 'CREATE TABLE migrator_probe_b (id INT);');
    const result = await run();
    expect(result).toEqual({ applied: ['002_b.sql'], skipped: ['001_a.sql'] });
    expect(await tableExists('migrator_probe_b')).toBe(true);
    expect(await recordedFiles()).toEqual(['001_a.sql', '002_b.sql']);
  });

  it('treats CRLF and LF line endings as the same file', async () => {
    await writeFile(path.join(dir, '003_c.sql'), 'CREATE TABLE migrator_probe_c (\n  id INT\n);');
    await run();
    await writeFile(path.join(dir, '003_c.sql'), 'CREATE TABLE migrator_probe_c (\r\n  id INT\r\n);');
    const result = await run();
    expect(result.applied).toEqual([]);
    expect(result.skipped).toContain('003_c.sql');
  });

  it('refuses to continue when an applied migration was edited', async () => {
    await writeFile(path.join(dir, '001_a.sql'), 'CREATE TABLE migrator_probe_a (id INT, extra TEXT);');
    await expect(run()).rejects.toThrow(/001_a\.sql was modified after it was applied/);
    await writeFile(path.join(dir, '001_a.sql'), 'CREATE TABLE migrator_probe_a (id INT);'); // restore
  });

  it('rejects a migration that manages its own transaction', async () => {
    await writeFile(path.join(dir, '004_d.sql'), 'BEGIN;\nCREATE TABLE migrator_probe_d (id INT);\nCOMMIT;');
    await expect(run()).rejects.toThrow(/must not contain BEGIN\/COMMIT\/ROLLBACK/);
    expect(await tableExists('migrator_probe_d')).toBe(false);
    expect(await recordedFiles()).not.toContain('004_d.sql');
    await rm(path.join(dir, '004_d.sql'));
  });

  it('ignores files that are not numbered .sql migrations', async () => {
    await writeFile(path.join(dir, 'notes.txt'), 'not a migration');
    await writeFile(path.join(dir, 'draft.sql'), 'SELECT 1 / 0;');
    const result = await run();
    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual(['001_a.sql', '002_b.sql', '003_c.sql']);
  });

  it('rejects an unsafe tracking table name', async () => {
    await expect(
      runMigrations({ connection: testDbConfig(), dir, table: 'x; DROP TABLE users' }),
    ).rejects.toThrow(/Invalid migrations table name/);
  });
});
