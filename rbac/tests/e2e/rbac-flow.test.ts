// @ts-nocheck
// Ce fichier est en JavaScript pur - aucune vérification TypeScript

const { test, expect } = require('@playwright/test');

test.describe('RBAC Flow E2E', function () {
  test('Admin can assign roles to user', async function ({ page }) {
    // Connexion en tant qu'admin
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@molam.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Attendre la redirection après login
    await page.waitForURL('**/dashboard');

    // Navigation vers l'admin RBAC
    await page.click('text=Administration RBAC');

    // Recherche d'un utilisateur
    await page.fill('[placeholder="Rechercher un utilisateur..."]', 'client@molam.com');
    await page.click('text=Rechercher');

    // Attendre les résultats
    await page.waitForSelector('text=Gérer les rôles', { timeout: 5000 });

    // Gestion des rôles
    await page.click('text=Gérer les rôles');

    // Assignation d'un nouveau rôle
    await page.click('text=Assigner un rôle');
    await page.selectOption('select', { value: 'pay' });
    await page.selectOption('select:nth-of-type(2)', { value: 'agent' });
    await page.click('text=Assigner le rôle');

    // Vérification de l'assignation
    await expect(page.locator('text=Rôle assigné avec succès')).toBeVisible({ timeout: 5000 });
  });

  test('User sees only authorized modules', async function ({ page }) {
    // Connexion en tant que client simple
    await page.goto('/login');
    await page.fill('[name="email"]', 'client@molam.com');
    await page.fill('[name="password"]', 'client123');
    await page.click('button[type="submit"]');

    // Attendre la redirection
    await page.waitForURL('**/dashboard');

    // Vérification des modules accessibles
    await expect(page.locator('text=Molam Pay')).toBeVisible();
    await expect(page.locator('text=Molam Eats')).toBeVisible();
    await expect(page.locator('text=Administration')).not.toBeVisible();

    // Vérification des actions disponibles
    await expect(page.locator('text=Transférer')).toBeVisible();
    await expect(page.locator('text=Gérer Agents')).not.toBeVisible();
  });

  test('Agent can access agent features', async function ({ page }) {
    // Connexion en tant qu'agent
    await page.goto('/login');
    await page.fill('[name="email"]', 'agent@molam.com');
    await page.fill('[name="password"]', 'agent123');
    await page.click('button[type="submit"]');

    // Attendre la redirection
    await page.waitForURL('**/dashboard');

    // Vérification des fonctionnalités agent
    await expect(page.locator('text=Espace Agent')).toBeVisible();
    await expect(page.locator('text=Cash-In')).toBeVisible();
    await expect(page.locator('text=Cash-Out')).toBeVisible();
    await expect(page.locator('text=Reporting')).toBeVisible();
  });
});