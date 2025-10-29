// middleware/authz.ts
import { Response, NextFunction } from 'express';
import db from "../db";

interface Permissions {
    [key: string]: string;
}

export function authzEnforce(required: string) {
    return async (req: any, res: Response, next: NextFunction): Promise<void> => { // ← Ajout de : Promise<void>
        try {
            const userId = req.user.id;
            const [module, action] = required.split(":");

            if (!module || !action) {
                res.status(400).json({ error: "Permission mal formée" });
                return; // ← IMPORTANT: Ajouter return
            }

            // Récupérer les rôles de l'utilisateur pour le module
            const userRoles = await db.any(
                `SELECT role, access_scope, trusted_level 
         FROM molam_roles 
         WHERE user_id = $1 AND module = $2 
         AND (expires_at IS NULL OR expires_at > NOW())`,
                [userId, module]
            );

            if (!userRoles.length) {
                res.status(403).json({ error: "Accès non autorisé pour ce module" });
                return; // ← IMPORTANT: Ajouter return
            }

            // Vérifier les permissions via les groupes de rôles
            const roleNames = userRoles.map((r: any) => r.role);
            const roleGroups = await db.any(
                "SELECT role, permissions FROM molam_role_groups WHERE module = $1 AND role = ANY($2)",
                [module, roleNames]
            );

            // Vérifier si l'action est autorisée
            const hasAccess = roleGroups.some((group: any) => {
                const permissions = group.permissions as Record<string, string>;
                const perm = permissions[action];

                return perm === "write" || perm === "manage" || perm === "admin";
            });

            // Vérifier le niveau de confiance si nécessaire (pour les actions sensibles)
            const sensitiveActions = ['manage', 'admin', 'set', 'delete'];
            const requiresHighTrust = sensitiveActions.some(sensitive => action.includes(sensitive));

            const hasTrustLevel = !requiresHighTrust || userRoles.some((role: any) => role.trusted_level >= 3);

            if (!hasAccess || !hasTrustLevel) {
                res.status(403).json({ error: "Permissions insuffisantes" });
                return; // ← IMPORTANT: Ajouter return
            }

            next(); // Pas besoin de return ici
        } catch (error) {
            console.error('AuthZ error:', error);
            res.status(500).json({ error: "Erreur d'autorisation" });
            // Pas besoin de return ici non plus car c'est la fin de la fonction
        }
    };
}