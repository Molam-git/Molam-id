// src/test.ts
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'http://localhost:3000'; // change si ton serveur écoute sur un autre port

async function runTest() {
    try {
        // 1️⃣ Créer un utilisateur test (ou utiliser un existant)
        const testUser = {
            email: `test-${uuidv4()}@example.com`,
            phone: `+221700000${Math.floor(Math.random() * 9000 + 1000)}`,
            ussd_pin: '1234',
            country: 'SN',
        };

        console.log('Utilisateur test:', testUser);

        // 2️⃣ Demander OTP
        const startRes = await axios.post(`${BASE_URL}/ussd/pin/reset/start`, {
            identity: testUser.phone,
        });

        console.log('OTP envoyé, expires_at:', startRes.data.expires_at);

        // Ici tu devrais récupérer l’OTP réel depuis la DB ou mock pour test
        const otp = '123456'; // mettre un OTP valide de test

        // 3️⃣ Vérifier OTP
        const verifyRes = await axios.post(`${BASE_URL}/ussd/pin/reset/verify`, {
            identity: testUser.phone,
            otp,
        });

        console.log('OTP vérifié:', verifyRes.data.status);

        // 4️⃣ Confirmer nouveau PIN
        const newPin = '5678';
        const confirmRes = await axios.post(`${BASE_URL}/ussd/pin/reset/confirm`, {
            identity: testUser.phone,
            new_pin: newPin,
        });

        console.log('PIN réinitialisé:', confirmRes.data.status);

        // 5️⃣ Vérifier sessions invalidées
        // Ici tu peux faire un GET sur les sessions de l’utilisateur ou checker DB

        console.log('Test terminé ✅');
    } catch (err: any) {
        console.error('Erreur test:', err.response?.data || err.message);
    }
}

runTest();
