/**
 * Script simplifié pour créer le super admin
 * Ne touche que la table molam_users
 */

import { pool } from "../src/db.js";
import { hashPasswordWithPepper, generateMolamId } from "../src/utils/security.js";
import dotenv from "dotenv";

dotenv.config();

const ADMIN_EMAIL = 'admin@molam.sn';
const ADMIN_PASSWORD = 'SuperSecure123!';
const ADMIN_PHONE = '+221771234567';

async function createSuperAdmin() {
  try {
    console.log("\n" + "=".repeat(80));
    console.log("🔐 CRÉATION DU SUPER ADMINISTRATEUR");
    console.log("=".repeat(80) + "\n");

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await pool.query(
      "SELECT id, email, molam_id FROM molam_users WHERE email = $1 OR phone_e164 = $2",
      [ADMIN_EMAIL.toLowerCase(), ADMIN_PHONE]
    );

    if (existingUser.rows.length > 0) {
      const existing = existingUser.rows[0];
      console.log("✅ Un super admin existe déjà !\n");
      console.log("📋 Détails:");
      console.log("  - Molam ID:", existing.molam_id);
      console.log("  - Email:", existing.email);
      console.log("  - ID:", existing.id);
      console.log("\n🔑 Identifiants de connexion:");
      console.log("  - Email:", ADMIN_EMAIL);
      console.log("  - Password:", ADMIN_PASSWORD);
      console.log("\n" + "=".repeat(80));
      await pool.end();
      return;
    }

    // Générer le Molam ID
    const molamId = generateMolamId();
    console.log("📝 Génération du Molam ID:", molamId);

    // Hasher le mot de passe
    console.log("🔐 Hashage du mot de passe...");
    const passwordHash = await hashPasswordWithPepper(ADMIN_PASSWORD);

    // Créer l'utilisateur
    console.log("💾 Création de l'utilisateur dans la base de données...");
    const userResult = await pool.query(
      `INSERT INTO molam_users
       (molam_id, email, phone_e164, password_hash, role_profile, status, kyc_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, molam_id, email, phone_e164, role_profile, status`,
      [
        molamId,
        ADMIN_EMAIL.toLowerCase(),
        ADMIN_PHONE,
        passwordHash,
        ["super_admin"],
        "active",
        "verified"
      ]
    );

    const user = userResult.rows[0];

    // Log d'audit
    await pool.query(
      `INSERT INTO molam_audit_logs
       (actor_id, action, target_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        user.id,
        "super_admin_created",
        user.id,
        JSON.stringify({
          created_by: "simple-script",
          email: user.email,
          phone: user.phone_e164
        })
      ]
    );

    console.log("\n✅ Super Admin créé avec succès!\n");
    console.log("📋 Détails du compte:");
    console.log("  - Molam ID:", user.molam_id);
    console.log("  - Email:", user.email);
    console.log("  - Téléphone:", user.phone_e164);
    console.log("  - Rôles:", user.role_profile.join(", "));
    console.log("  - Statut:", user.status);
    console.log("\n🔑 Identifiants de connexion:");
    console.log("  - Email:", ADMIN_EMAIL);
    console.log("  - Password:", ADMIN_PASSWORD);
    console.log("\n" + "=".repeat(80));
    console.log("🎉 VOUS POUVEZ MAINTENANT VOUS CONNECTER !");
    console.log("=".repeat(80));
    console.log("\n📝 Pour tester dans VSCode:");
    console.log("  1. Ouvrez test-admin.http");
    console.log("  2. Section '2. LOGIN EN TANT QUE SUPER ADMIN'");
    console.log("  3. Cliquez sur 'Send Request'\n");

  } catch (error) {
    console.error("\n❌ Erreur:", error.message);
    if (error.code) {
      console.error("Code erreur PostgreSQL:", error.code);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createSuperAdmin();
