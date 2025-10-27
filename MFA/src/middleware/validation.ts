import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

export const enrollSchema = Joi.object({
    type: Joi.string().valid('sms_otp', 'email_otp', 'totp', 'webauthn', 'push', 'ussd_pin').required(),
    channel: Joi.string().when('type', {
        is: Joi.valid('sms_otp', 'email_otp'),
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    address: Joi.string().when('type', {
        is: Joi.valid('sms_otp', 'email_otp'),
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    label: Joi.string().max(100),
    ussd_pin: Joi.string().min(4).max(6).when('type', {
        is: 'ussd_pin',
        then: Joi.required(),
        otherwise: Joi.forbidden()
    })
});

export const challengeSchema = Joi.object({
    type: Joi.string().valid('sms_otp', 'email_otp', 'push').required(),
    factor_id: Joi.string().uuid(),
    address: Joi.string().when('type', {
        is: Joi.valid('sms_otp', 'email_otp'),
        then: Joi.required(),
        otherwise: Joi.optional()
    })
});

export const verifySchema = Joi.object({
    kind: Joi.string().valid('sms_otp', 'email_otp', 'totp', 'webauthn', 'recovery_code', 'ussd_pin').required(),
    challenge_id: Joi.string().uuid().when('kind', {
        is: Joi.valid('sms_otp', 'email_otp'),
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    code: Joi.string().when('kind', {
        is: Joi.valid('sms_otp', 'email_otp'),
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    totp: Joi.string().when('kind', {
        is: 'totp',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    recovery_code: Joi.string().when('kind', {
        is: 'recovery_code',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    ussd_pin: Joi.string().when('kind', {
        is: 'ussd_pin',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    device_trust: Joi.string().valid('high', 'medium', 'low', 'unknown')
});

export const policySchema = Joi.object({
    scope: Joi.string().required(),
    amount: Joi.number().min(0),
    currency: Joi.string().length(3),
    role: Joi.string(),
    device_trust: Joi.string().valid('high', 'medium', 'low', 'unknown'),
    country: Joi.string().length(2)
});

export function validate(schema: Joi.Schema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const { error } = schema.validate(req.body);
        if (error) {
            res.status(400).json({
                error: 'validation_failed',
                message: error.details[0]?.message || 'Validation error' // Correction ici
            });
            return;
        }
        next();
    };
}