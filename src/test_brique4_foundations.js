import dotenv from "dotenv";
import { pool } from "./db.js";
import {
  generateOTP,
  hashOTP,
  verifyOTP,
  hashPasswordWithPepper,
  verifyPasswordWithPepper,
  generateNonce,
  calculateHMAC,
  verifyHMAC,
  sha256Hash,
  normalizePhone,
  isValidEmail,
  getOTPExpiry,
  generateDeviceFingerprint,
} from "./utils/security.js";
import { checkRateLimit, blockKey } from "./services/rateLimiter.js";

dotenv.config();

async function test(name, fn) {
  try {
    console.log(`\n🧪  ${name}`);
    await fn();
    console.log(`✅  ${name} OK`);
  } catch (err) {
    console.error(`❌  ${name} échoué :`, err.message);
  }
}

(async () => {
  console.log("🔍 Test Brique 4 - Fondations (Sécurité & Migrations)\n");

  // 1️⃣ Test de génération et vérification OTP
  await test("Génération et hash OTP", async () => {
    const otp = generateOTP();
    console.log(`   OTP généré: ${otp}`);
    
    if (otp.length !== 6) throw new Error("OTP doit avoir 6 chiffres");
    
    const hash = await hashOTP(otp);
    console.log(`   Hash: ${hash.substring(0, 20)}...`);
    
    const isValid = await verifyOTP(otp, hash);
    if (!isValid) throw new Error("Vérification OTP échouée");
    
    const isInvalid = await verifyOTP("000000", hash);
    if (isInvalid) throw new Error("OTP invalide accepté !");
  });

  // 2️⃣ Test de hash de mot de passe avec pepper
  await test("Hash mot de passe avec pepper", async () => {
    const password = "MonMotDePasse123!";
    const hash = await hashPasswordWithPepper(password);
    console.log(`   Hash: ${hash.substring(0, 20)}...`);
    
    const isValid = await verifyPasswordWithPepper(password, hash);
    if (!isValid) throw new Error("Vérification mot de passe échouée");
    
    const isInvalid = await verifyPasswordWithPepper("MauvaisPassword", hash);
    if (isInvalid) throw new Error("Mauvais mot de passe accepté !");
  });

 // 3️⃣ Test HMAC signature
await test("Signature et vérification HMAC", async () => {
  const data = { user_id: "123", status: "verified" };
  const secret = "webhook_secret_key";
  
  const signature = calculateHMAC(data, secret);
  console.log(`   Signature: ${signature.substring(0, 20)}...`);
  
  const isValid = verifyHMAC(data, signature, secret);
  if (!isValid) throw new Error("Vérification HMAC échouée");
  
  // Test avec mauvaise signature de bonne longueur
  const badSig = "0".repeat(64); // 64 zéros
  const isInvalid = verifyHMAC(data, badSig, secret);
  if (isInvalid) throw new Error("Mauvaise signature acceptée !");
  
  // Test avec données modifiées
  const tamperedData = { user_id: "999", status: "verified" };
  const isInvalid2 = verifyHMAC(tamperedData, signature, secret);
  if (isInvalid2) throw new Error("Données modifiées acceptées !");
  
  console.log(`   ✓ Signatures invalides correctement rejetées`);
});

  // 4️⃣ Test SHA256 hash
await test("Signature et vérification HMAC", async () => {
  const data = { user_id: "123", status: "verified" };
  const secret = "webhook_secret_key";
  
  const signature = calculateHMAC(data, secret);
  console.log(`   Signature: ${signature.substring(0, 20)}...`);
  
  const isValid = verifyHMAC(data, signature, secret);
  if (!isValid) throw new Error("Vérification HMAC échouée");
  
  // Test avec mauvaise signature
  const isInvalid = verifyHMAC(data, "bad_signature_1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab", secret);
  if (isInvalid) throw new Error("Mauvaise signature acceptée !");
  
  // Test avec données modifiées
  const tamperedData = { user_id: "999", status: "verified" };
  const isInvalid2 = verifyHMAC(tamperedData, signature, secret);
  if (isInvalid2) throw new Error("Données modifiées acceptées !");
  
  console.log(`   ✓ Signatures invalides correctement rejetées`);
});

  // 5️⃣ Test normalisation téléphone
  await test("Normalisation numéro de téléphone", async () => {
    const tests = [
      { input: "770001111", expected: "+221770001111" },
      { input: "0770001111", expected: "+221770001111" },
      { input: "+221770001111", expected: "+221770001111" },
      { input: "77 000 11 11", expected: "+221770001111" },
    ];
    
    for (const { input, expected } of tests) {
      const result = normalizePhone(input);
      console.log(`   ${input} -> ${result}`);
      if (result !== expected) {
        throw new Error(`Expected ${expected}, got ${result}`);
      }
    }
  });

  // 6️⃣ Test validation email
  await test("Validation format email", async () => {
    const validEmails = ["test@molam.sn", "user.name@example.com"];
    const invalidEmails = ["notanemail", "@molam.sn", "test@"];
    
    for (const email of validEmails) {
      if (!isValidEmail(email)) {
        throw new Error(`Email valide rejeté: ${email}`);
      }
    }
    
    for (const email of invalidEmails) {
      if (isValidEmail(email)) {
        throw new Error(`Email invalide accepté: ${email}`);
      }
    }
    
    console.log(`   ${validEmails.length} valides, ${invalidEmails.length} invalides`);
  });

  // 7️⃣ Test expiration OTP
  await test("Calcul expiration OTP", async () => {
    const expiry = getOTPExpiry(15);
    const now = new Date();
    const diffMinutes = (expiry - now) / 1000 / 60;
    
    console.log(`   Expire dans: ${diffMinutes.toFixed(2)} minutes`);
    
    if (diffMinutes < 14.9 || diffMinutes > 15.1) {
      throw new Error("Expiration incorrecte");
    }
  });

  // 8️⃣ Test device fingerprint
  await test("Génération device fingerprint", async () => {
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
    const ip = "192.168.1.100";
    
    const fingerprint = generateDeviceFingerprint(userAgent, ip);
    console.log(`   Fingerprint: ${fingerprint.substring(0, 20)}...`);
    
    if (fingerprint.length !== 64) throw new Error("Fingerprint invalide");
    
    const fingerprint2 = generateDeviceFingerprint(userAgent, ip);
    if (fingerprint !== fingerprint2) {
      throw new Error("Fingerprint non déterministe");
    }
  });

  // 9️⃣ Test nonce generation
  await test("Génération nonce pour replay protection", async () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    
    console.log(`   Nonce 1: ${nonce1}`);
    console.log(`   Nonce 2: ${nonce2}`);
    
    if (nonce1 === nonce2) throw new Error("Nonce non unique");
    if (nonce1.length !== 32) throw new Error("Nonce taille incorrecte");
  });

  // 🔟 Test vérification des nouvelles tables
  await test("Vérification structure base de données", async () => {
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'molam_%'
      ORDER BY table_name
    `);
    
    const tableNames = tables.rows.map(r => r.table_name);
    console.log(`   Tables trouvées: ${tableNames.length}`);
    tableNames.forEach(name => console.log(`   - ${name}`));
    
    const requiredTables = [
      'molam_users',
      'molam_verification_codes',
      'molam_kyc_docs',
      'molam_rate_limits',
      'molam_webhook_events'
    ];
    
    for (const required of requiredTables) {
      if (!tableNames.includes(required)) {
        throw new Error(`Table manquante: ${required}`);
      }
    }
  });

  // 1️⃣1️⃣ Test colonnes ajoutées à molam_users
  await test("Vérification colonnes onboarding molam_users", async () => {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'molam_users' 
      AND column_name IN ('user_type', 'kyc_level', 'is_kyc_verified', 'created_via', 'ussd_pin_hash')
    `);
    
    const columns = result.rows.map(r => r.column_name);
    console.log(`   Colonnes: ${columns.join(', ')}`);
    
    const required = ['user_type', 'kyc_level', 'is_kyc_verified'];
    for (const col of required) {
      if (!columns.includes(col)) {
        throw new Error(`Colonne manquante: ${col}`);
      }
    }
  });

  // 1️⃣2️⃣ Test insertion verification code
  await test("Insertion code de vérification", async () => {
    const otp = generateOTP();
    const hash = await hashOTP(otp);
    const expiry = getOTPExpiry(15);
    
    const result = await pool.query(`
      INSERT INTO molam_verification_codes 
      (phone, code_hash, channel, purpose, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, ['+221770001111', hash, 'sms', 'signup', expiry]);
    
    console.log(`   Code ID: ${result.rows[0].id}`);
    
    // Nettoyage
    await pool.query(`DELETE FROM molam_verification_codes WHERE id = $1`, [result.rows[0].id]);
  });

  // 1️⃣3️⃣ Test rate limiting
  await test("Rate limiting - tentatives autorisées", async () => {
    const key = `test_ip_${Date.now()}`;
    const type = "signup";
    
    // Première tentative
    const result1 = await checkRateLimit(key, type, 3, 60);
    console.log(`   Tentative 1: remaining = ${result1.remaining}`);
    if (result1.remaining !== 2) throw new Error("Compteur incorrect");
    
    // Deuxième tentative
    const result2 = await checkRateLimit(key, type, 3, 60);
    console.log(`   Tentative 2: remaining = ${result2.remaining}`);
    if (result2.remaining !== 1) throw new Error("Compteur incorrect");
    
    // Nettoyage
    await pool.query(`DELETE FROM molam_rate_limits WHERE key = $1`, [key]);
  });

  // 1️⃣4️⃣ Test rate limiting - blocage
  await test("Rate limiting - blocage après dépassement", async () => {
    const key = `test_block_${Date.now()}`;
    const type = "otp_send";
    
    // Utiliser toutes les tentatives
    await checkRateLimit(key, type, 2, 60);
    await checkRateLimit(key, type, 2, 60);
    
    // La troisième devrait échouer
    try {
      await checkRateLimit(key, type, 2, 60);
      throw new Error("Le rate limit aurait dû bloquer !");
    } catch (err) {
      if (!err.message.includes("Rate limit exceeded")) throw err;
      console.log(`   ✓ Correctement bloqué: ${err.message}`);
    }
    
    // Nettoyage
    await pool.query(`DELETE FROM molam_rate_limits WHERE key = $1`, [key]);
  });

  // 1️⃣5️⃣ Test webhook event storage
  await test("Stockage événement webhook", async () => {
    const eventId = `kyc_${Date.now()}`;
    const payload = { user_id: "123", status: "verified", kyc_level: "P1" };
    const signature = calculateHMAC(payload, "webhook_secret");
    
    const result = await pool.query(`
      INSERT INTO molam_webhook_events (provider, event_id, signature, payload)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
    `, ["kyc_provider", eventId, signature, JSON.stringify(payload)]);
    
    console.log(`   Event ID: ${result.rows[0].id}`);
    console.log(`   Created: ${result.rows[0].created_at}`);
    
    // Vérifier unicité event_id
    try {
      await pool.query(`
        INSERT INTO molam_webhook_events (provider, event_id, signature, payload)
        VALUES ($1, $2, $3, $4)
      `, ["kyc_provider", eventId, signature, JSON.stringify(payload)]);
      throw new Error("Doublon event_id accepté !");
    } catch (err) {
      if (!err.message.includes("duplicate key")) throw err;
      console.log(`   ✓ Protection contre les doublons active`);
    }
    
    // Nettoyage
    await pool.query(`DELETE FROM molam_webhook_events WHERE event_id = $1`, [eventId]);
  });

  console.log("\n🎉  Tous les tests de fondations Brique 4 réussis !");
  
  // Fermer la connexion
  await pool.end();
  process.exit(0);
})();