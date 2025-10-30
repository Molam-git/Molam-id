import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import sessionsRouter from './routes/sessions.routes';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3023', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/id', sessionsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'molam-sessions-monitoring' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Molam Sessions Monitoring - Port ${PORT}`);
  });
}

export { app };
