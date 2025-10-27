import { Router } from 'express';
import { requireJWT } from '../middleware/auth.js';
import { validate, enrollSchema, challengeSchema, verifySchema, policySchema } from '../middleware/validation.js';
import { MfaService } from '../services/mfa-service.js';
import { PolicyService } from '../services/policy-service.js';

const router = Router();

// Enrôlement d'un facteur MFA
router.post(
    '/enroll',
    requireJWT('id:mfa:enroll'),
    validate(enrollSchema),
    async (req, res): Promise<void> => {  // Ajout de : Promise<void>
        try {
            const userId = req.user!.sub;
            const result = await MfaService.enrollFactor(userId, req.body.type, req.body);
            res.status(201).json(result);
        } catch (error: any) {
            res.status(400).json({ error: 'enrollment_failed', message: error.message });
        }
    }
);

// Déclenchement d'un challenge
router.post(
    '/challenge',
    requireJWT('id:mfa:challenge'),
    validate(challengeSchema),
    async (req, res): Promise<void> => {  // Ajout de : Promise<void>
        try {
            const userId = req.user!.sub;
            const result = await MfaService.challengeFactor(
                userId,
                req.body.type,
                req.body.factor_id,
                req.body.address
            );
            res.status(201).json(result);
        } catch (error: any) {
            res.status(400).json({ error: 'challenge_failed', message: error.message });
        }
    }
);

// Vérification d'un facteur
router.post(
    '/verify',
    requireJWT('id:mfa:verify'),
    validate(verifySchema),
    async (req, res): Promise<void> => {  // Ajout de : Promise<void>
        try {
            const userId = req.user!.sub;
            const verified = await MfaService.verifyFactor(userId, req.body);

            if (!verified) {
                res.status(401).json({ status: 'denied' });
                return;
            }

            res.json({ status: 'ok' });
        } catch (error: any) {
            res.status(400).json({ error: 'verification_failed', message: error.message });
        }
    }
);

// Génération de codes de récupération
router.post(
    '/recovery/generate',
    requireJWT('id:mfa:recovery'),
    async (req, res): Promise<void> => {  // Ajout de : Promise<void>
        try {
            const userId = req.user!.sub;
            const result = await MfaService.generateRecoveryCodes(userId);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: 'generation_failed', message: error.message });
        }
    }
);

// Vérification de politique
router.post(
    '/policy/check',
    requireJWT('id:mfa:policy'),
    validate(policySchema),
    async (req, res): Promise<void> => {  // Ajout de : Promise<void>
        try {
            const result = await PolicyService.checkPolicy(req.body);
            res.json(result);
        } catch (error: any) {
            res.status(400).json({ error: 'policy_check_failed', message: error.message });
        }
    }
);

// Routes WebAuthn (simplifiées)
router.post('/webauthn/register/start', requireJWT('id:mfa:enroll'), async (req, res): Promise<void> => {
    res.json({ status: 'webAuthn_registration_started' });
});

router.post('/webauthn/register/finish', requireJWT('id:mfa:enroll'), async (req, res): Promise<void> => {
    res.json({ status: 'webAuthn_registration_completed' });
});

router.post('/webauthn/authenticate/start', requireJWT('id:mfa:verify'), async (req, res): Promise<void> => {
    res.json({ status: 'webAuthn_authentication_started' });
});

router.post('/webauthn/authenticate/finish', requireJWT('id:mfa:verify'), async (req, res): Promise<void> => {
    res.json({ status: 'webAuthn_authentication_completed' });
});

export default router;