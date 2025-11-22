/**
 * Routes d'administration - Gestion des rôles
 * Accessible uniquement aux super_admin
 */

import { listRoles } from "../../services/adminService.js";
import { assignRole, revokeRole } from "../../services/authzService.js";
import { pool } from "../../db.js";

/**
 * GET /api/admin/roles
 * Liste tous les rôles disponibles
 */
export async function listRolesHandler(req, res) {
  try {
    const roles = await listRoles();

    return res.status(200).json({
      roles,
      count: roles.length
    });
  } catch (error) {
    console.error("Error listing roles:", error);
    return res.status(500).json({
      error: "internal_error",
      message: "Error listing roles"
    });
  }
}

/**
 * POST /api/admin/users/:userId/assign-role
 * Assigne un rôle à un utilisateur
 */
export async function assignRoleToUserHandler(req, res) {
  try {
    const { userId } = req.params;
    const {
      role_name,
      module = "*",
      trusted_level = 10,
      expires_at = null
    } = req.body;

    // Validation
    if (!role_name) {
      return res.status(400).json({
        error: "bad_request",
        message: "role_name is required"
      });
    }

    // Vérifier que l'utilisateur existe
    const userCheck = await pool.query(
      "SELECT id FROM molam_users WHERE id = $1 AND deleted_at IS NULL",
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: "not_found",
        message: "User not found"
      });
    }

    // Vérifier que le rôle existe
    const roleCheck = await pool.query(
      "SELECT role_name FROM molam_roles WHERE role_name = $1",
      [role_name]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({
        error: "not_found",
        message: `Role "${role_name}" not found`
      });
    }

    // Assigner le rôle
    const role = await assignRole({
      userId,
      roleName: role_name,
      module,
      trustedLevel: trusted_level,
      grantedBy: req.user.user_id,
      expiresAt: expires_at
    });

    // Mettre à jour le role_profile de l'utilisateur
    await pool.query(
      `UPDATE molam_users
       SET role_profile = array_append(role_profile, $1)
       WHERE id = $2 AND NOT ($1 = ANY(role_profile))`,
      [role_name, userId]
    );

    // Audit log
    await pool.query(
      `INSERT INTO molam_audit_logs
       (actor_id, action, target_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        req.user.user_id,
        "role_assigned",
        userId,
        JSON.stringify({ role_name, module, trusted_level })
      ]
    );

    return res.status(200).json({
      message: "Role assigned successfully",
      role: {
        id: role.id,
        user_id: role.user_id,
        role_name: role.role_name,
        module: role.module,
        trusted_level: role.trusted_level,
        granted_at: role.granted_at,
        expires_at: role.expires_at
      }
    });
  } catch (error) {
    console.error("Error assigning role:", error);

    if (error.code === "23503") {
      return res.status(404).json({
        error: "not_found",
        message: "User or role not found"
      });
    }

    return res.status(500).json({
      error: "internal_error",
      message: "Error assigning role"
    });
  }
}

/**
 * DELETE /api/admin/users/:userId/revoke-role
 * Révoque un rôle d'un utilisateur
 */
export async function revokeRoleFromUserHandler(req, res) {
  try {
    const { userId } = req.params;
    const { role_name, module = "*" } = req.body;

    // Validation
    if (!role_name) {
      return res.status(400).json({
        error: "bad_request",
        message: "role_name is required"
      });
    }

    // Empêcher la révocation de son propre rôle super_admin
    if (userId === req.user.user_id && role_name === "super_admin") {
      return res.status(403).json({
        error: "forbidden",
        message: "Cannot revoke your own super_admin role"
      });
    }

    const revoked = await revokeRole({ userId, roleName: role_name, module });

    if (!revoked) {
      return res.status(404).json({
        error: "not_found",
        message: "Role assignment not found"
      });
    }

    // Mettre à jour le role_profile de l'utilisateur
    await pool.query(
      `UPDATE molam_users
       SET role_profile = array_remove(role_profile, $1)
       WHERE id = $2`,
      [role_name, userId]
    );

    // Audit log
    await pool.query(
      `INSERT INTO molam_audit_logs
       (actor_id, action, target_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        req.user.user_id,
        "role_revoked",
        userId,
        JSON.stringify({ role_name, module })
      ]
    );

    return res.status(200).json({
      message: "Role revoked successfully"
    });
  } catch (error) {
    console.error("Error revoking role:", error);
    return res.status(500).json({
      error: "internal_error",
      message: "Error revoking role"
    });
  }
}

