import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
export const pool = new Pool({
    connectionString: process.env.PG_URL,
});

export async function query(text: string, params?: any[]) {
    const res = await pool.query(text, params);
    return res;
}
