import { Pool } from "pg";
import { config } from "../profile/config";
export const pool = new Pool({ connectionString: config.database.url });
