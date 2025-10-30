/**
 * Molam ID - Roles Service
 * Business logic for role management with security guards
 */
import {
  upsertRole,
  getRoleById,
  getRoleByName,
  listRoles,
  addGrant,
  revokeGrant,
  hasRole,
  getUserRoles,
  createApprovalRequest,
  getApprovalRequest,
  updateApprovalStatus,
  listPendingApprovals,
  canManageScope,
  hasHigherTrust,
  getUserMaxTrustLevel,
  auditRoleOperation,
} from '../repo/roles.repo';
import { invalidateUserCache, invalidateRoleCache } from '../repo/redis';
import { publish } from '../util/kafka';
import { checkPermission } from '../util/rbac';
import {
  RoleDTO,
  GrantDTO,
  RevokeDTO,
  ApprovalDTO,
  RoleGrantResponse,
  RoleRevokeResponse,
  ApprovalResponse,
  ServiceError,
  RoleRecord,
  ApprovalRecord,
} from '../types';

/**
 * Minimum trust level threshold for requiring approval
 */
const APPROVAL_THRESHOLD = 80;

/**
 * Create or update a role
 * Enforces scope and trust level hierarchy
 */
export async function createOrUpdateRole(
  actorId: string,
  dto: RoleDTO
): Promise<RoleRecord> {
  // Check if actor can manage the target scope
  const canManage = await canManageScope(actorId, dto.module_scope);
  if (!canManage) {
    throw new ServiceError(
      `Forbidden: Cannot manage ${dto.module_scope} scope`,
      403,
      'forbidden_scope'
    );
  }

  // Check if actor has the permission to manage roles
  const hasPermission = await checkPermission(actorId, 'id.role.manage', {
    scope: dto.module_scope,
  });
  if (!hasPermission) {
    throw new ServiceError(
      'Forbidden: Missing id.role.manage permission',
      403,
      'forbidden'
    );
  }

  // If updating an existing role, verify trust hierarchy
  if (dto.id) {
    const existingRole = await getRoleById(dto.id);
    if (existingRole) {
      const actorMaxTrust = await getUserMaxTrustLevel(actorId);
      if (actorMaxTrust <= existingRole.trusted_level) {
        throw new ServiceError(
          'Forbidden: Insufficient trust level to modify this role',
          403,
          'insufficient_trust'
        );
      }
    }
  }

  // Create or update the role
  const role = await upsertRole(actorId, dto);

  // Invalidate cache for this role
  await invalidateRoleCache(role.id);

  // Publish event
  await publish('id.role.changed', {
    role_id: role.id,
    role_name: role.name,
    module_scope: role.module_scope,
    trusted_level: role.trusted_level,
    by: actorId,
    ts: Date.now(),
  });

  return role;
}

/**
 * Grant a role to a user
 * Enforces trust hierarchy and approval workflows
 */
export async function grantRole(
  actorId: string,
  dto: GrantDTO
): Promise<RoleGrantResponse> {
  const { user_id, role_id, require_approval, scope_constraint, expires_at, justification } = dto;

  // Get the role
  const role = await getRoleById(role_id);
  if (!role) {
    throw new ServiceError('Role not found', 404, 'role_not_found');
  }

  // Check if actor can manage this scope
  const canManage = await canManageScope(actorId, role.module_scope);
  if (!canManage) {
    throw new ServiceError(
      `Forbidden: Cannot manage ${role.module_scope} scope`,
      403,
      'forbidden_scope'
    );
  }

  // Check trust hierarchy - actor must have higher trust level than target role
  const hasTrust = await hasHigherTrust(actorId, role_id);
  if (!hasTrust) {
    throw new ServiceError(
      'Forbidden: Insufficient trust level to grant this role',
      403,
      'insufficient_trust'
    );
  }

  // Check permission
  const hasPermission = await checkPermission(actorId, 'id.role.assign', {
    scope: role.module_scope,
    role: role.name,
  });
  if (!hasPermission) {
    throw new ServiceError(
      'Forbidden: Missing id.role.assign permission',
      403,
      'forbidden'
    );
  }

  // Check if user already has this role
  const alreadyHas = await hasRole(user_id, role_id);
  if (alreadyHas) {
    return {
      status: 'already_assigned',
      message: 'User already has this role',
    };
  }

  // Determine if approval is required
  const needsApproval =
    require_approval || role.trusted_level >= APPROVAL_THRESHOLD;

  if (needsApproval) {
    // Create approval request
    const approval = await createApprovalRequest(
      user_id,
      role_id,
      actorId,
      justification
    );

    await publish('id.role.grant.requested', {
      request_id: approval.request_id,
      user_id,
      role_id,
      role_name: role.name,
      requested_by: actorId,
      trusted_level: role.trusted_level,
      ts: Date.now(),
    });

    return {
      status: 'pending',
      request_id: approval.request_id,
      message: 'Role grant pending approval',
    };
  }

  // Grant immediately without approval
  const granted = await addGrant(user_id, role_id, actorId, {
    scopeConstraint: scope_constraint,
    expiresAt: expires_at ? new Date(expires_at) : undefined,
    justification,
  });

  // Audit
  await auditRoleOperation(user_id, role_id, 'grant', actorId, {
    scope_constraint,
    expires_at,
  });

  // Invalidate cache
  await invalidateUserCache(user_id);

  // Publish event
  await publish('id.role.granted', {
    user_id,
    role_id,
    role_name: role.name,
    by: actorId,
    created: !!granted,
    ts: Date.now(),
  });

  return {
    status: 'granted',
    message: 'Role granted successfully',
  };
}

