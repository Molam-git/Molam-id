/**
 * Routes de gestion des rôles
 */

import {
  assignRole,
  revokeRole,
  getUserRoles,
  getUserPermissions
} from "../../services/authzService.js";

/**
 * GET /v1/authz/users/:userId/roles
 * Liste les rôles d'un utilisateur
 */
export async function getUserRolesHandler(req, res) {
  try {
    const { userId } = req.params;

    const roles = await getUserRoles(userId);

    return res.status(200).json({
      user_id: userId,
      roles: roles.map(r => ({
        role_name: r.role_name,
        module: r.module,
        trusted_level: r.trusted_level
      }))
    });
  } catch (error) {
    console.error('Error getting user roles:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Error retrieving user roles'
    });
  }
}

/**
 * GET /v1/authz/users/:userId/permissions
 * Liste les permissions d'un utilisateur
 */
export async function getUserPermissionsHandler(req, res) {
  try {
    const { userId } = req.params;

    const permissions = await getUserPermissions(userId);

    return res.status(200).json({
      user_id: userId,
      permissions: permissions.map(p => ({
        permission_name: p.permission_name,
        module: p.module,
        resource: p.resource,
        action: p.action,
        description: p.description
      }))
    });
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Error retrieving user permissions'
    });
  }
}

/**
 * POST /v1/authz/users/:userId/roles
 * Attribue un rôle à un utilisateur
 */
export async function assignRoleHandler(req, res) {
  try {
    const { userId } = req.params;
    const { role_name, module, trusted_level = 10, expires_at = null } = req.body;

    // Validation
    if (!role_name || !module) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'role_name and module are required'
      });
    }

    // L'utilisateur qui fait la requête (depuis le middleware auth)
    const grantedBy = req.user?.user_id || null;

    const role = await assignRole({
      userId,
      roleName: role_name,
      module,
      trustedLevel: trusted_level,
      grantedBy,
      expiresAt: expires_at
    });

    return res.status(201).json({
      message: 'Role assigned successfully',
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
    console.error('Error assigning role:', error);

    if (error.code === '23503') {
      return res.status(404).json({
        error: 'not_found',
        message: 'User or role not found'
      });
    }

    return res.status(500).json({
      error: 'internal_error',
      message: 'Error assigning role'
    });
  }
}

/**
 * DELETE /v1/authz/users/:userId/roles/:roleName
 * Révoque un rôle d'un utilisateur
 */
export async function revokeRoleHandler(req, res) {
  try {
    const { userId, roleName } = req.params;
    const { module } = req.query;

    if (!module) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'module query parameter is required'
      });
    }

    const revoked = await revokeRole({ userId, roleName, module });

    if (!revoked) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Role assignment not found'
      });
    }

    return res.status(200).json({
      message: 'Role revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking role:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Error revoking role'
    });
  }
}
