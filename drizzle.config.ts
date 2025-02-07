import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    // These are placeholder values since we're using PGlite
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'agent-view',
  },
} satisfies Config; 