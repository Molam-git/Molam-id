// src/test_runner.js - Orchestrateur de tests pour toutes les briques
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const tests = [
  { id: 1, name: 'Brique 1 - Table molam_users', file: 'test_brique1.js', category: 'auth' },
  { id: 2, name: 'Brique 2 - Token refresh', file: 'test_brique2.js', category: 'auth' },
  { id: 3, name: 'Brique 3 - Logout', file: 'test_brique3.js', category: 'auth' },
  { id: 4, name: 'Brique 4 - Onboarding foundations', file: 'test_brique4_foundations.js', category: 'onboarding' },
  { id: 4.1, name: 'Brique 4 - Onboarding flow', file: 'test_brique4_onboarding.js', category: 'onboarding' },
  { id: 5, name: 'Brique 5 - Session Management', file: 'test_brique5.js', category: 'auth' },
  { id: 6, name: 'Brique 6 - RBAC & AuthZ', file: 'test_brique6_authz.js', category: 'authz' },
  { id: 7, name: 'Brique 7 - Audit Immuable', file: 'test_brique7.js', category: 'audit' },
  { id: 8, name: 'Brique 8 - KYC/AML', file: 'test_brique8.js', category: 'kyc' },
  { id: 9, name: 'Brique 9 - Extended AuthZ', file: 'test_brique9.js', category: 'authz' }
];

const results = {
  passed: [],
  failed: [],
  skipped: []
};

function runTest(test) {
  return new Promise((resolve) => {
    const testPath = path.join(process.cwd(), 'src', test.file);

    if (!fs.existsSync(testPath)) {
      console.log(`⚠️  ${test.name} - SKIPPED (file not found)`);
      results.skipped.push(test);
      resolve({ test, status: 'skipped' });
      return;
    }

    console.log(`\n🧪 Running ${test.name}...`);
    console.log(`   File: ${test.file}`);

    const child = spawn('node', [testPath], {
      stdio: 'inherit',
      env: { ...process.env }
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${test.name} - PASSED`);
        results.passed.push(test);
        resolve({ test, status: 'passed' });
      } else {
        console.log(`❌ ${test.name} - FAILED (exit code: ${code})`);
        results.failed.push(test);
        resolve({ test, status: 'failed', code });
      }
    });

    child.on('error', (err) => {
      console.log(`❌ ${test.name} - ERROR: ${err.message}`);
      results.failed.push(test);
      resolve({ test, status: 'error', error: err.message });
    });
  });
}

async function runAllTests() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  MOLAM-ID - Test Suite Complet (Briques 1-9)');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`\nDate: ${new Date().toISOString()}`);
  console.log(`Tests to run: ${tests.length}`);
  console.log('');

  const startTime = Date.now();

  // Run tests sequentially to avoid conflicts
  for (const test of tests) {
    await runTest(test);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Generate report
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  RÉSUMÉ DES TESTS');
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log(`Durée totale: ${duration}s\n`);

  console.log(`✅ PASSED  : ${results.passed.length}`);
  results.passed.forEach(t => console.log(`   - ${t.name}`));

  console.log(`\n❌ FAILED  : ${results.failed.length}`);
  results.failed.forEach(t => console.log(`   - ${t.name}`));

  console.log(`\n⚠️  SKIPPED : ${results.skipped.length}`);
  results.skipped.forEach(t => console.log(`   - ${t.name}`));

  const total = results.passed.length + results.failed.length + results.skipped.length;
  const successRate = total > 0 ? ((results.passed.length / total) * 100).toFixed(1) : 0;

  console.log(`\nTaux de réussite: ${successRate}% (${results.passed.length}/${total})`);

  // By category
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  PAR CATÉGORIE');
  console.log('══════════════════════════════════════════════════════════════\n');

  const categories = {};
  tests.forEach(t => {
    if (!categories[t.category]) {
      categories[t.category] = { passed: 0, failed: 0, skipped: 0 };
    }
  });

  results.passed.forEach(t => categories[t.category].passed++);
  results.failed.forEach(t => categories[t.category].failed++);
  results.skipped.forEach(t => categories[t.category].skipped++);

  Object.keys(categories).forEach(cat => {
    const stats = categories[cat];
    const total = stats.passed + stats.failed + stats.skipped;
    const rate = total > 0 ? ((stats.passed / total) * 100).toFixed(1) : 0;
    console.log(`${cat.toUpperCase()}:`);
    console.log(`  ✅ ${stats.passed} | ❌ ${stats.failed} | ⚠️  ${stats.skipped} | ${rate}%`);
  });

  // Save report to file
  const report = {
    timestamp: new Date().toISOString(),
    duration: duration,
    total: total,
    passed: results.passed.length,
    failed: results.failed.length,
    skipped: results.skipped.length,
    successRate: successRate,
    categories: categories,
    details: {
      passed: results.passed.map(t => ({ id: t.id, name: t.name, file: t.file })),
      failed: results.failed.map(t => ({ id: t.id, name: t.name, file: t.file })),
      skipped: results.skipped.map(t => ({ id: t.id, name: t.name, file: t.file }))
    }
  };

  const reportPath = path.join(process.cwd(), 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 Rapport sauvegardé: ${reportPath}`);

  console.log('\n══════════════════════════════════════════════════════════════\n');

  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
