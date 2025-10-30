// Delegation routes
import { Router, Request, Response, NextFunction } from "express";
import { query, queryOne } from "../util/pg";
import { authRequired, requireScope } from "../util/auth";
import { AppError } from "../util/errors";
import { auditDelegation, auditExternal } from "../util/audit";
import { getCached, setCached, /* delCached, */ invalidateUserDelegations } from "../util/redis";
import { config } from "./config";

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * POST /v1/delegations
 * Create a new delegation
 *
 * Body:
 * {
 *   "grantee_id": "uuid",
 *   "module": "pay",
 *   "role": "cashier",
 *   "country_code": "SEN",
 *   "scope": {"limit": 50000, "currency": "XOF"},
 *   "start_at": "2024-01-01T00:00:00Z",  // optional
 *   "end_at": "2024-01-02T00:00:00Z",    // optional
 *   "approvers": ["uuid1", "uuid2"],      // optional
 *   "template_id": "uuid"                 // optional, use template
 * }
 */
router.post("/", authRequired, requireScope("id:delegation:create"), asyncHandler(async (req: Request, res: Response) => {
  const granterId = req.user!.id;
  const {
    grantee_id,
    module,
    role,
    country_code,
    scope,
    start_at,
    end_at,
    approvers,
    template_id,
  } = req.body || {};

  if (!grantee_id || !module || !role || !country_code) {
    throw new AppError(400, "missing_fields", "grantee_id, module, role, and country_code are required");
  }

  // Validate module
  if (!config.modules.includes(module)) {
    throw new AppError(400, "invalid_module", `Module must be one of: ${config.modules.join(", ")}`);
  }

  // Check if using template
  let finalScope = scope || {};
  let finalApprovers = approvers || [];
  let requiresApproval = true;
  let minApprovers = 1;

  if (template_id) {
    const template = await queryOne<any>(
      "SELECT * FROM molam_delegation_templates WHERE id = $1 AND is_active = TRUE",
      [template_id]
    );

    if (!template) {
      throw new AppError(404, "template_not_found", "Delegation template not found");
    }

    finalScope = { ...template.default_scope, ...scope };
    requiresApproval = template.requires_approval;
    minApprovers = template.min_approvers;

    // Check if granter has allowed role
    if (template.allowed_granter_roles && template.allowed_granter_roles.length > 0) {
      const hasRole = req.user!.roles?.some(r => template.allowed_granter_roles.includes(r));
      if (!hasRole) {
        throw new AppError(403, "forbidden", `Insufficient role to create this delegation type`);
      }
    }
  }

  // Calculate end date if not provided
  const startDate = start_at ? new Date(start_at) : new Date();
  const endDate = end_at
    ? new Date(end_at)
    : new Date(startDate.getTime() + config.delegation.defaultDurationHours * 60 * 60 * 1000);

  // Validate duration
  const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  if (durationHours > config.delegation.maxDurationHours) {
    throw new AppError(400, "duration_too_long", `Maximum delegation duration is ${config.delegation.maxDurationHours} hours`);
  }

  // Create delegation
  const delegation = await queryOne<any>(
    `INSERT INTO molam_delegations (
      id, granter_id, grantee_id, module, role, country_code, scope,
      start_at, end_at, status, approvers, approval_required_count
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    ) RETURNING *`,
    [
      granterId,
      grantee_id,
      module,
      role,
      country_code,
      JSON.stringify(finalScope),
      startDate,
      endDate,
      requiresApproval && minApprovers > 0 ? "pending" : "active",
      finalApprovers,
      requiresApproval ? minApprovers : 0,
    ]
  );

  await auditDelegation(delegation.id, "create", granterId, req, {
    module,
    role,
    country_code,
    grantee_id,
    requires_approval: requiresApproval,
  });

  await auditExternal(granterId, "delegation_created", req, { delegation_id: delegation.id });

  res.status(201).json({
    delegation_id: delegation.id,
    status: delegation.status,
    requires_approval: requiresApproval,
    approvers_required: minApprovers,
  });
}));

/**
 * POST /v1/delegations/:id/approve
 * Approve a pending delegation
 */
