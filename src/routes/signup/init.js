import { pool } from "../../db.js";
import {
    generateOTP,
    hashOTP,
    getOTPExpiry,
    normalizePhone,
    isValidEmail,
    generateNonce
} from "../../utils/security.js";
import { checkRateLimit } from "../../services/rateLimiter.js";
import { sendOTPSMS } from "../../services/smsService.js";
import { sendOTPEmail } from "../../services/emailService.js";

/**
 * POST /api/id/signup/init
 * Initialise le processus d'inscription
 */
export async function signupInit(req, res) {
    const { phone, email, user_type = "customer", channel = "sms" } = req.body;

    try {
        // Validation des entrées
        if (!phone && !email) {
            return res.status(400).json({
                error: "Téléphone ou email requis"
            });
        }

        if (channel !== "sms" && channel !== "email") {
            return res.status(400).json({
                error: "Canal invalide. Utilisez 'sms' ou 'email'"
            });
        }

        let normalizedPhone = null;
        let normalizedEmail = null;

        // Normalisation et validation
        if (phone) {
            normalizedPhone = normalizePhone(phone);

            // Rate limiting par téléphone
            const phoneKey = `signup_phone_${normalizedPhone}`;
            await checkRateLimit(phoneKey, "signup_init", 5, 60); // 5 tentatives/heure
        }

        if (email) {
            normalizedEmail = email.toLowerCase().trim();

            if (!isValidEmail(normalizedEmail)) {
                return res.status(400).json({ error: "Email invalide" });
            }

            // Rate limiting par email
            const emailKey = `signup_email_${normalizedEmail}`;
            await checkRateLimit(emailKey, "signup_init", 5, 60);
        }

        // Rate limiting par IP
        const ip = req.ip || req.connection.remoteAddress;
        await checkRateLimit(`signup_ip_${ip}`, "signup_init", 20, 60);

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await pool.query(
            `SELECT id, status FROM molam_users 
       WHERE phone_e164 = $1 OR email = $2`,
            [normalizedPhone, normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            const user = existingUser.rows[0];
            if (user.status === "active") {
                return res.status(409).json({
                    error: "Un compte existe déjà avec ces informations"
                });
            }
            // Si compte "pending", on peut renvoyer un OTP
        }

        // Générer OTP
        const otp = generateOTP();
        const otpHash = await hashOTP(otp);
        const expiresAt = getOTPExpiry(15);
        const nonce = generateNonce();

        // Stocker le code de vérification
        const verificationResult = await pool.query(
            `INSERT INTO molam_verification_codes 
       (phone, email, code_hash, channel, purpose, nonce, expires_at, max_attempts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
            [
                normalizedPhone,
                normalizedEmail,
                otpHash,
                channel,
                "signup",
                nonce,
                expiresAt,
                3
            ]
        );

        const verificationId = verificationResult.rows[0].id;

        // Envoyer l'OTP
        if (channel === "sms" && normalizedPhone) {
            await sendOTPSMS(normalizedPhone, otp);
        } else if (channel === "email" && normalizedEmail) {
            await sendOTPEmail(normalizedEmail, otp);
        }

        // Log d'audit
        await pool.query(
            `INSERT INTO molam_audit_logs (action, target_id, meta)
   VALUES ($1, NULL, $2)`,
            [
                "signup_init",
                JSON.stringify({
                    phone: normalizedPhone,
                    email: normalizedEmail,
                    channel,
                    user_type,
                    verification_id: verificationId,
                })
            ]
        );

        // Réponse (ne jamais retourner l'OTP en production!)
        res.status(200).json({
            message: "Code de vérification envoyé",
            verification_id: verificationId,
            channel,
            expires_in: 900, // 15 minutes en secondes
            // ⚠️ UNIQUEMENT POUR LE DEV - À RETIRER EN PRODUCTION
            otp,
        });

    } catch (err) {
        console.error("Erreur signup init:", err);

        if (err.message.includes("Rate limit")) {
            return res.status(429).json({ error: err.message });
        }

        res.status(500).json({ error: "Erreur lors de l'initialisation" });
    }
}