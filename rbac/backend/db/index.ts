// src/db/index.ts
import pgPromise from 'pg-promise';

// Options de configuration pg-promise
const pgp = pgPromise({
    capSQL: true,
    query: (e) => {
        if (process.env.NODE_ENV === 'development') {
            console.log('QUERY:', e.query);
        }
    },
    error: (err, e) => {
        console.error('DB Error:', err, 'at', e.query);
    }
});

// Configuration de la base de données
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'molam_id',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 30,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

const db = pgp(dbConfig);

// Helper functions for RBAC
export const rbacQueries = {
    getUserRoles: (userId: string) =>
        db.any(
            `SELECT mr.module, mr.role, mr.access_scope, mr.trusted_level, mr.expires_at,
              mrg.permissions
       FROM molam_roles mr
       LEFT JOIN molam_role_groups mrg ON mr.module = mrg.module AND mr.role = mrg.role
       WHERE mr.user_id = $1 AND (mr.expires_at IS NULL OR mr.expires_at > NOW())`,
            [userId]
        ),

    getUserPermissions: (userId: string, module: string) =>
        db.any(
            `SELECT mrg.permissions
       FROM molam_roles mr
       JOIN molam_role_groups mrg ON mr.module = mrg.module AND mr.role = mrg.role
       WHERE mr.user_id = $1 AND mr.module = $2 
       AND (mr.expires_at IS NULL OR mr.expires_at > NOW())`,
            [userId, module]
        ),

    checkPermission: async (userId: string, module: string, action: string): Promise<boolean> => {
        const permissions = await db.any(
            `SELECT mrg.permissions->>$1 as permission
       FROM molam_roles mr
       JOIN molam_role_groups mrg ON mr.module = mrg.module AND mr.role = mrg.role
       WHERE mr.user_id = $2 AND mr.module = $3 
       AND (mr.expires_at IS NULL OR mr.expires_at > NOW())`,
            [action, userId, module]
        );

        return permissions.some(p =>
            p.permission === 'write' || p.permission === 'manage' || p.permission === 'admin'
        );
    },

    getRoleGroups: () =>
        db.any('SELECT module, role, permissions FROM molam_role_groups ORDER BY module, role')
};

// Test de connexion
db.connect()
    .then(obj => {
        console.log('✅ Connecté à la base de données PostgreSQL');
        obj.done();
    })
    .catch(error => {
        console.error('❌ Erreur de connexion à la base de données:', error);
    });

export default db;