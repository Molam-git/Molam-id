import express from 'express';
import rolesRoutes from './http/roles.routes';
import { errorHandler } from './middleware/error';

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/id', rolesRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'role-management' });
});

// Error handling
app.use(errorHandler);

export default app;