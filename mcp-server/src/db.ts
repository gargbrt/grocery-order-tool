import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL env var is required (same Postgres/Supabase instance as the main app)");
}

// A standalone `pg` pool rather than reusing the Next.js app's Prisma client
// on purpose: this MCP server is meant to be deployable independently (e.g.
// on Render/Fly, separate from the Vercel app), so it shouldn't require the
// whole Next.js project as a dependency. It talks to the exact same tables.
export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}
