import { Pool } from 'pg';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

// Configuration de l'application
export const env = {
    // Database
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/molam',

    // AWS S3
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    MEDIA_BUCKET: process.env.MEDIA_BUCKET || 'molam-media',

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'molam-secret-key-change-in-production',

    // Server
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000'),

    // Features flags
    FEATURE_MEDIA_PROCESSING: process.env.FEATURE_MEDIA_PROCESSING !== 'false',
    FEATURE_ACTIVITY_TRACKING: process.env.FEATURE_ACTIVITY_TRACKING !== 'false',
};

// Pool de connexions PostgreSQL
export const db = new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Client S3 pour le stockage des médias
export const s3 = new S3Client({
    region: env.AWS_REGION,
    credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    ...(env.NODE_ENV === 'development' && {
        endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
        forcePathStyle: true,
    }),
});

// Gestion des erreurs de base de données
db.on('error', (err) => {
    console.error('Erreur base de données:', err);
});

db.on('connect', () => {
    console.log('✅ Connecté à PostgreSQL');
});

// Health check de la base de données
export const checkDatabaseHealth = async (): Promise<boolean> => {
    try {
        const result = await db.query('SELECT NOW()');
        return !!result.rows[0];
    } catch (error) {
        console.error('❌ Health check DB échoué:', error);
        return false;
    }
};

// Health check S3
export const checkS3Health = async (): Promise<boolean> => {
    try {
        await s3.send(new ListBucketsCommand({}));
        return true;
    } catch (error) {
        console.error('❌ Health check S3 échoué:', error);
        return false;
    }
};

// Initialisation de l'application
export const initializeApp = async (): Promise<void> => {
    console.log('🚀 Initialisation de Molam Platform...');

    // Vérifications de santé
    const dbHealthy = await checkDatabaseHealth();
    const s3Healthy = await checkS3Health();

    if (!dbHealthy) {
        throw new Error('Base de données non accessible');
    }

    console.log('✅ Bootstrap terminé');
    console.log(`   Environnement: ${env.NODE_ENV}`);
    console.log(`   Base de données: ${dbHealthy ? '✅' : '❌'}`);
    console.log(`   Stockage S3: ${s3Healthy ? '✅' : '❌'}`);
};

// Nettoyage à l'arrêt
export const cleanup = async (): Promise<void> => {
    console.log('🧹 Nettoyage des ressources...');
    await db.end();
    console.log('✅ Ressources nettoyées');
};

// Gestion graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Arrêt demandé...');
    await cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Arrêt demandé...');
    await cleanup();
    process.exit(0);
});

export default {
    env,
    db,
    s3,
    initializeApp,
    cleanup,
};