import { neon } from '@neondatabase/serverless';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  const sql = neon(process.env.DATABASE_URL);
  await sql`DROP SCHEMA public CASCADE`;
  await sql`CREATE SCHEMA public`;
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
  console.log('Dropped all tables in public schema and enabled postgis');
}

main().catch(console.error);
