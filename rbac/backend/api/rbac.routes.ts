// api/rbac.routes.ts
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/jwt";
import { authzEnforce } from "../middleware/authz";
import db from "../db";
import { auditLog } from "../middleware/audit";

const router = Router();

// Get roles for user
router.get("/:userId", requireAuth, authzEnforce("rbac:read"), async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const rows = await db.any(
            `SELECT module, role, access_scope, trusted_level, expires_at 
       FROM molam_roles 
       WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
            [userId]
        );
        res.json({ userId, roles: rows });
    } catch (error) {
        console.error('Error fetching user roles:', error);
        res.status(500).json({ error: "Erreur serveur lors de la récupération des rôles" });
    }
});

// Assign role with audit
router.post("/:userId/assign",
    requireAuth,
    authzEnforce("rbac:assign"),
    auditLog('ROLE_ASSIGN'),
    async (req: Request, res: Response): Promise<void> => {
        const { userId } = req.params;
        const { module, role, access_scope, trusted_level, expires_at } = req.body;

        // Validation des données
        if (!module || !role) {
            res.status(400).json({ error: "Module et rôle sont obligatoires" });
            return; // ← IMPORTANT: Ajouter return après res.status()
        }

        try {
            const user = (req as any).user;

            await db.none(
                `INSERT INTO molam_roles 
         (user_id, module, role, access_scope, trusted_level, expires_at, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         ON CONFLICT (user_id, module, role) DO UPDATE SET
         access_scope = EXCLUDED.access_scope,
         trusted_level = EXCLUDED.trusted_level,
         expires_at = EXCLUDED.expires_at`,
                [
                    userId,
                    module,
                    role,
                    access_scope || 'read',
                    trusted_level || 0,
                    expires_at,
                    user.id
                ]
            );
            res.json({ status: "ok", message: "Rôle assigné avec succès" });
        } catch (error) {
            console.error('Error assigning role:', error);
            res.status(500).json({ error: "Erreur lors de l'assignation du rôle" });
        }
    }
);

// Revoke role
router.post("/:userId/revoke",
    requireAuth,
    authzEnforce("rbac:revoke"),
    auditLog('ROLE_REVOKE'),
    async (req: Request, res: Response): Promise<void> => {
        const { userId } = req.params;
        const { module, role } = req.body;

        if (!module || !role) {
            res.status(400).json({ error: "Module et rôle sont obligatoires" });
            return; // ← IMPORTANT: Ajouter return après res.status()
        }

        try {
            await db.none(
                "DELETE FROM molam_roles WHERE user_id = $1 AND module = $2 AND role = $3",
                [userId, module, role]
            );
            res.json({ status: "ok", message: "Rôle révoqué avec succès" });
        } catch (error) {
            console.error('Error revoking role:', error);
            res.status(500).json({ error: "Erreur lors de la révocation du rôle" });
        }
    }
);

// Get available roles per module
router.get("/modules/available", requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const roles = await db.any(
            "SELECT DISTINCT module, role, permissions FROM molam_role_groups ORDER BY module, role"
        );
        res.json(roles);
    } catch (error) {
        console.error('Error fetching available roles:', error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// Get user's own roles
router.get("/me/roles", requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const roles = await db.any(
            `SELECT module, role, access_scope, trusted_level, expires_at 
       FROM molam_roles 
       WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
            [user.id]
        );
        res.json({ roles });
    } catch (error) {
        console.error('Error fetching user roles:', error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

export default router;