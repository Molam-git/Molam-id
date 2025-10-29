// src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Chargement des variables d'environnement
dotenv.config();

// Import des routes
import rbacRoutes from '../api/rbac.routes';
import { requireAuth } from '../middleware/jwt';
import { auditLog } from '../middleware/audit';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de sécurité
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limite chaque IP à 100 requêtes par windowMs
});
app.use(limiter);

// Routes de santé
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes RBAC protégées
app.use('/api/id/rbac', requireAuth, rbacRoutes);

// Middleware de logging d'audit
app.use(auditLog('REQUEST'));

// Gestion des erreurs 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// Middleware de gestion d'erreurs global
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Erreur serveur:', error);
    res.status(500).json({
        error: 'Erreur interne du serveur',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur Molam ID démarré sur le port ${PORT}`);
    console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
});

export default app;