// tests/simple.test.ts
import request from 'supertest';
import { app } from '../src/app.js';

const TEST_JWT = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.test-token';

async function runTests() {
    console.log('🚀 Démarrage des tests MFA...');

    // Test de santé
    const healthResponse = await request(app).get('/healthz');
    console.log('Health check:', healthResponse.status === 200 ? '✅' : '❌');

    // Test d'enrôlement TOTP
    const enrollResponse = await request(app)
        .post('/v1/mfa/enroll')
        .set('Authorization', `Bearer ${TEST_JWT}`)
        .send({ type: 'totp', label: 'Test' });

    console.log('Enroll TOTP:', enrollResponse.status === 201 ? '✅' : '❌');

    console.log('📊 Tests terminés');
}

runTests().catch(console.error);