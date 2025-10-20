import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

// Singleton pattern for development
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

export const client = globalForDb.client ?? postgres(process.env.POSTGRES_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });
