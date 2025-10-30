import pgPromise, { IMain, IDatabase, IInitOptions } from 'pg-promise';
import monitor from 'pg-monitor';

// Database connection configuration
const connectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'molam_id',
    user: process.env.DB_USER || 'molam_user',
    password: process.env.DB_PASSWORD || 'molam_password',
    max: 20, // connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// Initialization options
const initOptions: IInitOptions = {
    // Custom error handler
    error: (error: any, e: any) => {
        if (e.cn) {
            console.error('CN:', e.cn);
            console.error('EVENT:', error.message || error);
        }

        // Connection-related errors
        if (error.code) {
            switch (error.code) {
                case 'ECONNREFUSED':
                    console.error('Database connection refused');
                    break;
                case '28P01':
                    console.error('Database authentication failed');
                    break;
                case '3D000':
                    console.error('Database does not exist');
                    break;
                default:
                    console.error('Database error:', error.message);
            }
        }
    },

    // Query formatting options
    query: (e: any) => {
        if (process.env.NODE_ENV === 'development') {
            console.log('QUERY:', e.query);
        }
    },

    // Receive data from the server;
    // Correction: utiliser le paramètre unique de type IEventContext
    receive: (e: any) => {
        if (process.env.NODE_ENV === 'development') {
            // e.data contient les données reçues, e.result le résultat
            console.log(`Received ${e.data ? e.data.length : 0} rows`);
        }
    }
};

// Initialize pg-promise
const pgp: IMain = pgPromise(initOptions);

// Attach monitor in development
if (process.env.NODE_ENV === 'development') {
    monitor.attach(initOptions);
}

// Create the database instance
const db: IDatabase<any> = pgp(connectionConfig);

// Helper methods for common operations
export const dbHelpers = {
    // Transaction helper
    transaction: async (callback: any) => {
        return await db.tx(callback);
    },

    // Supprimer la méthode batch car elle n'existe pas dans pg-promise
    // Si vous avez besoin de batch, utilisez une transaction et exécutez plusieurs requêtes

    // Health check
    healthCheck: async (): Promise<boolean> => {
        try {
            const result = await db.one('SELECT NOW() as current_time');
            return !!result.current_time;
        } catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }
};

// Export types for TypeScript
export type Database = IDatabase<any>;

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down database connections...');
    try {
        await pgp.end();
        console.log('Database connections closed');
        process.exit(0);
    } catch (error) {
        console.error('Error closing database connections:', error);
        process.exit(1);
    }
});

export default db;