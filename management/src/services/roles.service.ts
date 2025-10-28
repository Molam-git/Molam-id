import { addGrant, getRoleById, revokeGrant, upsertRole } from '../repo/roles.repo';
import { checkPermission } from '../rbac/check';
import { publish } from '../stream/kafka';
import { redis } from '../repo/redis';
import { pool } from '../repo';
import { RoleDTO } from '../types';

async function canManage(actorId: string, scope: string, targetRoleId?: string) {
    const { rows: s } = await pool.query(`SELECT can_manage_scope($1,$2) AS ok`, [actorId, scope]);
    if (!s[0]?.ok) return false;
    if (targetRoleId) {
        const { rows: t } = await pool.query(`SELECT has_higher_trust($1,$2) AS ok`, [actorId, targetRoleId]);
        return !!t[0]?.ok;
    }
    return true;
}

export async function createOrUpdateRole(actorId: string, dto: RoleDTO) {
    if (!await canManage(actorId, dto.module_scope)) {
        throw Object.assign(new Error('forbidden_scope'), { status: 403 });
    }
    const ok = await checkPermission(actorId, 'id.role.manage', { scope: dto.module_scope });
    if (!ok) throw Object.assign(new Error('forbidden'), { status: 403 });

    const role = await upsertRole(actorId, dto);

    await publish('id.role.changed', { role_id: role.id, by: actorId, ts: Date.now() });
    return role;
}

export async function grantRole(actorId: string, userId: string, roleId: string, requireApproval: boolean) {
    const role = await getRoleById(roleId);
    if (!role) throw Object.assign(new Error('role_not_found'), { status: 404 });

    if (!await canManage(actorId, role.module_scope, roleId)) {
        throw Object.assign(new Error('forbidden_trust_or_scope'), { status: 403 });
    }

    const ok = await checkPermission(actorId, 'id.role.assign', { scope: role.module_scope, role: role.name });
    if (!ok) throw Object.assign(new Error('forbidden'), { status: 403 });

    if (requireApproval || role.trusted_level >= 80) {
        const { rows } = await pool.query(
            `INSERT INTO molam_role_grants_approvals(request_id,user_id,role_id,requested_by,approver_required)
       VALUES (gen_random_uuid(),$1,$2,$3,TRUE) RETURNING *`,
            [userId, roleId, actorId]
        );
        await publish('id.role.grant.requested', { request_id: rows[0].id, user_id: userId, role_id: roleId, by: actorId });
        return { status: 'pending', request_id: rows[0].id };
    }

    const added = await addGrant(userId, roleId, actorId);
    await pool.query(
        `INSERT INTO molam_rbac_audit(id,user_id,role_id,decision,reason,ctx)
     VALUES (gen_random_uuid(),$1,$2,'allow','role_granted',json_build_object('by',$3))`,
        [userId, roleId, actorId]
    );

    await redis.del(`rbac:user:${userId}:perms`);

    await publish('id.role.granted', { user_id: userId, role_id: roleId, by: actorId, created: !!added });

    return { status: added ? 'granted' : 'already_assigned' };
}

export async function revokeRole(actorId: string, userId: string, roleId: string) {
    const role = await getRoleById(roleId);
    if (!role) throw Object.assign(new Error('role_not_found'), { status: 404 });

    if (!await canManage(actorId, role.module_scope, roleId)) {
        throw Object.assign(new Error('forbidden_trust_or_scope'), { status: 403 });
    }

    const ok = await checkPermission(actorId, 'id.role.revoke', { scope: role.module_scope, role: role.name });
    if (!ok) throw Object.assign(new Error('forbidden'), { status: 403 });

    const removed = await revokeGrant(userId, roleId);

    await pool.query(
        `INSERT INTO molam_rbac_audit(id,user_id,role_id,decision,reason,ctx)
     VALUES (gen_random_uuid(),$1,$2,'allow','role_revoked',json_build_object('by',$3))`,
        [userId, roleId, actorId]
    );

    await redis.del(`rbac:user:${userId}:perms`);
    await publish('id.role.revoked', { user_id: userId, role_id: roleId, by: actorId, removed });

    return { status: removed ? 'revoked' : 'not_assigned' };
}

export async function approveGrant(actorId: string, requestId: string, approve: boolean) {
    const { rows } = await pool.query(`SELECT * FROM molam_role_grants_approvals WHERE request_id=$1`, [requestId]);
    const req = rows[0];
    if (!req) throw Object.assign(new Error('request_not_found'), { status: 404 });

    const role = await getRoleById(req.role_id);
    if (!role) throw Object.assign(new Error('role_not_found'), { status: 404 });

    if (!await canManage(actorId, role.module_scope, role.id)) {
        throw Object.assign(new Error('forbidden_trust_or_scope'), { status: 403 });
    }

    if (!approve) {
        await pool.query(`UPDATE molam_role_grants_approvals SET status='rejected', approved_by=$2, approved_at=NOW() WHERE id=$1`, [req.id, actorId]);
        await publish('id.role.grant.rejected', { request_id: requestId, by: actorId });
        return { status: 'rejected' };
    }

    await addGrant(req.user_id, req.role_id, actorId);
    await pool.query(`UPDATE molam_role_grants_approvals SET status='approved', approved_by=$2, approved_at=NOW() WHERE id=$1`, [req.id, actorId]);
    await publish('id.role.grant.approved', { request_id: requestId, by: actorId, user_id: req.user_id, role_id: req.role_id });
    await redis.del(`rbac:user:${req.user_id}:perms`);

    return { status: 'approved' };
}