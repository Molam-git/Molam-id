import { Pool } from 'pg';

export const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'molam',
    password: process.env.DB_PASS || 'password',
    port: parseInt(process.env.DB_PORT || '5432'),
});