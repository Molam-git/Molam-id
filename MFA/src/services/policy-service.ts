import { pool } from '../utils/repos.js';
import { PolicyCheckRequest, PolicyRule } from '../types/index.js';

export class PolicyService {
    static async checkPolicy(request: PolicyCheckRequest) {
        const { rows } = await pool.query(
            'SELECT rule FROM molam_mfa_policies WHERE scope = $1',
            [request.scope]
        );

        if (rows.length === 0) {
            // Politique par défaut
            return { required: ['any_one'], min_factors: 1 };
        }

        const rule: PolicyRule = rows[0].rule;
        const requirements = this.evaluateRule(rule, request);

        return {
            min_factors: rule.min_factors || 1,
            required: Array.from(new Set(requirements))
        };
    }

    private static evaluateRule(rule: PolicyRule, request: PolicyCheckRequest): string[] {
        const requirements: string[] = [];

        // Vérification des rôles
        if (rule.require_webauthn_for_roles?.includes(request.role!)) {
            requirements.push('webauthn');
        }

        // Vérification des seuils monétaires
        if (request.amount && request.currency && rule.thresholds) {
            const threshold = rule.thresholds[request.currency];
            if (threshold && request.amount > threshold) {
                requirements.push('totp_or_webauthn');
            }
        }

        // Vérification de la confiance du device
        if (request.device_trust && request.device_trust !== 'high') {
            requirements.push('otp_or_totp');
        }

        // Vérification géographique
        if (request.country) {
            if (rule.blocked_countries?.includes(request.country)) {
                requirements.push('step_up_required');
            }
            if (rule.allowed_countries && !rule.allowed_countries.includes(request.country)) {
                requirements.push('step_up_required');
            }
        }

        return requirements;
    }

    static async createPolicy(scope: string, rule: PolicyRule) {
        await pool.query(
            'INSERT INTO molam_mfa_policies (scope, rule) VALUES ($1, $2)',
            [scope, rule]
        );
    }
}