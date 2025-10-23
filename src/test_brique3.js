// src/test_brique3.js
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { execSync } from "child_process";

dotenv.config();

const API_URL = "http://127.0.0.1:3000/api";
let refreshToken = "";
let accessToken = "";
let molamId = "";

// Fonction utilitaire
async function test(name, fn) {
  try {
    console.log(`\n🧪  ${name}`);
    await fn();
    console.log(`✅  ${name} OK`);
  } catch (err) {
    console.error(`❌  ${name} échoué :`, err.message);
  }
}

async function post(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

// Vérifier que l'API est accessible
async function checkApiHealth() {
  try {
    console.log("🔍 Vérification de l'accessibilité de l'API...");
    const res = await fetch(`${API_URL}/health`, { timeout: 5000 });
    console.log("✅ API accessible");
    return true;
  } catch (err) {
    console.error("❌ API non accessible. Assurez-vous que le serveur tourne :");
    console.error("   docker compose up -d");
    console.error("   docker compose logs api");
    return false;
  }
}

(async () => {
  // Vérification préalable
  const isApiUp = await checkApiHealth();
  if (!isApiUp) {
    console.log("\n⚠️  Tests annulés : API non disponible");
    process.exit(1);
  }

  // 1️⃣ SIGNUP
  await test("Signup", async () => {
    const data = await post("/signup", {
      email: "auto_test@molam.sn",
      phone: "+221770001111",
      password: "secret",
    });
    console.log(data);
    molamId = data.molam_id;
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
    
    if (!accessToken || !refreshToken) {
      throw new Error("Tokens manquants dans la réponse");
    }
  });

  // 2️⃣ LOGIN
  await test("Login", async () => {
    const data = await post("/login", {
      email: "auto_test@molam.sn",
      password: "secret",
    });
    console.log(data);
    refreshToken = data.refresh_token;
    accessToken = data.access_token;
  });

  // 3️⃣ REFRESH
  await test("Refresh token", async () => {
    const data = await post("/refresh", { token: refreshToken });
    console.log(data);
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
  });

  // 4️⃣ LOGOUT
  await test("Logout", async () => {
    const data = await post("/logout", { token: refreshToken });
    console.log(data);
  });

  // 5️⃣ AUDIT LOGS
  await test("Vérification des logs d'audit", async () => {
    const logs = execSync(
      `docker compose exec db psql -U molam -d molam -c "SELECT action, meta FROM molam_audit_logs ORDER BY created_at DESC LIMIT 5;"`,
      { encoding: "utf-8" }
    );
    console.log(logs);
    if (!logs.includes("signup")) throw new Error("aucun log 'signup' trouvé");
  });

  // 6️⃣ SÉCURITÉ DES HASHS
  await test("Vérification des hashs", async () => {
    const users = execSync(
      `docker compose exec db psql -U molam -d molam -c "SELECT password_hash FROM molam_users LIMIT 1;"`,
      { encoding: "utf-8" }
    );
    if (users.includes("secret"))
      throw new Error("Mot de passe non hashé !");
  });

  // 7️⃣ JWT
  await test("Décodage JWT", async () => {
    if (!accessToken) {
      throw new Error("Pas de token disponible (les tests précédents ont échoué)");
    }
    
    const decoded = jwt.decode(accessToken);
    console.log(decoded);
    
    if (!decoded) {
      throw new Error("Token non décodable");
    }
    
    if (!decoded.molam_id || !decoded.user_id) {
      throw new Error("Token invalide : champs manquants");
    }
  });

  console.log("\n🎉  Tous les tests de la Brique 3 ont été exécutés !");
})();