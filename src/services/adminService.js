/**
 * Service d'administration - Gestion des utilisateurs et des rôles
 * Accessible uniquement aux super_admin et admin
 */

import { pool } from "../db.js";
import { hashPasswordWithPepper, generateMolamId } from "../utils/security.js";

/**
 * Liste tous les utilisateurs avec pagination
 */
export async function listUsers({
  page = 1,
  limit = 20,
  status = null,
  role = null,
  search = null
}) {
  let query = `
    SELECT
      id,
      molam_id,
      email,
      phone_e164,
      first_name,
      last_name,
      profile_photo_url,
      role_profile,
      status,
      kyc_status,
      lang_pref,
      currency_pref,
      created_at,
      updated_at
    FROM molam_users
    WHERE deleted_at IS NULL
  `;

  const params = [];
  let paramIndex = 1;

  // Filtres
  if (status) {
    query += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (role) {
    query += ` AND $${paramIndex} = ANY(role_profile)`;
    params.push(role);
    paramIndex++;
  }

  if (search) {
    query += ` AND (
      email ILIKE $${paramIndex} OR
      phone_e164 ILIKE $${paramIndex} OR
      molam_id ILIKE $${paramIndex}
    )`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Compter le total
  const countQuery = `SELECT COUNT(*) as total FROM (${query}) as count_query`;
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].total);

  // Pagination
  const offset = (page - 1) * limit;
  query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);

  return {
    users: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Récupère un utilisateur par ID
 */
export async function getUserById(userId) {
  const result = await pool.query(
    `SELECT
      id,
      molam_id,
      email,
      phone_e164,
      first_name,
      last_name,
      profile_photo_url,
      role_profile,
      status,
      kyc_status,
      kyc_reference,
      lang_pref,
      currency_pref,
      metadata,
      created_at,
      updated_at
    FROM molam_users
    WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error("User not found");
  }

  // Récupérer les rôles détaillés
  const rolesResult = await pool.query(
    `SELECT role_name, module, trusted_level, granted_at, expires_at
     FROM molam_user_roles
     WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId]
  );

  const user = result.rows[0];
  user.roles_detailed = rolesResult.rows;

  return user;
}

/**
 * Crée un nouvel utilisateur (admin only)
 */
