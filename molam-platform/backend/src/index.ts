import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initializeApp, env } from './bootstrap';
import profileRoutes from './routes/profile.routes';

const app = express();

// Middlewares de sécurité
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(profileRoutes);

// Health check
app.get('/health', async (req, res) => {
    const { checkDatabaseHealth, checkS3Health } = await import('./bootstrap');

    const dbHealthy = await checkDatabaseHealth();
    const s3Healthy = await checkS3Health();

    res.json({
        status: dbHealthy && s3Healthy ? 'OK' : 'DEGRADED',
        timestamp: new Date().toISOString(),
        services: {
            database: dbHealthy ? 'OK' : 'ERROR',
            storage: s3Healthy ? 'OK' : 'ERROR'
        }
    });
});

// Route 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// Gestionnaire d'erreurs global
app.use((err: any, req: any, res: any, next: any) => {
    console.error('Erreur non gérée:', err);
    res.status(500).json({
        error: env.NODE_ENV === 'production' ? 'Erreur interne' : err.message
    });
});

// Démarrage du serveur
const startServer = async () => {
    try {
        await initializeApp();

        app.listen(env.PORT, () => {
            console.log(`🚀 Serveur Molam démarré sur le port ${env.PORT}`);
            console.log(`📊 Health check: http://localhost:${env.PORT}/health`);
            console.log(`👤 Profil API: http://localhost:${env.PORT}/api/profile/me`);
        });
    } catch (error) {
        console.error('❌ Erreur au démarrage:', error);
        process.exit(1);
    }
};

startServer();