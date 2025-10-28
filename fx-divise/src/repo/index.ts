import { Pool } from "pg";

export const pool = new Pool({
    user: process.env.DB_USER || 'molam',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'molam_fx',
    password: process.env.DB_PASSWORD || 'molam_password',
    port: parseInt(process.env.DB_PORT || '5432'),
});