router.post("/:id/approve", authRequired, requireScope("id:delegation:approve"), asyncHandler(async (req: Request, res: Response) => {
  const delegationId = req.params.id;
  const approverId = req.user!.id;
  const { comment } = req.body || {};

  const delegation = await queryOne<any>(
    "SELECT * FROM molam_delegations WHERE id = $1",
    [delegationId]
  );

  if (!delegation) {
    throw new AppError(404, "not_found", "Delegation not found");
  }

  if (delegation.status !== "pending") {
    throw new AppError(400, "invalid_status", "Delegation is not pending");
  }

  // Check if approver is in the list
  if (!delegation.approvers.includes(approverId)) {
    throw new AppError(403, "not_approver", "You are not authorized to approve this delegation");
  }

  // Check if already approved by this user
  const existing = await queryOne<any>(
    "SELECT * FROM molam_delegation_approvals WHERE delegation_id = $1 AND approver_id = $2",
    [delegationId, approverId]
  );

  if (existing) {
    throw new AppError(400, "already_approved", "You have already processed this delegation");
  }

  // Record approval
  await query(
    `INSERT INTO molam_delegation_approvals (id, delegation_id, approver_id, approved, comment)
     VALUES (gen_random_uuid(), $1, $2, TRUE, $3)`,
    [delegationId, approverId, comment || null]
  );

  // Update approvals count
  await query(
    "UPDATE molam_delegations SET approvals_received = approvals_received + 1 WHERE id = $1",
    [delegationId]
  );

  // Check if all required approvals received
  const updated = await queryOne<any>(
    "SELECT * FROM molam_delegations WHERE id = $1",
    [delegationId]
  );

  if (updated.approvals_received >= updated.approval_required_count) {
    // Activate delegation
    await query(
      "UPDATE molam_delegations SET status = 'active', updated_at = NOW() WHERE id = $1",
      [delegationId]
    );

    await auditDelegation(delegationId, "activate", approverId, req, {
      approved_by: approverId,
      total_approvals: updated.approvals_received,
    });

    // Invalidate cache
    await invalidateUserDelegations(delegation.grantee_id);

    res.json({ status: "active", message: "Delegation activated" });
  } else {
    await auditDelegation(delegationId, "approve", approverId, req, {
      approvals_received: updated.approvals_received,
      approvals_required: updated.approval_required_count,
    });

    res.json({
      status: "pending",
      approvals_received: updated.approvals_received,
      approvals_required: updated.approval_required_count,
    });
  }
}));

/**
 * POST /v1/delegations/:id/reject
 * Reject a pending delegation
 */
router.post("/:id/reject", authRequired, requireScope("id:delegation:approve"), asyncHandler(async (req: Request, res: Response) => {
  const delegationId = req.params.id;
  const approverId = req.user!.id;
  const { comment } = req.body || {};

  const delegation = await queryOne<any>(
    "SELECT * FROM molam_delegations WHERE id = $1",
    [delegationId]
  );

  if (!delegation) {
    throw new AppError(404, "not_found", "Delegation not found");
  }

  if (delegation.status !== "pending") {
    throw new AppError(400, "invalid_status", "Delegation is not pending");
  }

  if (!delegation.approvers.includes(approverId)) {
    throw new AppError(403, "not_approver", "You are not authorized to reject this delegation");
  }

  // Record rejection
  await query(
    `INSERT INTO molam_delegation_approvals (id, delegation_id, approver_id, approved, comment)
     VALUES (gen_random_uuid(), $1, $2, FALSE, $3)`,
    [delegationId, approverId, comment || "Rejected"]
  );

  // Revoke delegation
  await query(
    "UPDATE molam_delegations SET status = 'revoked', updated_at = NOW() WHERE id = $1",
    [delegationId]
  );

  await auditDelegation(delegationId, "reject", approverId, req, {
    rejected_by: approverId,
    comment,
  });

  res.json({ status: "revoked", message: "Delegation rejected" });
}));

/**
 * POST /v1/delegations/:id/revoke
 * Revoke an active delegation
 */
