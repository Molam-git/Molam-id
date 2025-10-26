// src/app.ts
import express, { type Request, type Response, type NextFunction } from 'express';
import { passwordRouter } from './routes/password.js';
import { pinRouter } from './routes/pin.js';
import { ussdRouter } from './routes/ussd.js';
import { pool } from './db.js';
import { env } from './config/env.js';

const app = express();

// Middleware pour parser le JSON
app.use(express.json());

// Test de connexion à la base
(async () => {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connected successfully:', result.rows[0]);
    } catch (err: unknown) {
        console.error('❌ Database connection failed:', err);
    }
})();

// Mount routers avec try/catch pour éviter les erreurs non capturées
app.use('/api/id/password', passwordRouter);
app.use('/api/id/pin', pinRouter);
app.use('/api/id/ussd', ussdRouter);

// Middleware global de gestion d'erreurs
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Lancement du serveur
app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
});
