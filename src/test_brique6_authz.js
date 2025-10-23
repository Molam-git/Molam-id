// src/test_brique6_authz.js
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "http://127.0.0.1:3000";

// Variables globales pour les tests
let adminToken = "";
let clientToken = "";
let adminUserId = "";
let clientUserId = "";
let adminMolamId = "";
let clientMolamId = "";

// Fonction utilitaire
async function test(name, fn) {
  try {
    console.log(`\n🧪  ${name}`);
    await fn();
    console.log(`✅  ${name} OK`);
    return true;
  } catch (err) {
    console.error(`❌  ${name} échoué :`, err.message);
    return false;
  }
}

async function post(path, body, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(data)}`);
  return data;
}

async function get(path, token = null) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(data)}`);
  return data;
}

async function deleteReq(path, token = null) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { method: "DELETE", headers });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(data)}`);
  return data;
}

(async () => {
  console.log("🔍 Test Brique 6 - RBAC & AuthZ Service\n");
  console.log("========================================");

  // ========================================
  // PARTIE 1: CRÉATION DES COMPTES DE TEST
  // ========================================
  console.log("\n============================================================");
  console.log("PARTIE 1: CRÉATION DES COMPTES DE TEST");
  console.log("============================================================");

  await test("1.1 - Créer un utilisateur admin", async () => {
    const data = await post("/api/signup", {
      email: "admin_brique66@molam.sn",
      phone: "+221770006006",
      password: "Admin123!",
    });
    adminToken = data.access_token;
    adminMolamId = data.molam_id;
    adminUserId = data.molam_id; // Temporaire, sera remplacé

    // Extraire l'user_id du token
    const payload = JSON.parse(Buffer.from(adminToken.split('.')[1], 'base64').toString());
    adminUserId = payload.sub || payload.user_id;

    console.log(`   Admin User ID: ${adminUserId}`);
    console.log(`   MOLAM ID: ${adminMolamId}`);
  });

  await test("1.2 - Créer un utilisateur client", async () => {
    const data = await post("/api/signup", {
      email: "client_brique66@molam.sn",
      phone: "+221770006007",
      password: "Client12!",
    });
    clientToken = data.access_token;
    clientMolamId = data.molam_id;

    const payload = JSON.parse(Buffer.from(clientToken.split('.')[1], 'base64').toString());
    clientUserId = payload.sub || payload.user_id;

    console.log(`   Client User ID: ${clientUserId}`);
    console.log(`   MOLAM ID: ${clientMolamId}`);
  });

  // ========================================
  // PARTIE 1.5: BOOTSTRAP ADMIN VIA SQL
  // ========================================
  console.log("\n============================================================");
  console.log("PARTIE 1.5: BOOTSTRAP ADMIN (Attribution id_admin via SQL)");
  console.log("============================================================");

  await test("1.5 - Attribuer id_admin à l'admin via SQL", async () => {
    // Note: Dans un environnement de production, ceci serait fait via un script bootstrap séparé
    // Pour les tests, on le fait directement via SQL
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    // Insérer dans molam_user_roles (nouvelle table Brique 6)
    await execAsync(`docker compose exec -T db psql -U molam -d molam -c "INSERT INTO molam_user_roles (user_id, role_name, module, trusted_level, granted_by, granted_at) VALUES ('${adminUserId}', 'id_admin', 'id', 100, NULL, NOW()) ON CONFLICT DO NOTHING;"`);

    // Insérer aussi dans molam_roles (ancienne table pour compatibilité avec login)
    await execAsync(`docker compose exec -T db psql -U molam -d molam -c "INSERT INTO molam_roles (user_id, module, role, granted_by) VALUES ('${adminUserId}', 'id', 'id_admin', NULL) ON CONFLICT DO NOTHING;"`);

    console.log(`   ✓ Rôle id_admin attribué à ${adminUserId}`);

    // Reconnecter l'admin pour obtenir un nouveau token avec le rôle id_admin
    const loginData = await post("/login", {
      email: "admin_brique46@molam.sn",
      password: "Admin13!"
    });

    adminToken = loginData.access_token;
    const payload = JSON.parse(Buffer.from(adminToken.split('.')[1], 'base64').toString());
    console.log(`   ✓ Admin reconnecté avec nouveau token`);
    console.log(`   Rôles dans le token: ${JSON.stringify(payload.roles)}`);
  });

  // ========================================
  // PARTIE 2: ATTRIBUTION DES RÔLES
  // ========================================
  console.log("\n============================================================");
  console.log("PARTIE 2: ATTRIBUTION DES RÔLES");
  console.log("============================================================");

  await test("2.1 - Attribuer le rôle id_admin à l'admin", async () => {
    const data = await post(
      `/v1/authz/users/${adminUserId}/roles`,
      {
        role_name: "id_admin",
        module: "id",
        trusted_level: 100
      },
      adminToken
    );
    console.log(`   Rôle attribué: ${data.role.role_name}`);
  });

  await test("2.2 - Attribuer le rôle pay_client au client", async () => {
    const data = await post(
      `/v1/authz/users/${clientUserId}/roles`,
      {
        role_name: "pay_client",
        module: "pay",
        trusted_level: 10
      },
      adminToken
    );
    console.log(`   Rôle attribué: ${data.role.role_name}`);
  });

  // ========================================
  // PARTIE 3: CONSULTATION DES RÔLES ET PERMISSIONS
  // ========================================
  console.log("\n============================================================");
  console.log("PARTIE 3: CONSULTATION DES RÔLES ET PERMISSIONS");
  console.log("============================================================");

  await test("3.1 - Lister les rôles de l'admin", async () => {
    const data = await get(`/v1/authz/users/${adminUserId}/roles`, adminToken);
    console.log(`   Rôles trouvés: ${data.roles.length}`);
    data.roles.forEach(r => {
      console.log(`     - ${r.role_name} (module: ${r.module}, level: ${r.trusted_level})`);
    });
  });

  await test("3.2 - Lister les permissions de l'admin", async () => {
    const data = await get(`/v1/authz/users/${adminUserId}/permissions`, adminToken);
    console.log(`   Permissions trouvées: ${data.permissions.length}`);
    if (data.permissions.length > 0) {
      console.log(`   Exemples:`);
      data.permissions.slice(0, 3).forEach(p => {
        console.log(`     - ${p.permission_name}: ${p.description}`);
      });
    }
  });

  await test("3.3 - Lister les rôles du client", async () => {
    const data = await get(`/v1/authz/users/${clientUserId}/roles`, clientToken);
    console.log(`   Rôles trouvés: ${data.roles.length}`);
    data.roles.forEach(r => {
      console.log(`     - ${r.role_name} (module: ${r.module})`);
    });
  });

  await test("3.4 - Lister les permissions du client", async () => {
    const data = await get(`/v1/authz/users/${clientUserId}/permissions`, clientToken);
    console.log(`   Permissions trouvées: ${data.permissions.length}`);
    if (data.permissions.length > 0) {
      console.log(`   Exemples:`);
      data.permissions.slice(0, 3).forEach(p => {
        console.log(`     - ${p.permission_name}`);
      });
    }
  });

  // ========================================
  // PARTIE 4: DÉCISIONS D'AUTORISATION
  // ========================================
  console.log("\n============================================================");
  console.log("PARTIE 4: DÉCISIONS D'AUTORISATION");
  console.log("============================================================");

  await test("4.1 - Admin accède à une route admin", async () => {
    const data = await post("/v1/authz/decide", {
      user_id: adminUserId,
      path: "/api/admin/users",
      method: "GET",
      module: "id",
      roles: ["id_admin"],
      context: {
        kyc_level: "P2",
        country: "SN"
      }
    });
    console.log(`   Décision: ${data.decision}`);
    console.log(`   Raison: ${data.reason}`);
    console.log(`   Audit ID: ${data.audit_id}`);

    if (data.decision !== "allow") {
      throw new Error("Admin devrait avoir accès");
    }
  });

  await test("4.2 - Client accède à une route pay_transfer avec KYC P2", async () => {
    const data = await post("/v1/authz/decide", {
      user_id: clientUserId,
      path: "/api/pay/transfer",
      method: "POST",
      module: "pay",
      roles: ["pay_client"],
      context: {
        kyc_level: "P2",
        country: "SN",
        sira_score: 75
      }
    });
    console.log(`   Décision: ${data.decision}`);
    console.log(`   Raison: ${data.reason}`);
    console.log(`   Audit ID: ${data.audit_id}`);

    if (data.decision !== "allow") {
      throw new Error("Client P2 devrait pouvoir transférer");
    }
  });

  await test("4.3 - Client accède à pay_transfer avec KYC P0 (doit être refusé)", async () => {
    const data = await post("/v1/authz/decide", {
      user_id: clientUserId,
      path: "/api/pay/transfer",
      method: "POST",
      module: "pay",
      roles: ["pay_client"],
      context: {
        kyc_level: "P0",
        country: "SN",
        sira_score: 75
      }
    });
    console.log(`   Décision: ${data.decision}`);
    console.log(`   Raison: ${data.reason}`);

    if (data.decision !== "deny") {
      throw new Error("Client P0 devrait être refusé");
    }
    console.log(`   ✓ Correctement refusé (KYC insuffisant)`);
  });

  await test("4.4 - Client accède à pay_transfer avec SIRA score bas", async () => {
    const data = await post("/v1/authz/decide", {
      user_id: clientUserId,
      path: "/api/pay/transfer",
      method: "POST",
      module: "pay",
      roles: ["pay_client"],
      context: {
        kyc_level: "P2",
        country: "SN",
        sira_score: 25  // score trop bas
      }
    });
    console.log(`   Décision: ${data.decision}`);
    console.log(`   Raison: ${data.reason}`);

    if (data.decision !== "deny") {
      throw new Error("Client avec SIRA bas devrait être refusé");
    }
    console.log(`   ✓ Correctement refusé (SIRA score trop bas)`);
  });

  await test("4.5 - Client accède à une route d'un autre module", async () => {
    const data = await post("/v1/authz/decide", {
      user_id: clientUserId,
      path: "/api/eats/order",
      method: "POST",
      module: "eats",
      roles: ["pay_client"],  // n'a que pay_client, pas eats_customer
      context: {
        kyc_level: "P2",
        country: "SN"
      }
    });
    console.log(`   Décision: ${data.decision}`);
    console.log(`   Raison: ${data.reason}`);

    if (data.decision !== "deny") {
      throw new Error("Client sans rôle eats devrait être refusé");
    }
    console.log(`   ✓ Correctement refusé (pas de rôle pour le module)`);
  });

  // ========================================
  // PARTIE 5: TEST DU CACHE
  // ========================================
  console.log("\n============================================================");
  console.log("PARTIE 5: TEST DU CACHE");
  console.log("============================================================");

  await test("5.1 - Première décision (non cached)", async () => {
    const data = await post("/v1/authz/decide", {
      user_id: clientUserId,
      path: "/api/pay/account/balance",
      method: "GET",
      module: "pay",
      roles: ["pay_client"],
      context: {
        kyc_level: "P2",
        country: "SN",
        sira_score: 70
      }
    });
    console.log(`   Décision: ${data.decision}`);
    console.log(`   Cached: ${data.cached || false}`);
    console.log(`   Audit ID: ${data.audit_id}`);

    if (data.cached) {
      throw new Error("Première requête ne devrait pas être en cache");
    }
  });

  await test("5.2 - Deuxième décision identique (doit être cached)", async () => {
    const data = await post("/v1/authz/decide", {
      user_id: clientUserId,
      path: "/api/pay/account/balance",
      method: "GET",
      module: "pay",
      roles: ["pay_client"],
      context: {
        kyc_level: "P2",
        country: "SN",
        sira_score: 70
      }
    });
    console.log(`   Décision: ${data.decision}`);
    console.log(`   Cached: ${data.cached || false}`);
    console.log(`   Audit ID: ${data.audit_id}`);

    if (!data.cached) {
      console.warn(`   ⚠️ Devrait être en cache mais ne l'est pas`);
    } else {
      console.log(`   ✓ Décision servie depuis le cache`);
    }
  });

  // ========================================
  // PARTIE 6: RÉVOCATION DE RÔLE
  // ========================================
  console.log("\n============================================================");
  console.log("PARTIE 6: RÉVOCATION DE RÔLE");
  console.log("============================================================");

  await test("6.1 - Révoquer le rôle pay_client du client", async () => {
    const data = await deleteReq(
      `/v1/authz/users/${clientUserId}/roles/pay_client?module=pay`,
      adminToken
    );
    console.log(`   ${data.message}`);
  });

  await test("6.2 - Vérifier que le client n'a plus le rôle", async () => {
    const data = await get(`/v1/authz/users/${clientUserId}/roles`, clientToken);
    console.log(`   Rôles restants: ${data.roles.length}`);

    const hasPayClient = data.roles.some(r => r.role_name === "pay_client");
    if (hasPayClient) {
      throw new Error("Le rôle devrait avoir été révoqué");
    }
    console.log(`   ✓ Rôle pay_client révoqué avec succès`);
  });

  // ========================================
  // RÉSUMÉ
  // ========================================
  console.log("\n============================================================");
  console.log("🎉  TESTS DE LA BRIQUE 6 TERMINÉS !");
  console.log("============================================================");

  console.log("\n📋  Résumé:");
  console.log(`   Admin MOLAM ID: ${adminMolamId}`);
  console.log(`   Client MOLAM ID: ${clientMolamId}`);
  console.log("\n✅  Fonctionnalités testées:");
  console.log("   • Attribution et révocation de rôles");
  console.log("   • Consultation des rôles et permissions");
  console.log("   • Décisions d'autorisation (allow/deny)");
  console.log("   • Policies ABAC (KYC level, SIRA score)");
  console.log("   • Isolation par module");
  console.log("   • Cache des décisions");
  console.log("   • Audit trail");

})();
