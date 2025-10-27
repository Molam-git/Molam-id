import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { cfg } from './config/index.js';
import mfaRoutes from './routes/mfa-routes.js';
import { pool, redis } from './utils/repos.js';
import type { Request, Response, NextFunction } from 'express';

const app = express();

// Middleware de sécurité
app.use(helmet({
    crossOriginResourcePolicy: { policy: "same-site" }
}));

app.use(cors({
    origin: [/\.molam\.com$/, /\.molam\.local$/],
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Routes MFA
app.use('/v1/mfa', mfaRoutes);

// Health checks
app.get('/healthz', async (_req: Request, res: Response) => {
    try {
        // Vérifier la base de données
        await pool.query('SELECT 1');

        // Vérifier Redis
        await redis.ping();

        res.status(200).json({
            status: 'ok',
            database: 'connected',
            redis: 'connected'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

app.get('/readyz', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ready' });
});

// Gestion des routes non trouvées
app.use('*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'route_not_found' });
});

// Gestionnaire d'erreurs global
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Erreur globale:', error);
    res.status(500).json({
        error: 'internal_server_error',
        message: 'Une erreur interne est survenue'
    });
});

// Démarrage du serveur
const server = app.listen(cfg.port, () => {
    console.log(`🚀 Service MFA démarré sur le port ${cfg.port}`);
    console.log(`📍 Environnement: ${cfg.nodeEnv}`);
    console.log(`🔐 RP ID WebAuthn: ${cfg.rpId}`);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
    console.log('🛑 Arrêt du service MFA...');
    server.close(async () => {
        await pool.end();
        await redis.quit();
        process.exit(0);
    });
});

export { app };