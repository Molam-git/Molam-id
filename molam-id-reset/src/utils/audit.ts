import { query } from '../db';

export async function log(actorId: string | null, targetId: string, action: string, module: string, req: any, metadata: any) {
    const ip = req.ip;
    const ua = req.headers['user-agent'];
    await query(
        `INSERT INTO molam_audit_logs(actor_user_id,target_user_id,action,module,ip,user_agent,metadata,country_code)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [actorId, targetId, action, module, ip, ua, metadata, metadata.country]
    );
}
