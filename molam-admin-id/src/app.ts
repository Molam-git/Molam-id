import './types';
import express from 'express';
import adminRoutes from './http/admin.routes';

const app = express();

app.use(express.json());
app.use('/api/id', adminRoutes);

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'molam-admin-id' });
});

export default app;