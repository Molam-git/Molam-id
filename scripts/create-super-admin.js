/**
 * Script pour créer le premier utilisateur Super Admin
 * Usage: node scripts/create-super-admin.js
 */

import { pool } from "../src/db.js";
import { hashPasswordWithPepper, generateMolamId } from "../src/utils/security.js";
import dotenv from "dotenv";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

dotenv.config();

const rl = readline.createInterface({ input, output });

async function createSuperAdmin() {
  try {
    console.log("\n" + "=".repeat(80));
    console.log("🔐 CRÉATION DU SUPER ADMINISTRATEUR");
    console.log("=".repeat(80) + "\n");

    // Demander les informations
    const email = await rl.question("📧 Email du super admin: ");
    const password = await rl.question("🔑 Mot de passe (min 8 caractères): ");
    const phone = await rl.question("📱 Téléphone (format E.164, ex: +221771234567): ");

    // Validation basique
    if (!email || !email.includes("@")) {
      throw new Error("Email invalide");
    }

    if (!password || password.length < 8) {
      throw new Error("Le mot de passe doit contenir au moins 8 caractères");
    }

    if (!phone || !phone.startsWith("+")) {
      throw new Error("Le téléphone doit être au format E.164 (ex: +221771234567)");
    }

    console.log("\n⏳ Création du super admin en cours...\n");

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await pool.query(
      "SELECT id FROM molam_users WHERE email = $1 OR phone_e164 = $2",
      [email.toLowerCase(), phone]
    );

    if (existingUser.rows.length > 0) {
      throw new Error("Un utilisateur avec cet email ou téléphone existe déjà");
    }

    // Générer le Molam ID
    const molamId = generateMolamId();

    // Hasher le mot de passe
    const passwordHash = await hashPasswordWithPepper(password);

    // Créer l'utilisateur
    const userResult = await pool.query(
      `INSERT INTO molam_users
       (molam_id, email, phone_e164, password_hash, role_profile, status, kyc_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, molam_id, email, phone_e164, role_profile, status`,
      [
        molamId,
        email.toLowerCase(),
        phone,
        passwordHash,
        ["super_admin"], // Array de rôles
        "active",
        "verified"
      ]
    );

    const user = userResult.rows[0];

    // Assigner le rôle super_admin dans molam_roles (nouvelle table RBAC)
    // Vérifier d'abord si la table existe
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'molam_roles'
      )`
    );

    if (tableCheck.rows[0].exists) {
      await pool.query(
        `INSERT INTO molam_roles
         (user_id, role_name, module, trusted_level, granted_by, granted_at)
         VALUES ($1, $2, $3, $4, NULL, NOW())
         ON CONFLICT (user_id, role_name, module) DO NOTHING`,
        [user.id, "super_admin", "*", 100]
      );
    }

    // Vérifier si molam_user_roles existe (ancienne table)
    const userRolesCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'molam_user_roles'
      )`
    );

    if (userRolesCheck.rows[0].exists) {
      // Vérifier si molam_roles (catalog) existe
      const rolesCatalogCheck = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'molam_roles'
        )`
      );

      if (rolesCatalogCheck.rows[0].exists) {
        // Insérer dans le catalogue de rôles si nécessaire
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
          created_by: "script",
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
    console.log("🔐 IMPORTANT: Gardez ces identifiants en sécurité!");
    console.log("=".repeat(80) + "\n");

  } catch (error) {
    console.error("\n❌ Erreur lors de la création du super admin:", error.message);
    console.error("\nDétails:", error);
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

// Exécuter le script
createSuperAdmin();