/**
 * Revoke a role from a user
 */
export async function revokeRole(
  actorId: string,
  dto: RevokeDTO
): Promise<RoleRevokeResponse> {
  const { user_id, role_id, reason } = dto;

  // Get the role
  const role = await getRoleById(role_id);
  if (!role) {
    throw new ServiceError('Role not found', 404, 'role_not_found');
  }

  // Check if actor can manage this scope
  const canManage = await canManageScope(actorId, role.module_scope);
  if (!canManage) {
    throw new ServiceError(
      `Forbidden: Cannot manage ${role.module_scope} scope`,
      403,
      'forbidden_scope'
    );
  }

  // Check trust hierarchy
  const hasTrust = await hasHigherTrust(actorId, role_id);
  if (!hasTrust) {
    throw new ServiceError(
      'Forbidden: Insufficient trust level to revoke this role',
      403,
      'insufficient_trust'
    );
  }

  // Check permission
  const hasPermission = await checkPermission(actorId, 'id.role.revoke', {
    scope: role.module_scope,
    role: role.name,
  });
  if (!hasPermission) {
    throw new ServiceError(
      'Forbidden: Missing id.role.revoke permission',
      403,
      'forbidden'
    );
  }

  // Revoke the role
  const removed = await revokeGrant(user_id, role_id);

  // Audit
  await auditRoleOperation(user_id, role_id, 'revoke', actorId, { reason });

  // Invalidate cache
  await invalidateUserCache(user_id);

  // Publish event
  await publish('id.role.revoked', {
    user_id,
    role_id,
    role_name: role.name,
    by: actorId,
    removed,
    reason,
    ts: Date.now(),
  });

  return {
    status: removed ? 'revoked' : 'not_assigned',
    message: removed
      ? 'Role revoked successfully'
      : 'User did not have this role',
  };
}

/**
 * Approve or reject a pending role grant
 */
export async function approveGrant(
  actorId: string,
  dto: ApprovalDTO
): Promise<ApprovalResponse> {
  const { request_id, approve, reason } = dto;

  // Get the approval request
  const request = await getApprovalRequest(request_id);
  if (!request) {
    throw new ServiceError('Approval request not found', 404, 'request_not_found');
  }

  if (request.status !== 'pending') {
    throw new ServiceError(
      `Request already ${request.status}`,
      409,
      'already_processed'
    );
  }

  // Get the role
  const role = await getRoleById(request.role_id);
  if (!role) {
    throw new ServiceError('Role not found', 404, 'role_not_found');
  }

  // Check if actor can manage this scope
  const canManage = await canManageScope(actorId, role.module_scope);
  if (!canManage) {
    throw new ServiceError(
      `Forbidden: Cannot manage ${role.module_scope} scope`,
      403,
      'forbidden_scope'
    );
  }

  // Check trust hierarchy
  const hasTrust = await hasHigherTrust(actorId, role.id);
  if (!hasTrust) {
    throw new ServiceError(
      'Forbidden: Insufficient trust level to approve this role grant',
      403,
      'insufficient_trust'
    );
  }

  // Check permission
  const hasPermission = await checkPermission(actorId, 'id.role.approve', {
    scope: role.module_scope,
  });
  if (!hasPermission) {
    throw new ServiceError(
      'Forbidden: Missing id.role.approve permission',
      403,
      'forbidden'
    );
  }

  if (!approve) {
    // Reject the request
    await updateApprovalStatus(request_id, 'rejected', actorId, reason);

    await publish('id.role.grant.rejected', {
      request_id,
      user_id: request.user_id,
      role_id: request.role_id,
      by: actorId,
      reason,
      ts: Date.now(),
    });

    return {
      status: 'rejected',
      message: 'Role grant request rejected',
    };
  }

  // Approve and grant the role
  await updateApprovalStatus(request_id, 'approved', actorId, reason);

  const granted = await addGrant(
    request.user_id,
    request.role_id,
    actorId,
    {
      justification: request.justification ?? undefined,
    }
  );

  // Audit
  await auditRoleOperation(request.user_id, request.role_id, 'grant_approved', actorId, {
    request_id,
    originally_requested_by: request.requested_by,
  });

  // Invalidate cache
  await invalidateUserCache(request.user_id);

  // Publish event
  await publish('id.role.grant.approved', {
    request_id,
    user_id: request.user_id,
    role_id: request.role_id,
    role_name: role.name,
    by: actorId,
    originally_requested_by: request.requested_by,
    ts: Date.now(),
  });

  return {
    status: 'approved',
    granted: !!granted,
    message: 'Role grant approved and assigned',
  };
}

/**
 * List all roles (with optional filters)
 */
export async function listAllRoles(filters?: {
  module_scope?: string;
  role_type?: string;
}): Promise<RoleRecord[]> {
  return listRoles(filters);
}

/**
 * Get a specific role by ID
 */
export async function getRole(roleId: string): Promise<RoleRecord | null> {
  return getRoleById(roleId);
}

/**
 * Get a user's roles
 */
export async function getUserRolesList(userId: string): Promise<RoleRecord[]> {
  return getUserRoles(userId);
}

/**
 * List pending approval requests
 */
export async function listPendingApprovalRequests(filters?: {
  userId?: string;
  requestedBy?: string;
}): Promise<ApprovalRecord[]> {
  return listPendingApprovals(filters);
}