/**
 * GET /api/admin/users/:userId/roles
 * Récupère tous les rôles d'un utilisateur
 */
export async function getUserRolesAdminHandler(req, res) {
  try {
    const { userId } = req.params;

    // Vérifier que l'utilisateur existe
    const userCheck = await pool.query(
      "SELECT role_profile FROM molam_users WHERE id = $1 AND deleted_at IS NULL",
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: "not_found",
        message: "User not found"
      });
    }

    // Récupérer les rôles détaillés
    const rolesResult = await pool.query(
      `SELECT
        ur.id,
        ur.role_name,
        ur.module,
        ur.trusted_level,
        ur.granted_at,
        ur.expires_at,
        r.display_name,
        r.description
      FROM molam_user_roles ur
      LEFT JOIN molam_roles r ON ur.role_name = r.role_name
      WHERE ur.user_id = $1
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      ORDER BY ur.granted_at DESC`,
      [userId]
    );

    return res.status(200).json({
      user_id: userId,
      role_profile: userCheck.rows[0].role_profile,
      roles: rolesResult.rows,
      count: rolesResult.rows.length
    });
  } catch (error) {
    console.error("Error getting user roles:", error);
    return res.status(500).json({
      error: "internal_error",
      message: "Error getting user roles"
    });
  }
}

/**
 * POST /api/admin/roles
 * Crée un nouveau rôle (super_admin only)
 */
export async function createRoleHandler(req, res) {
  try {
    const {
      role_name,
      module = "*",
      display_name,
      description,
      inherits_from = null
    } = req.body;

    // Validation
    if (!role_name || !display_name) {
      return res.status(400).json({
        error: "bad_request",
        message: "role_name and display_name are required"
      });
    }

    // Créer le rôle
    const result = await pool.query(
      `INSERT INTO molam_roles
       (role_name, module, display_name, description, inherits_from, is_system_role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
       RETURNING *`,
      [role_name, module, display_name, description, inherits_from]
    );

    const role = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO molam_audit_logs
       (actor_id, action, target_id, metadata, created_at)
       VALUES ($1, $2, NULL, $3, NOW())`,
      [
        req.user.user_id,
        "role_created",
        JSON.stringify({ role_name, module, display_name })
      ]
    );

    return res.status(201).json({
      message: "Role created successfully",
      role
    });
  } catch (error) {
    console.error("Error creating role:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "conflict",
        message: "Role with this name already exists"
      });
    }

    return res.status(500).json({
      error: "internal_error",
      message: "Error creating role"
    });
  }
}

/**
 * DELETE /api/admin/roles/:roleName
 * Supprime un rôle (super_admin only)
 */
export async function deleteRoleHandler(req, res) {
  try {
    const { roleName } = req.params;

    // Vérifier que ce n'est pas un rôle système
    const roleCheck = await pool.query(
      "SELECT is_system_role FROM molam_roles WHERE role_name = $1",
      [roleName]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({
        error: "not_found",
        message: "Role not found"
      });
    }

    if (roleCheck.rows[0].is_system_role) {
      return res.status(403).json({
        error: "forbidden",
        message: "Cannot delete system role"
      });
    }

    // Supprimer le rôle
    await pool.query(
      "DELETE FROM molam_roles WHERE role_name = $1",
      [roleName]
    );

    // Audit log
    await pool.query(
      `INSERT INTO molam_audit_logs
       (actor_id, action, target_id, metadata, created_at)
       VALUES ($1, $2, NULL, $3, NOW())`,
      [
        req.user.user_id,
        "role_deleted",
        JSON.stringify({ role_name: roleName })
      ]
    );

    return res.status(200).json({
      message: "Role deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting role:", error);
    return res.status(500).json({
      error: "internal_error",
      message: "Error deleting role"
    });
  }
}
