import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import sessionRoutes from './routes/session.routes';
import { requireAuth } from './middleware/jwt';

const app = express();

// Étendre l'interface Request d'Express
declare global {
    namespace Express {
        interface Request {
            id: string;
        }
    }
}

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "same-site" }
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://molam.io'],
    credentials: true
}));

// Rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // stricter limit for auth endpoints
    message: 'Too many authentication attempts'
});

// Apply rate limiting
app.use(generalLimiter);
app.use('/api/id/sessions', authLimiter);

// Middleware to assign request ID
app.use((req, res, next) => {
    req.id = uuidv4();
    next();
});

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'molam-id-sessions',
        requestId: req.id // Optionnel: inclure l'id de la requête dans la réponse
    });
});

// Session monitoring routes
app.use(sessionRoutes);

// Prometheus metrics endpoint (if using prom-client)
app.get('/metrics', requireAuth, async (req, res) => {
    // In a real implementation, you would collect and return Prometheus metrics
    res.set('Content-Type', 'text/plain');
    res.send('# Metrics would be here\n');
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        requestId: req.id
    });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);

    // Don't leak error details in production
    if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({
            error: 'Internal server error',
            reference: req.id // Request ID for tracing
        });
    }

    res.status(500).json({
        error: error.message,
        stack: error.stack,
        details: error.details,
        requestId: req.id
    });
});

// Server configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Molam ID Sessions service running on ${HOST}:${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

export default app;