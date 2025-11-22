/**
 * Script automatique pour créer le super admin (non-interactif)
 * Usage: node scripts/create-super-admin-auto.js
 */

import { pool } from "../src/db.js";
import { hashPasswordWithPepper, generateMolamId } from "../src/utils/security.js";
import dotenv from "dotenv";

dotenv.config();

// Identifiants par défaut (modifiables via variables d'environnement)
const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@molam.sn';
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperSecure123!';
const ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE || '+221771234567';

async function createSuperAdmin() {
  try {
    console.log("\n" + "=".repeat(80));
    console.log("🔐 CRÉATION DU SUPER ADMINISTRATEUR (AUTO)");
    console.log("=".repeat(80) + "\n");

    console.log("📧 Email:", ADMIN_EMAIL);
    console.log("📱 Téléphone:", ADMIN_PHONE);
    console.log("\n⏳ Création du super admin en cours...\n");

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await pool.query(
      "SELECT id, email FROM molam_users WHERE email = $1 OR phone_e164 = $2",
      [ADMIN_EMAIL.toLowerCase(), ADMIN_PHONE]
    );

    if (existingUser.rows.length > 0) {
      console.log("⚠️  Un utilisateur existe déjà avec ces identifiants:");
      console.log("   Email:", existingUser.rows[0].email);
      console.log("   ID:", existingUser.rows[0].id);
      console.log("\n✅ Vous pouvez vous connecter avec ces identifiants.");
      console.log("\n💡 Pour créer un autre admin, modifiez les variables d'environnement:");
      console.log("   SUPER_ADMIN_EMAIL");
      console.log("   SUPER_ADMIN_PASSWORD");
      console.log("   SUPER_ADMIN_PHONE\n");
      return;
    }

    // Générer le Molam ID
    const molamId = generateMolamId();

    // Hasher le mot de passe
    const passwordHash = await hashPasswordWithPepper(ADMIN_PASSWORD);

    // Créer l'utilisateur
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

    // Vérifier si la table molam_user_roles existe
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'molam_user_roles'
      )`
    );

    if (tableCheck.rows[0].exists) {
      // Vérifier si le rôle super_admin existe dans molam_roles
      const roleCheck = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'molam_roles'
        )`
      );

      if (roleCheck.rows[0].exists) {
        // Créer le rôle s'il n'existe pas
        await pool.query(
          `INSERT INTO molam_roles (role_name, module, display_name, description, is_system_role)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (role_name) DO NOTHING`,
          ["super_admin", "*", "Super Administrateur", "Administrateur global avec tous les droits", true]
        );
      }

      // Assigner le rôle dans molam_user_roles
      await pool.query(
        `INSERT INTO molam_user_roles
         (user_id, role_name, module, trusted_level, granted_by, granted_at)
         VALUES ($1, $2, $3, $4, NULL, NOW())
         ON CONFLICT (user_id, role_name, module) DO NOTHING`,
        [user.id, "super_admin", "*", 100]
      );
    }

    // Créer un log d'audit
    await pool.query(
      `INSERT INTO molam_audit_logs
       (actor_id, action, target_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        user.id,
        "super_admin_created",
        user.id,
        JSON.stringify({
          created_by: "auto-script",
          email: user.email,
          phone: user.phone_e164
        })
      ]
    );

    console.log("✅ Super Admin créé avec succès!\n");
    console.log("📋 Détails du compte:");
    console.log("  - Molam ID:", user.molam_id);
    console.log("  - Email:", user.email);
    console.log("  - Téléphone:", user.phone_e164);
    console.log("  - Rôles:", user.role_profile.join(", "));
    console.log("  - Statut:", user.status);
    console.log("\n" + "=".repeat(80));
    console.log("🎉 VOUS POUVEZ MAINTENANT VOUS CONNECTER !");
    console.log("=".repeat(80));
    console.log("\n📝 Pour tester:");
    console.log("  1. Ouvrez test-admin.http dans VSCode");
    console.log("  2. Cliquez sur 'Send Request' pour login");
    console.log("  3. Testez les autres endpoints\n");

  } catch (error) {
    console.error("\n❌ Erreur lors de la création du super admin:", error.message);
    console.error("\nDétails:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter le script
createSuperAdmin();
