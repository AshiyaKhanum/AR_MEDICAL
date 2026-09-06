/* eslint-disable no-console */
// Idempotent production DB bootstrap: applies the hand-written initial schema
// migration via a plain `pg` client if the schema isn't present yet, then
// applies any later additive migrations idempotently on every startup.
//
// Why not `prisma migrate deploy`? This project intentionally runs Prisma in
// engine-less "client" mode (see prisma.config.ts / README) to work in
// network-locked-down environments. That WASM-based schema engine has a known
// bug applying schema diffs against certain Postgres setups, so schema
// changes are shipped as hand-written SQL and applied directly here instead -
// safe to run on every deploy/restart since each step checks first.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

// Later, additive schema changes (new nullable columns, indexes, etc.) are shipped
// as their own migration folders here and applied idempotently (using
// IF NOT EXISTS-guarded SQL) on every startup.
const INCREMENTAL_MIGRATIONS = ['20260906143000_add_rack_number'];

function makeClient(connectionString: string) {
  return new Client({
    connectionString,
    ssl: connectionString.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
  });
}

async function applyInitialMigrationIfNeeded(connectionString: string) {
  const client = makeClient(connectionString);
  await client.connect();
  try {
    const existing = await client.query("SELECT to_regclass('public.users') AS reg");
    if (existing.rows[0]?.reg) {
      console.log('[dbBootstrap] Schema already present - skipping initial migration.');
      return;
    }

    console.log('[dbBootstrap] No schema found - applying initial migration...');
    const migrationPath = path.join(__dirname, '..', '..', 'prisma', 'migrations', '20260905205829_init', 'migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('[dbBootstrap] Initial migration applied successfully.');
  } finally {
    await client.end();
  }
}

async function applyIncrementalMigrations(connectionString: string) {
  const client = makeClient(connectionString);
  await client.connect();
  try {
    for (const name of INCREMENTAL_MIGRATIONS) {
      const migrationPath = path.join(__dirname, '..', '..', 'prisma', 'migrations', name, 'migration.sql');
      if (!fs.existsSync(migrationPath)) continue;
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(sql);
      console.log(`[dbBootstrap] Incremental migration "${name}" applied (or already up to date).`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  await applyInitialMigrationIfNeeded(connectionString);
  await applyIncrementalMigrations(connectionString);
}

main().catch((err) => {
  console.error('[dbBootstrap] Failed:', err);
  process.exit(1);
});