router.post("/:id/revoke", authRequired, requireScope("id:delegation:revoke"), asyncHandler(async (req: Request, res: Response) => {
  const delegationId = req.params.id;
  const actorId = req.user!.id;
  const { reason } = req.body || {};

  const delegation = await queryOne<any>(
    "SELECT * FROM molam_delegations WHERE id = $1",
    [delegationId]
  );

  if (!delegation) {
    throw new AppError(404, "not_found", "Delegation not found");
  }

  // Only granter or admin can revoke
  if (delegation.granter_id !== actorId && !req.user!.roles?.includes("admin")) {
    throw new AppError(403, "forbidden", "Only the granter or admin can revoke this delegation");
  }

  await query(
    "UPDATE molam_delegations SET status = 'revoked', updated_at = NOW() WHERE id = $1",
    [delegationId]
  );

  await auditDelegation(delegationId, "revoke", actorId, req, {
    reason: reason || "Manual revocation",
    revoked_by: actorId,
  });

  // Invalidate cache
  await invalidateUserDelegations(delegation.grantee_id);

  res.json({ status: "revoked" });
}));

/**
 * GET /v1/delegations/mine
 * Get active delegations for current user (as grantee)
 */
router.get("/mine", authRequired, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  // Try cache first
  const cacheKey = `delegation:user:${userId}:active`;
  const cached = await getCached<any>(cacheKey);
  if (cached) {
    return res.json({ delegations: cached });
  }

  const delegations = await query<any>(
    `SELECT * FROM molam_delegations
     WHERE grantee_id = $1
       AND status = 'active'
       AND start_at <= NOW()
       AND (end_at IS NULL OR end_at > NOW())
     ORDER BY created_at DESC`,
    [userId]
  );

  // Cache for 5 minutes
  await setCached(cacheKey, delegations, 300);

  res.json({ delegations });
}));

/**
 * GET /v1/delegations/granted
 * Get delegations granted by current user
 */
router.get("/granted", authRequired, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { status } = req.query;

  let statusFilter = "";
  const params: any[] = [userId];

  if (status) {
    statusFilter = "AND status = $2";
    params.push(status);
  }

  const delegations = await query<any>(
    `SELECT d.*,
      (SELECT json_agg(json_build_object('approver_id', approver_id, 'approved', approved, 'comment', comment, 'created_at', da.created_at))
       FROM molam_delegation_approvals da WHERE da.delegation_id = d.id) AS approvals
     FROM molam_delegations d
     WHERE granter_id = $1 ${statusFilter}
     ORDER BY created_at DESC
     LIMIT 100`,
    params
  );

  res.json({ delegations });
}));

/**
 * GET /v1/delegations/templates
 * Get available delegation templates
 */
router.get("/templates", authRequired, asyncHandler(async (_req: Request, res: Response) => {
  const templates = await query<any>(
    `SELECT id, module, role, label, description, default_duration_hours, default_scope,
            requires_approval, min_approvers, allowed_granter_roles
     FROM molam_delegation_templates
     WHERE is_active = TRUE
     ORDER BY module, role`
  );

  res.json({ templates });
}));

/**
 * GET /v1/delegations/:id
 * Get delegation details
 */
router.get("/:id", authRequired, asyncHandler(async (req: Request, res: Response) => {
  const delegationId = req.params.id;
  const userId = req.user!.id;

  const delegation = await queryOne<any>(
    `SELECT d.*,
      (SELECT json_agg(json_build_object('approver_id', approver_id, 'approved', approved, 'comment', comment, 'created_at', da.created_at))
       FROM molam_delegation_approvals da WHERE da.delegation_id = d.id) AS approvals,
      (SELECT json_agg(json_build_object('action', action, 'actor_id', actor_id, 'detail', detail, 'created_at', audit.created_at))
       FROM molam_delegation_audit audit WHERE audit.delegation_id = d.id ORDER BY audit.created_at DESC LIMIT 20) AS audit_trail
     FROM molam_delegations d
     WHERE d.id = $1`,
    [delegationId]
  );

  if (!delegation) {
    throw new AppError(404, "not_found", "Delegation not found");
  }

  // Check authorization (granter, grantee, or admin)
  if (
    delegation.granter_id !== userId &&
    delegation.grantee_id !== userId &&
    !req.user!.roles?.includes("admin")
  ) {
    throw new AppError(403, "forbidden", "Access denied");
  }

  res.json({ delegation });
}));

export default router;
