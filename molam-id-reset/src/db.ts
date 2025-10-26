// src/db.ts
import pkg from 'pg';
import { env } from './config/env.js';

const { Pool } = pkg;

export const pool = new Pool({
    connectionString: env.PG_URL,  // Le mot de passe est déjà dans la string
});

export async function query(text: string, params?: any[]) {
    const res = await pool.query(text, params);
    return res;
}

// Optionnel pour garder l'ancien nom
export const db = { query };
