// src/test_brique2.js
import { execSync } from "child_process";

function exec(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

console.log("🔍 Test Brique 2 – Tables de support\n");

try {
  console.log("✅ Vérification des tables...");
  const tables = exec(`docker compose exec db psql -U molam -d molam -c "\\dt molam_*"`);
  console.log(tables);

  console.log("\n✅ Insertion d'un utilisateur de test...");
  exec(`docker compose exec db psql -U molam -d molam -c "INSERT INTO molam_users (molam_id, phone_e164, email, password_hash, status) VALUES ('MOLAM-SN-00000012', '+22177000011', 'brique00222@molam.sn', 'dummy', 'active');"`);

  console.log("\n✅ Création d'un rôle associé...");
  exec(`docker compose exec db psql -U molam -d molam -c "INSERT INTO molam_roles (user_id, module, role) SELECT id, 'id', 'client' FROM molam_users WHERE molam_id='MOLAM-SN-00000012';"`);

  console.log("\n✅ Création d'une session...");
  exec(`docker compose exec db psql -U molam -d molam -c "INSERT INTO molam_sessions (user_id, refresh_token_hash) SELECT id, 'hashsample' FROM molam_users WHERE molam_id='MOLAM-SN-00000012';"`);

  console.log("\n✅ Création d'un audit log...");
  exec(`docker compose exec db psql -U molam -d molam -c "INSERT INTO molam_audit_logs (actor, action, target_id, meta) SELECT id, 'signup', id, '{\\\"source\\\":\\\"test\\\"}'::jsonb FROM molam_users WHERE molam_id='MOLAM-SN-00000012';"`);

  console.log("\n✅ Vérification du rôle, session et log...");
  console.log(exec(`docker compose exec db psql -U molam -d molam -c "SELECT COUNT(*) FROM molam_roles;"`));
  console.log(exec(`docker compose exec db psql -U molam -d molam -c "SELECT COUNT(*) FROM molam_sessions;"`));
  console.log(exec(`docker compose exec db psql -U molam -d molam -c "SELECT COUNT(*) FROM molam_audit_logs;"`));

  console.log("\n✅ Suppression de l'utilisateur et cascade...");
  exec(`docker compose exec db psql -U molam -d molam -c "DELETE FROM molam_users WHERE molam_id='MOLAM-SN-00000012';"`);

  console.log("\n🎉 Brique 2 validée !");
} catch (err) {
  console.error("❌ Erreur Brique 2 :", err.message);
}