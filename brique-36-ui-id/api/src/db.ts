import pgPromise from 'pg-promise';

const pgp = pgPromise({
  capSQL: true
});

const db = pgp({
  connectionString: process.env.DATABASE_URL || 'postgresql://molam:molam_pass@localhost:5432/molam',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export default db;
