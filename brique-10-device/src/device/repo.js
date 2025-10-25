// repo.js - Database connection pool
import pkg from 'pg';
const { Pool } = pkg;
import { deviceCfg } from './config.js';

export const pool = new Pool({ connectionString: deviceCfg.pgUrl });