export async function createUser({
  email,
  phone,
  password,
  firstName,
  lastName,
  roles = ["client"],
  status = "active",
  kycStatus = "none",
  createdBy
}) {
  // Validation
  if (!email || !email.includes("@")) {
    throw new Error("Invalid email");
  }

  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  // Vérifier si l'utilisateur existe
  const existing = await pool.query(
    "SELECT id FROM molam_users WHERE email = $1 OR phone_e164 = $2",
    [email.toLowerCase(), phone]
  );

  if (existing.rows.length > 0) {
    throw new Error("User with this email or phone already exists");
  }

  // Générer Molam ID
  const molamId = generateMolamId();

  // Hasher le mot de passe
  const passwordHash = await hashPasswordWithPepper(password);

  // Créer l'utilisateur
  const userResult = await pool.query(
    `INSERT INTO molam_users
     (molam_id, email, phone_e164, first_name, last_name, password_hash, role_profile, status, kyc_status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
     RETURNING id, molam_id, email, phone_e164, first_name, last_name, role_profile, status, kyc_status, created_at`,
    [molamId, email.toLowerCase(), phone, firstName, lastName, passwordHash, roles, status, kycStatus]
  );

  const user = userResult.rows[0];

  // Assigner les rôles dans molam_user_roles
  for (const role of roles) {
    await pool.query(
      `INSERT INTO molam_user_roles
       (user_id, role_name, module, trusted_level, granted_by, granted_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, role_name, module) DO NOTHING`,
      [user.id, role, "*", 10, createdBy]
    );
  }

  // Audit log
  await pool.query(
    `INSERT INTO molam_audit_logs
     (actor_id, action, target_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [createdBy, "user_created", user.id, JSON.stringify({ email: user.email, roles })]
  );

  return user;
}

/**
 * Met à jour un utilisateur
 */
export async function updateUser({
  userId,
  email,
  phone,
  firstName,
  lastName,
  profilePhotoUrl,
  status,
  kycStatus,
  roles,
  updatedBy
}) {
  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (email !== undefined) {
    updates.push(`email = $${paramIndex}`);
    params.push(email.toLowerCase());
    paramIndex++;
  }

  if (phone !== undefined) {
    updates.push(`phone_e164 = $${paramIndex}`);
    params.push(phone);
    paramIndex++;
  }

  if (firstName !== undefined) {
    updates.push(`first_name = $${paramIndex}`);
    params.push(firstName);
    paramIndex++;
  }

  if (lastName !== undefined) {
    updates.push(`last_name = $${paramIndex}`);
    params.push(lastName);
    paramIndex++;
  }

  if (profilePhotoUrl !== undefined) {
    updates.push(`profile_photo_url = $${paramIndex}`);
    params.push(profilePhotoUrl);
    paramIndex++;
  }

  if (status !== undefined) {
    updates.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (kycStatus !== undefined) {
    updates.push(`kyc_status = $${paramIndex}`);
    params.push(kycStatus);
    paramIndex++;
  }

  if (roles !== undefined) {
    updates.push(`role_profile = $${paramIndex}`);
    params.push(roles);
    paramIndex++;
  }

  updates.push(`updated_at = NOW()`);

  if (updates.length === 1) {
    throw new Error("No fields to update");
  }

  params.push(userId);
  const query = `
    UPDATE molam_users
    SET ${updates.join(", ")}
    WHERE id = $${paramIndex} AND deleted_at IS NULL
    RETURNING id, molam_id, email, phone_e164, first_name, last_name, profile_photo_url, role_profile, status, kyc_status, updated_at
  `;

  const result = await pool.query(query, params);

  if (result.rows.length === 0) {
    throw new Error("User not found");
  }

  // Audit log
  await pool.query(
    `INSERT INTO molam_audit_logs
     (actor_id, action, target_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [
      updatedBy,
      "user_updated",
      userId,
      JSON.stringify({ email, phone, status, kycStatus, roles })
    ]
  );

  return result.rows[0];
}

/**
 * Supprime un utilisateur (soft delete)
 */
export async function deleteUser(userId, deletedBy) {
  const result = await pool.query(
    `UPDATE molam_users
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, molam_id, email`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error("User not found");
  }

  // Audit log
  await pool.query(
    `INSERT INTO molam_audit_logs
     (actor_id, action, target_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [deletedBy, "user_deleted", userId, JSON.stringify({ email: result.rows[0].email })]
  );

  return result.rows[0];
}

/**
 * Suspend un utilisateur
 */
export async function suspendUser(userId, reason, suspendedBy) {
  const result = await pool.query(
    `UPDATE molam_users
     SET status = 'suspended', updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, molam_id, email, status`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error("User not found");
  }

  // Audit log
  await pool.query(
    `INSERT INTO molam_audit_logs
     (actor_id, action, target_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [
      suspendedBy,
      "user_suspended",
      userId,
      JSON.stringify({ email: result.rows[0].email, reason })
    ]
  );

  return result.rows[0];
}

/**
 * Active un utilisateur
 */
export async function activateUser(userId, activatedBy) {
  const result = await pool.query(
    `UPDATE molam_users
     SET status = 'active', updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, molam_id, email, status`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error("User not found");
  }

  // Audit log
  await pool.query(
    `INSERT INTO molam_audit_logs
     (actor_id, action, target_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [activatedBy, "user_activated", userId, JSON.stringify({ email: result.rows[0].email })]
  );

  return result.rows[0];
}

/**
 * Liste tous les rôles disponibles
 */
export async function listRoles() {
  const result = await pool.query(
    `SELECT role_name, module, display_name, description, is_system_role
     FROM molam_roles
     ORDER BY module, role_name`
  );

  return result.rows;
}

/**
 * Récupère les statistiques des utilisateurs
 */
export async function getUserStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') as active_users,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_users,
      COUNT(*) FILTER (WHERE status = 'suspended') as suspended_users,
      COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_users,
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE kyc_status = 'verified') as verified_kyc,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as new_today,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_this_week
    FROM molam_users
  `);

  return result.rows[0];
}

/**
 * Récupère les logs d'audit pour un utilisateur
 */
export async function getUserAuditLogs(userId, { page = 1, limit = 50 }) {
  const offset = (page - 1) * limit;

  const result = await pool.query(
    `SELECT
      id,
      actor_id,
      action,
      metadata,
      created_at
    FROM molam_audit_logs
    WHERE target_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const countResult = await pool.query(
    "SELECT COUNT(*) as total FROM molam_audit_logs WHERE target_id = $1",
    [userId]
  );

  return {
    logs: result.rows,
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].total)
    }
  };
}
