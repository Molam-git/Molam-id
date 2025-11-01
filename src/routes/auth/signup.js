import { pool } from "../../db.js";
import { hashPassword, generateMolamId, normalizePhone, isValidEmail } from "../../utils/security.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/**
 * POST /api/id/auth/signup
 * Signup direct (sans OTP) - Pour SDK
 */
export async function authSignup(req, res) {
    const { phone, email, password, firstName, lastName, locale = "en", country = "SN" } = req.body;

    console.log('📝 Signup request received:', { phone, email, firstName, lastName, hasPassword: !!password });

    try {
        // Validation des entrées
        if (!phone && !email) {
            return res.status(400).json({
                error: "Phone or email required"
            });
        }

        if (!password || password.length < 8) {
            return res.status(400).json({
                error: "Password must be at least 8 characters"
            });
        }

        let normalizedPhone = null;
        let normalizedEmail = null;

        // Normalisation
        if (phone) {
            normalizedPhone = normalizePhone(phone);
        }

        if (email) {
            normalizedEmail = email.toLowerCase().trim();
            if (!isValidEmail(normalizedEmail)) {
                return res.status(400).json({ error: "Invalid email" });
            }
        }

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await pool.query(
            `SELECT id, status FROM molam_users
             WHERE phone_e164 = $1 OR email = $2`,
            [normalizedPhone, normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: "Account already exists with this phone or email"
            });
        }

        // Hash du mot de passe
        const passwordHash = await hashPassword(password);

        // Générer un Molam ID unique
        const molamId = await generateMolamId();

        // Créer l'utilisateur
        const userResult = await pool.query(
            `INSERT INTO molam_users
             (molam_id, phone_e164, email, password_hash, status, lang_pref,
              user_type, kyc_level, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, molam_id, phone_e164, email, status, user_type, created_at`,
            [
                molamId,
                normalizedPhone,
                normalizedEmail,
                passwordHash,
                'active', // Active directement sans vérification
                locale,
                'customer',
                'P0',
                JSON.stringify({
                    firstName,
                    lastName,
                    country,
                    signupChannel: 'web',
                    signupMethod: 'direct'
                })
            ]
        );

        const user = userResult.rows[0];

        // Générer une session et des tokens
        const device = req.body.device || {
            fingerprint: `web-${Date.now()}`,
            type: 'web',
            model: req.headers['user-agent'] || 'Unknown'
        };

        const ip = req.ip || req.connection.remoteAddress;

        // Calculer l'expiration de la session (7 jours)
        const sessionExpiresAt = new Date();
        sessionExpiresAt.setDate(sessionExpiresAt.getDate() + 7);

        // Hash du refresh token (sera généré plus tard)
        const tempRefreshTokenHash = jwt.sign({ temp: true }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });

        const sessionResult = await pool.query(
            `INSERT INTO molam_sessions
             (user_id, refresh_token_hash, device_id, expires_at, metadata)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, created_at, expires_at`,
            [
                user.id,
                tempRefreshTokenHash,
                device.fingerprint,
                sessionExpiresAt,
                JSON.stringify({
                    channel: 'web',
                    ip,
                    user_agent: req.headers['user-agent'],
                    status: 'active'
                })
            ]
        );

        const session = sessionResult.rows[0];

        // Générer les tokens JWT
        const accessToken = jwt.sign(
            {
                user_id: user.id,
                molam_id: user.molam_id,
                session_id: session.id,
                email: user.email,
                phone: user.phone_e164,
                user_type: user.user_type,
                roles: []
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        const refreshToken = jwt.sign(
            {
                user_id: user.id,
                session_id: session.id,
                type: 'refresh'
            },
            JWT_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
        );

        const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes

        // Log d'audit
        await pool.query(
            `INSERT INTO molam_audit_logs (action, actor_id, target_id, metadata)
             VALUES ($1, $2, $3, $4)`,
            [
                "auth_signup",
                user.id,
                user.id,
                JSON.stringify({
                    phone: normalizedPhone,
                    email: normalizedEmail,
                    method: 'direct',
                    channel: 'web'
                })
            ]
        );

        // Parse metadata to get firstName and lastName
        const metadata = typeof user.metadata === 'string' ? JSON.parse(user.metadata) : user.metadata;

        console.log('✅ Signup successful - User created:', {
            id: user.id,
            phone: user.phone_e164,
            email: user.email,
            firstName: metadata?.firstName,
            lastName: metadata?.lastName
        });

        res.status(201).json({
            message: "Account created successfully",
            user: {
                id: user.id,
                molamId: user.molam_id,
                phone: user.phone_e164,
                phone_number: user.phone_e164,
                email: user.email,
                status: user.status,
                userType: user.user_type,
                created_at: user.created_at,
                createdAt: user.created_at,
                profile: {
                    given_name: metadata?.firstName || firstName,
                    family_name: metadata?.lastName || lastName,
                }
            },
            session: {
                id: session.id,
                expiresAt: session.expires_at
            },
            tokens: {
                accessToken,
                refreshToken,
                expiresAt
            }
        });

    } catch (err) {
        console.error("Error in auth signup:", err);
        res.status(500).json({ error: "Failed to create account" });
    }
}
