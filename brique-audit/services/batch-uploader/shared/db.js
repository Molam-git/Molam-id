// db.js
import { Pool } from 'pg';
const pool = new Pool({
    connectionString: process.env.POSTGRES_DSN
});
export default pool;
