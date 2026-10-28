import type { Knex } from 'knex';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isSsl =
  process.env.DATABASE_SSL === 'true' ||
  Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require'));

const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isSsl ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      user: process.env.POSTGRES_USER || 'aita_admin',
      password: process.env.POSTGRES_PASSWORD || 'aita_secret_password',
      database: process.env.POSTGRES_DB || 'aita_autograding',
      ssl: isSsl ? { rejectUnauthorized: false } : false,
    };

export const knexConfig: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: connectionConfig,
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      extension: 'ts',
      tableName: 'knex_migrations',
    },
  },
  production: {
    client: 'pg',
    connection: connectionConfig,
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      extension: 'ts',
      tableName: 'knex_migrations',
    },
  },
};

export default knexConfig;
