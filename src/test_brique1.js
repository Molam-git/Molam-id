// src/test_brique1.js
import { execSync } from "child_process";

function exec(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

console.log("🔍 Test Brique 1 – Table molam_users\n");

try {
  console.log("✅ Vérification de la table molam_users...");
  console.log(exec(`docker compose exec db psql -U molam -d molam -c "\\d molam_users"`));

  console.log("\n✅ Insertion d'un utilisateur...");
  exec(`docker compose exec db psql -U molam -d molam -c "INSERT INTO molam_users (molam_id, phone_e164, email, password_hash, status) VALUES ('MOLAM-SN-00000001', '+221770000001', 'brique1@molam.sn', 'dummy', 'active');"`);

  console.log("\n✅ Vérification de l'insertion...");
  console.log(exec(`docker compose exec db psql -U molam -d molam -c "SELECT molam_id, email, status FROM molam_users;"`));

  console.log("\n✅ Suppression de l'utilisateur...");
  exec(`docker compose exec db psql -U molam -d molam -c "DELETE FROM molam_users WHERE molam_id='MOLAM-SN-00000001';"`);

  console.log("\n🎉 Brique 1 validée !");
} catch (err) {
  console.error("❌ Erreur Brique 1 :", err.message);
}
