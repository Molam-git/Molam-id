/**
 * Script de test pour l'API Admin en local
 * Usage: node test-admin-local.js
 */

import https from 'https';
import http from 'http';

const BASE_URL = 'http://localhost:3000';
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Stocker le token et l'userId
let accessToken = '';
let superAdminUserId = '';
let testUserId = '';

/**
 * Faire une requête HTTP
 */
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(url, options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: jsonBody
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Logger avec couleur
 */
function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

/**
 * Afficher un test
 */
function logTest(name, success, details = '') {
  const icon = success ? '✓' : '✗';
  const color = success ? 'green' : 'red';
  log(`  ${icon} ${name}`, color);
  if (details) {
    log(`    ${details}`, 'cyan');
  }
}

/**
 * Tests
 */
async function runTests() {
  console.log('\n' + '='.repeat(80));
  log('🧪 TESTS ADMIN API - MOLAM ID (LOCALHOST)', 'blue');
  console.log('='.repeat(80) + '\n');

  try {
    // =======================================================================
    // Test 1: Vérifier que le serveur fonctionne
    // =======================================================================
    log('\n[1/10] Vérification du serveur...', 'yellow');
    try {
      const response = await makeRequest('GET', '/');
      logTest(
        'Serveur accessible',
        response.status === 200,
        `Status: ${response.status}`
      );
      if (response.body.service) {
        logTest(
          'Service identifié',
          true,
          `Service: ${response.body.service} v${response.body.version}`
        );
      }
    } catch (error) {
      logTest('Serveur accessible', false, `Erreur: ${error.message}`);
      log('\n❌ Le serveur n\'est pas démarré. Lancez-le avec: npm start', 'red');
      process.exit(1);
    }

    // =======================================================================
    // Test 2: Login en tant que super admin
    // =======================================================================
    log('\n[2/10] Connexion en tant que super admin...', 'yellow');
    log('  ⚠️  Assurez-vous d\'avoir créé le super admin avec:', 'yellow');
    log('     node scripts/create-super-admin.js\n', 'yellow');

    const loginEmail = process.env.ADMIN_EMAIL || 'admin@molam.sn';
    const loginPassword = process.env.ADMIN_PASSWORD || 'SuperSecure123!';

    try {
      const loginResponse = await makeRequest('POST', '/api/id/login', {
        email: loginEmail,
        password: loginPassword
      });

      if (loginResponse.status === 200 && loginResponse.body.access_token) {
        accessToken = loginResponse.body.access_token;
        superAdminUserId = loginResponse.body.user.user_id;
        logTest('Login réussi', true, `Token obtenu`);
        logTest(
          'Super admin ID',
          true,
          `User ID: ${superAdminUserId.substring(0, 8)}...`
        );
      } else {
        logTest('Login réussi', false, `Status: ${loginResponse.status}`);
        log('\n❌ Créez d\'abord le super admin avec:', 'red');
        log('   node scripts/create-super-admin.js', 'red');
        process.exit(1);
      }
    } catch (error) {
      logTest('Login réussi', false, `Erreur: ${error.message}`);
      process.exit(1);
    }

    // =======================================================================
    // Test 3: Vérifier le rôle super_admin
    // =======================================================================
    log('\n[3/10] Vérification du rôle super_admin...', 'yellow');
    try {
      const rolesResponse = await makeRequest(
        'GET',
        `/v1/authz/users/${superAdminUserId}/roles`,
        null,
        accessToken
      );

      const hasSuperAdmin = rolesResponse.body.roles?.some(
        r => r.role_name === 'super_admin'
      );
      logTest('Rôle super_admin présent', hasSuperAdmin, `Rôles: ${rolesResponse.body.roles?.map(r => r.role_name).join(', ')}`);
    } catch (error) {
      logTest('Rôle super_admin présent', false, `Erreur: ${error.message}`);
    }

    // =======================================================================
    // Test 4: Obtenir les statistiques
    // =======================================================================
    log('\n[4/10] Récupération des statistiques...', 'yellow');
    try {
      const statsResponse = await makeRequest(
        'GET',
        '/api/admin/users/stats',
        null,
        accessToken
      );

      logTest(
        'Statistiques obtenues',
        statsResponse.status === 200,
        `Total users: ${statsResponse.body.total_users}, Active: ${statsResponse.body.active_users}`
      );
    } catch (error) {
      logTest('Statistiques obtenues', false, `Erreur: ${error.message}`);
    }

    // =======================================================================
    // Test 5: Lister les utilisateurs
    // =======================================================================
    log('\n[5/10] Liste des utilisateurs...', 'yellow');
    try {
      const usersResponse = await makeRequest(
        'GET',
        '/api/admin/users?page=1&limit=5',
        null,
        accessToken
      );

      logTest(
        'Liste obtenue',
        usersResponse.status === 200,
        `Utilisateurs trouvés: ${usersResponse.body.users?.length || 0}`
      );
    } catch (error) {
      logTest('Liste obtenue', false, `Erreur: ${error.message}`);
    }

    // =======================================================================
    // Test 6: Créer un utilisateur
    // =======================================================================
    log('\n[6/10] Création d\'un utilisateur de test...', 'yellow');
    try {
      const createResponse = await makeRequest(
        'POST',
        '/api/admin/users',
        {
          email: `test${Date.now()}@molam.sn`,
          phone: `+221771234${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          password: 'TestUser123!',
          roles: ['client'],
          status: 'active',
          kycStatus: 'none'
        },
        accessToken
      );

      if (createResponse.status === 201) {
        testUserId = createResponse.body.user.id;
        logTest(
          'Utilisateur créé',
          true,
          `ID: ${testUserId.substring(0, 8)}..., Email: ${createResponse.body.user.email}`
        );
      } else {
        logTest('Utilisateur créé', false, `Status: ${createResponse.status}`);
      }
    } catch (error) {
      logTest('Utilisateur créé', false, `Erreur: ${error.message}`);
    }

    // =======================================================================
    // Test 7: Lister les rôles
    // =======================================================================
    log('\n[7/10] Liste des rôles disponibles...', 'yellow');
    try {
      const rolesResponse = await makeRequest(
        'GET',
        '/api/admin/roles',
        null,
        accessToken
      );

      logTest(
        'Rôles listés',
        rolesResponse.status === 200,
        `Rôles disponibles: ${rolesResponse.body.count || 0}`
      );

      if (rolesResponse.body.roles) {
        const roleNames = rolesResponse.body.roles.map(r => r.role_name).slice(0, 5);
        log(`    Exemples: ${roleNames.join(', ')}`, 'cyan');
      }
    } catch (error) {
      logTest('Rôles listés', false, `Erreur: ${error.message}`);
    }

    // =======================================================================
    // Test 8: Assigner un rôle
    // =======================================================================
    if (testUserId) {
      log('\n[8/10] Attribution d\'un rôle...', 'yellow');
      try {
        const assignResponse = await makeRequest(
          'POST',
          `/api/admin/users/${testUserId}/assign-role`,
          {
            role_name: 'merchant',
            module: 'pay',
            trusted_level: 20
          },
          accessToken
        );

        logTest(
          'Rôle assigné',
          assignResponse.status === 200,
          `Rôle merchant assigné à l'utilisateur test`
        );
      } catch (error) {
        logTest('Rôle assigné', false, `Erreur: ${error.message}`);
      }
    }

    // =======================================================================
    // Test 9: Tests de sécurité
    // =======================================================================
    log('\n[9/10] Tests de sécurité...', 'yellow');

    // Test sans token
    try {
      const noTokenResponse = await makeRequest('GET', '/api/admin/users');
      logTest(
        'Refus sans token',
        noTokenResponse.status === 401,
        `Status: ${noTokenResponse.status}`
      );
    } catch (error) {
      logTest('Refus sans token', false, `Erreur: ${error.message}`);
    }

    // Test suppression de son propre compte
    try {
      const selfDeleteResponse = await makeRequest(
        'DELETE',
        `/api/admin/users/${superAdminUserId}`,
        null,
        accessToken
      );
      logTest(
        'Empêche auto-suppression',
        selfDeleteResponse.status === 403,
        `Status: ${selfDeleteResponse.status}`
      );
    } catch (error) {
      logTest('Empêche auto-suppression', false, `Erreur: ${error.message}`);
    }

    // =======================================================================
    // Test 10: Nettoyage
    // =======================================================================
    if (testUserId) {
      log('\n[10/10] Nettoyage...', 'yellow');
      try {
        const deleteResponse = await makeRequest(
          'DELETE',
          `/api/admin/users/${testUserId}`,
          null,
          accessToken
        );

        logTest(
          'Utilisateur test supprimé',
          deleteResponse.status === 200,
          `Nettoyage terminé`
        );
      } catch (error) {
        logTest('Utilisateur test supprimé', false, `Erreur: ${error.message}`);
      }
    }

    // =======================================================================
    // Résumé
    // =======================================================================
    console.log('\n' + '='.repeat(80));
    log('✅ TESTS TERMINÉS', 'green');
    console.log('='.repeat(80));
    log('\n📚 Pour plus d\'informations, consultez ADMIN_GUIDE.md', 'cyan');
    log('🔐 Token actuel (valide 15min):', 'cyan');
    log(`   ${accessToken.substring(0, 50)}...`, 'yellow');
    console.log('');

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  }
}

// Exécuter les tests
runTests();
