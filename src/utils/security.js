import crypto from "crypto";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 15;

// Pepper stocké dans .env (en production : HSM/Vault)
const PEPPER = process.env.PASSWORD_PEPPER || "change_me_in_production";

/**
 * Génère un OTP numérique à 6 chiffres
 */
export function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash un OTP avec bcrypt
 */
export async function hashOTP(otp) {
  return bcrypt.hash(otp, SALT_ROUNDS);
}

/**
 * Vérifie un OTP contre son hash
 */
export async function verifyOTP(otp, hash) {
  return bcrypt.compare(otp, hash);
}

/**
 * Hash un mot de passe avec Argon2id simulation (bcrypt + pepper)
 * En production : utiliser argon2 avec pepper depuis HSM
 */
export async function hashPasswordWithPepper(password) {
  const peppered = password + PEPPER;
  return bcrypt.hash(peppered, SALT_ROUNDS);
}

/**
 * Vérifie un mot de passe avec pepper
 */
export async function verifyPasswordWithPepper(password, hash) {
  const peppered = password + PEPPER;
  return bcrypt.compare(peppered, hash);
}

/**
 * Génère un nonce pour replay protection
 */
export function generateNonce() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Calcule un HMAC-SHA256
 */
export function calculateHMAC(data, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(data))
    .digest("hex");
}

/**
 * Vérifie un HMAC
 */
export function verifyHMAC(data, signature, secret) {
  try {
    const expected = calculateHMAC(data, secret);
    
    // S'assurer que les deux signatures ont la même longueur
    if (signature.length !== expected.length) {
      return false;
    }
    
    // Comparaison timing-safe
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch (err) {
    // En cas d'erreur (ex: format hex invalide), retourner false
    return false;
  }
}

/**
 * Hash SHA256 pour content integrity
 */
export function sha256Hash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Calcule l'expiration d'un OTP
 */
export function getOTPExpiry(minutes = OTP_EXPIRY_MINUTES) {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry;
}

/**
 * Normalise un numéro de téléphone au format E.164
 * Simple version - en production utiliser libphonenumber
 */
export function normalizePhone(phone) {
  // Supprime les espaces et caractères spéciaux
  let normalized = phone.replace(/[\s\-\(\)]/g, "");
  
  // Si commence par 0 (Sénégal), remplace par +221
  if (normalized.startsWith("0") && normalized.length === 10) {
    normalized = "+221" + normalized.substring(1);  // substring(1) pour enlever le 0
  }
  // Si ne commence pas par + et a 9 chiffres, ajoute +221 (Sénégal par défaut)
  else if (!normalized.startsWith("+") && normalized.length === 9) {
    normalized = "+221" + normalized;
  }
  // Si déjà au format international
  else if (!normalized.startsWith("+")) {
    normalized = "+221" + normalized;
  }
  
  return normalized;
}

/**
 * Valide un format email
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Génère un device fingerprint simple
 */
export function generateDeviceFingerprint(userAgent, ip) {
  const data = `${userAgent}-${ip}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Alias pour hashPasswordWithPepper (rétrocompatibilité)
 */
export async function hashPassword(password) {
  return hashPasswordWithPepper(password);
}

/**
 * Génère un Molam ID unique (format: MID-XXXXXXXXXXXX)
 */
export function generateMolamId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `MID-${timestamp}${randomPart}`;
}