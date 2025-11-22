/**
 * Routes d'administration - Gestion des utilisateurs
 * Accessible uniquement aux super_admin et admin
 */

import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  suspendUser,
  activateUser,
  getUserStats,
  getUserAuditLogs
} from "../../services/adminService.js";

/**
 * GET /api/admin/users
 * Liste tous les utilisateurs avec pagination et filtres
 */
export async function listUsersHandler(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      role,
      search
    } = req.query;

    const result = await listUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      role,
      search
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error listing users:", error);
    return res.status(500).json({
      error: "internal_error",
      message: "Error listing users"
    });
  }
}

/**
 * GET /api/admin/users/stats
 * Récupère les statistiques des utilisateurs
 */
export async function getUserStatsHandler(req, res) {
  try {
    const stats = await getUserStats();
    return res.status(200).json(stats);
  } catch (error) {
    console.error("Error getting user stats:", error);
    return res.status(500).json({
      error: "internal_error",
      message: "Error getting user statistics"
    });
  }
}

/**
 * GET /api/admin/users/:userId
 * Récupère les détails d'un utilisateur
 */
export async function getUserByIdHandler(req, res) {
  try {
    const { userId } = req.params;

    const user = await getUserById(userId);

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error getting user:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        error: "not_found",
        message: "User not found"
      });
    }

    return res.status(500).json({
      error: "internal_error",
      message: "Error getting user"
    });
  }
}

/**
 * POST /api/admin/users
 * Crée un nouvel utilisateur
 */
export async function createUserHandler(req, res) {
  try {
    const {
      email,
      phone,
      password,
      firstName,
      lastName,
      roles = ["client"],
      status = "active",
      kycStatus = "none"
    } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: "bad_request",
        message: "Email and password are required"
      });
    }

    const user = await createUser({
      email,
      phone,
      password,
      firstName,
      lastName,
      roles,
      status,
      kycStatus,
      createdBy: req.user.user_id
    });

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        molam_id: user.molam_id,
        email: user.email,
        phone_e164: user.phone_e164,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_photo_url: user.profile_photo_url,
        role_profile: user.role_profile,
        status: user.status,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error("Error creating user:", error);

    if (error.message.includes("already exists")) {
      return res.status(409).json({
        error: "conflict",
        message: error.message
      });
    }

    if (error.message.includes("Invalid") || error.message.includes("must be")) {
      return res.status(400).json({
        error: "bad_request",
        message: error.message
      });
    }

    return res.status(500).json({
      error: "internal_error",
      message: "Error creating user"
    });
  }
}

/**
 * PATCH /api/admin/users/:userId
 * Met à jour un utilisateur
 */
export async function updateUserHandler(req, res) {
  try {
    const { userId } = req.params;
    const { email, phone, firstName, lastName, profilePhotoUrl, status, kycStatus, roles } = req.body;

    const user = await updateUser({
      userId,
      email,
      phone,
      firstName,
      lastName,
      profilePhotoUrl,
      status,
      kycStatus,
      roles,
      updatedBy: req.user.user_id
    });

    return res.status(200).json({
      message: "User updated successfully",
      user
    });
  } catch (error) {
    console.error("Error updating user:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        error: "not_found",
        message: "User not found"
      });
    }

    if (error.message === "No fields to update") {
      return res.status(400).json({
        error: "bad_request",
        message: "No fields to update"
      });
    }

    return res.status(500).json({
      error: "internal_error",
      message: "Error updating user"
    });
  }
}

/**
 * DELETE /api/admin/users/:userId
 * Supprime un utilisateur (soft delete)
 */
export async function deleteUserHandler(req, res) {
  try {
    const { userId } = req.params;

    // Empêcher la suppression de son propre compte
    if (userId === req.user.user_id) {
      return res.status(403).json({
        error: "forbidden",
        message: "Cannot delete your own account"
      });
    }

    const user = await deleteUser(userId, req.user.user_id);

    return res.status(200).json({
      message: "User deleted successfully",
      user
    });
  } catch (error) {
    console.error("Error deleting user:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        error: "not_found",
        message: "User not found"
      });
    }

    return res.status(500).json({
      error: "internal_error",
      message: "Error deleting user"
    });
  }
}

/**
 * POST /api/admin/users/:userId/suspend
 * Suspend un utilisateur
 */
export async function suspendUserHandler(req, res) {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // Empêcher la suspension de son propre compte
    if (userId === req.user.user_id) {
      return res.status(403).json({
        error: "forbidden",
        message: "Cannot suspend your own account"
      });
    }

    const user = await suspendUser(userId, reason, req.user.user_id);

    return res.status(200).json({
      message: "User suspended successfully",
      user
    });
  } catch (error) {
    console.error("Error suspending user:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        error: "not_found",
        message: "User not found"
      });
    }

    return res.status(500).json({
      error: "internal_error",
      message: "Error suspending user"
    });
  }
}

/**
 * POST /api/admin/users/:userId/activate
 * Active un utilisateur
 */
export async function activateUserHandler(req, res) {
  try {
    const { userId } = req.params;

    const user = await activateUser(userId, req.user.user_id);

    return res.status(200).json({
      message: "User activated successfully",
      user
    });
  } catch (error) {
    console.error("Error activating user:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        error: "not_found",
        message: "User not found"
      });
    }

    return res.status(500).json({
      error: "internal_error",
      message: "Error activating user"
    });
  }
}

/**
 * GET /api/admin/users/:userId/audit
 * Récupère les logs d'audit d'un utilisateur
 */
export async function getUserAuditHandler(req, res) {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const result = await getUserAuditLogs(userId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error getting user audit logs:", error);
    return res.status(500).json({
      error: "internal_error",
      message: "Error getting audit logs"
    });
  }
}
