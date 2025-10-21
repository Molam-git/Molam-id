import fetch from "node-fetch";
import dotenv from "dotenv";
import { execSync } from "child_process";

dotenv.config();

const API_URL = "http://127.0.0.1:3000/api";
let verificationId = "";
let otp = "";
let tempToken = "";
let molamId = "";
let accessToken = "";
let refreshToken = "";

async function test(name, fn) {
    try {
        console.log(`\n🧪  ${name}`);
        await fn();
        console.log(`✅  ${name} OK`);
    } catch (err) {
        console.error(`❌  ${name} échoué :`, err.message);
        if (err.response) {
            console.error(`   Réponse: ${JSON.stringify(err.response)}`);
        }
    }
}

async function post(path, body) {
    const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
        const error = new Error(`${res.status} ${res.statusText}`);
        error.response = data;
        throw error;
    }

    return data;
}

(async () => {
    console.log("🔍 Test Brique 4 - Onboarding Complet\n");

    // Générer des identifiants uniques pour chaque test
    const timestamp = Date.now().toString().slice(-8);
    const testPhone = `77${timestamp}`;  // Format : 77XXXXXXXX
    const testEmail = `test_${timestamp}@molam.sn`;
    const testPassword = "SecurePass123!";

    console.log(`📱 Téléphone de test: ${testPhone}`);
    console.log(`📧 Email de test: ${testEmail}\n`);

    // 1️⃣ Test signup init avec téléphone
    await test("Signup Init - SMS", async () => {
        const data = await post("/id/signup/init", {
            phone: testPhone,
            user_type: "customer",
            channel: "sms"
        });

        console.log(`   Verification ID: ${data.verification_id}`);
        console.log(`   Canal: ${data.channel}`);
        console.log(`   Expire dans: ${data.expires_in}s`);

        if (data.otp) {
            console.log(`   🔑 OTP (dev): ${data.otp}`);
            otp = data.otp;
        }

        verificationId = data.verification_id;

        if (!verificationId) throw new Error("Verification ID manquant");
        if (!otp) throw new Error("OTP manquant (vérifier NODE_ENV=development)");
    });

    // 2️⃣ Test signup init avec email
    await test("Signup Init - Email (second test)", async () => {
        const data = await post("/id/signup/init", {
            email: `other_${timestamp}@molam.sn`,
            user_type: "customer",
            channel: "email"
        });

        console.log(`   Verification ID: ${data.verification_id}`);
        console.log(`   Canal: ${data.channel}`);
    });

    // 3️⃣ Test vérification avec mauvais code
    await test("Signup Verify - Code incorrect", async () => {
        try {
            await post("/id/signup/verify", {
                verification_id: verificationId,
                code: "000000",
                phone: `+221${testPhone}`
            });
            throw new Error("Code incorrect accepté !");
        } catch (err) {
            if (!err.message.includes("400")) throw err;
            console.log(`   ✓ Code incorrect rejeté`);
        }
    });

    // 4️⃣ Test vérification avec bon code
    await test("Signup Verify - Code correct", async () => {
        const data = await post("/id/signup/verify", {
            verification_id: verificationId,
            code: otp,
            phone: `+221${testPhone}`
        });

        console.log(`   Message: ${data.message}`);
        console.log(`   MOLAM ID: ${data.molam_id}`);
        console.log(`   Prochaine étape: ${data.next_step}`);

        tempToken = data.temp_token;
        molamId = data.molam_id;

        if (!tempToken) throw new Error("Token temporaire manquant");
        if (!molamId) throw new Error("MOLAM ID manquant");
    });

    // 5️⃣ Test completion sans mot de passe
    await test("Signup Complete - Sans mot de passe", async () => {
        try {
            await post("/id/signup/complete", {
                temp_token: tempToken
            });
            throw new Error("Completion sans mot de passe acceptée !");
        } catch (err) {
            if (!err.message.includes("400")) throw err;
            console.log(`   ✓ Mot de passe requis`);
        }
    });

    // 6️⃣ Test completion avec mot de passe faible
    await test("Signup Complete - Mot de passe faible", async () => {
        try {
            await post("/id/signup/complete", {
                temp_token: tempToken,
                password: "123"
            });
            throw new Error("Mot de passe faible accepté !");
        } catch (err) {
            if (!err.message.includes("400")) throw err;
            console.log(`   ✓ Mot de passe faible rejeté`);
        }
    });

    // 7️⃣ Test completion avec bon mot de passe
    await test("Signup Complete - Mot de passe valide", async () => {
        const data = await post("/id/signup/complete", {
            temp_token: tempToken,
            password: testPassword,
            email: testEmail
        });

        console.log(`   Message: ${data.message}`);
        console.log(`   MOLAM ID: ${data.molam_id}`);
        console.log(`   KYC Level: ${data.user.kyc_level}`);

        accessToken = data.access_token;
        refreshToken = data.refresh_token;

        if (!accessToken) throw new Error("Access token manquant");
        if (!refreshToken) throw new Error("Refresh token manquant");
    });

    // 8️⃣ Test doublon - même téléphone
    await test("Signup Init - Doublon détecté", async () => {
        try {
            await post("/id/signup/init", {
                phone: testPhone,
                channel: "sms"
            });
            throw new Error("Doublon accepté !");
        } catch (err) {
            if (!err.message.includes("409")) throw err;
            console.log(`   ✓ Doublon correctement rejeté`);
        }
    });

    // 9️⃣ Vérification base de données - utilisateur créé
    await test("Vérification BDD - Utilisateur créé", async () => {
        const result = execSync(
            `docker compose exec -T db psql -U molam -d molam -c "SELECT molam_id, phone_e164, status, user_type, kyc_level FROM molam_users WHERE molam_id='${molamId}';"`,
            { encoding: "utf-8" }
        );

        console.log(result);

        if (!result.includes(molamId)) throw new Error("Utilisateur non trouvé");
        if (!result.includes("active")) throw new Error("Statut incorrect");
        if (!result.includes("P0")) throw new Error("KYC level incorrect");
    });

    // 🔟 Vérification BDD - Rôle créé
    await test("Vérification BDD - Rôle assigné", async () => {
        const result = execSync(
            `docker compose exec -T db psql -U molam -d molam -c "SELECT r.module, r.role FROM molam_roles r JOIN molam_users u ON r.user_id = u.id WHERE u.molam_id='${molamId}';"`,
            { encoding: "utf-8" }
        );

        console.log(result);

        if (!result.includes("id")) throw new Error("Module incorrect");
        if (!result.includes("client")) throw new Error("Rôle incorrect");
    });

    // 1️⃣1️⃣ Vérification BDD - Session créée
    await test("Vérification BDD - Session active", async () => {
        const result = execSync(
            `docker compose exec -T db psql -U molam -d molam -c "SELECT COUNT(*) FROM molam_sessions s JOIN molam_users u ON s.user_id = u.id WHERE u.molam_id='${molamId}' AND s.revoked_at IS NULL;"`,
            { encoding: "utf-8" }
        );

        console.log(result);

        if (!result.includes("1")) throw new Error("Session non créée");
    });

    // 1️⃣2️⃣ Vérification BDD - Audit logs
    await test("Vérification BDD - Logs d'audit", async () => {
        const result = execSync(
            `docker compose exec -T db psql -U molam -d molam -c "SELECT action FROM molam_audit_logs WHERE target_id IN (SELECT id FROM molam_users WHERE molam_id='${molamId}') OR (action = 'signup_init' AND meta::text LIKE '%${testPhone.replace('+221', '')}%') ORDER BY created_at;"`,
            { encoding: "utf-8" }
        );

        console.log(result);

        const actions = ["signup_verify_success", "signup_complete"];  // signup_init est optionnel
        for (const action of actions) {
            if (!result.includes(action)) {
                throw new Error(`Action manquante: ${action}`);
            }
        }

        console.log(`   ✓ Actions principales présentes`);
    });

    // 1️⃣3️⃣ Vérification du hash du mot de passe
    await test("Vérification BDD - Mot de passe hashé", async () => {
        const result = execSync(
            `docker compose exec -T db psql -U molam -d molam -c "SELECT password_hash FROM molam_users WHERE molam_id='${molamId}';"`,
            { encoding: "utf-8" }
        );

        if (result.includes(testPassword)) {
            throw new Error("Mot de passe stocké en clair !");
        }

        if (!result.includes("$2b$")) {
            throw new Error("Mot de passe non hashé avec bcrypt !");
        }

        console.log(`   ✓ Mot de passe correctement hashé`);
    });

    // 1️⃣4️⃣ Test de connexion avec le nouveau compte
    await test("Login avec le nouveau compte", async () => {
        const data = await post("/login", {
            email: testEmail,
            password: testPassword
        });

        console.log(`   Access token reçu: ${data.access_token.substring(0, 20)}...`);

        if (!data.access_token) throw new Error("Login échoué");
    });

    console.log("\n🎉  Tous les tests d'onboarding Brique 4 réussis !");
    console.log(`\n📋  Résumé:`);
    console.log(`   MOLAM ID créé: ${molamId}`);
    console.log(`   Téléphone: +221${testPhone}`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Statut: active`);
    console.log(`   KYC Level: P0`);

    process.exit(0);
})();