<template>
  <div class="dynamic-dashboard">
    <div class="dashboard-header">
      <h1>Tableau de Bord Molam</h1>
      <p>Bienvenue, {{ user.name }} - Rôles: {{ userRoleSummary }}</p>
    </div>

    <!-- Navigation par modules accessibles -->
    <div class="modules-navigation">
      <button 
        v-for="module in accessibleModules" 
        :key="module"
        @click="activeModule = module"
        :class="['module-tab', { active: activeModule === module }]"
      >
        {{ getModuleLabel(module) }}
      </button>
    </div>

    <!-- Contenu dynamique par module -->
    <div class="module-content">
      <!-- Module Pay -->
      <div v-if="activeModule === 'pay' && hasPayAccess" class="pay-dashboard">
        <div class="module-header">
          <h2>Molam Pay</h2>
          <div class="user-roles-badge">
            <span v-for="role in userPayRoles" :key="role" class="role-badge">
              {{ role }}
            </span>
          </div>
        </div>

        <!-- Client Pay -->
        <div v-if="hasRole('pay', 'client')" class="client-section">
          <h3>Services Client</h3>
          <div class="action-grid">
            <button class="action-card" @click="navigateTo('/pay/transfer')">
              💸 Transférer
            </button>
            <button class="action-card" @click="navigateTo('/pay/payment')">
              🛍️ Payer
            </button>
            <button class="action-card" @click="navigateTo('/pay/wallet')">
              👛 Mon Portefeuille
            </button>
          </div>
        </div>

        <!-- Agent Pay -->
        <div v-if="hasRole('pay', 'agent')" class="agent-section">
          <h3>Espace Agent</h3>
          <div class="action-grid">
            <button class="action-card" @click="navigateTo('/pay/agent/cashin')">
              📥 Cash-In
            </button>
            <button class="action-card" @click="navigateTo('/pay/agent/cashout')">
              📤 Cash-Out
            </button>
            <button class="action-card" @click="navigateTo('/pay/agent/reporting')">
              📊 Reporting
            </button>
          </div>
        </div>

        <!-- Admin Pay -->
        <div v-if="hasRole('pay', 'admin')" class="admin-section">
          <h3>Administration Pay</h3>
          <div class="action-grid">
            <button class="action-card" @click="navigateTo('/pay/admin/agents')">
              👥 Gérer Agents
            </button>
            <button class="action-card" @click="navigateTo('/pay/admin/fees')">
              💰 Configurer Frais
            </button>
            <button class="action-card" @click="navigateTo('/pay/admin/transactions')">
              🔄 Transactions
            </button>
          </div>
        </div>
      </div>

      <!-- Module Eats -->
      <div v-if="activeModule === 'eats' && hasEatsAccess" class="eats-dashboard">
        <div class="module-header">
          <h2>Molam Eats</h2>
        </div>
        
        <div v-if="hasRole('eats', 'client')" class="client-section">
          <h3>Commandez votre repas</h3>
          <div class="action-grid">
            <button class="action-card" @click="navigateTo('/eats/restaurants')">
              🍕 Restaurants
            </button>
            <button class="action-card" @click="navigateTo('/eats/orders')">
              📋 Mes Commandes
            </button>
          </div>
        </div>
      </div>

      <!-- Module Shop -->
      <div v-if="activeModule === 'shop' && hasShopAccess" class="shop-dashboard">
        <div class="module-header">
          <h2>Molam Shop</h2>
        </div>
        <!-- Contenu Shop... -->
      </div>

      <!-- Aucun accès -->
      <div v-if="!hasAnyAccess" class="no-access">
        <h3>⚠️ Aucun module accessible</h3>
        <p>Vous n'avez actuellement accès à aucun module Molam.</p>
        <p>Contactez l'administration pour obtenir les permissions nécessaires.</p>
      </div>
    </div>

    <!-- Panneau d'information des rôles -->
    <div class="roles-panel">
      <h4>Vos Rôles et Permissions</h4>
      <div v-for="role in userRoles" :key="role.id" class="role-item">
        <strong>{{ role.module.toUpperCase() }}:</strong> {{ role.role }}
        <span class="access-scope">({{ role.access_scope }})</span>
        <span class="trust-level">Niveau {{ role.trusted_level }}/5</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useRbacStore } from '@/stores/rbac-store';
import { useAuthStore } from '@/stores/auth-store';

const router = useRouter();
const rbacStore = useRbacStore();
const authStore = useAuthStore();

const activeModule = ref('pay');

const user = computed(() => authStore.user);
const userRoles = computed(() => rbacStore.userRoles);
const accessibleModules = computed(() => rbacStore.accessibleModules);

const userRoleSummary = computed(() => {
  return userRoles.value.map(role => `${role.module}:${role.role}`).join(', ');
});

const hasPayAccess = computed(() => accessibleModules.value.includes('pay'));
const hasEatsAccess = computed(() => accessibleModules.value.includes('eats'));
const hasShopAccess = computed(() => accessibleModules.value.includes('shop'));
const hasAnyAccess = computed(() => accessibleModules.value.length > 0);

const userPayRoles = computed(() => {
  return userRoles.value
    .filter(role => role.module === 'pay')
    .map(role => role.role);
});

function hasRole(module: string, role: string): boolean {
  return rbacStore.hasRole(module, role);
}

function getModuleLabel(module: string): string {
  const labels: { [key: string]: string } = {
    pay: 'Pay',
    eats: 'Eats',
    shop: 'Shop',
    talk: 'Talk',
    ads: 'Ads',
    free: 'Free',
    id: 'ID'
  };
  return labels[module] || module;
}

function navigateTo(path: string) {
  router.push(path);
}

onMounted(async () => {
  if (authStore.user) {
    await rbacStore.loadUserRoles(authStore.user.id);
    
    // Définir le module actif par défaut (premier module accessible)
    if (accessibleModules.value.length > 0) {
      activeModule.value = accessibleModules.value[0];
    }
  }
});
</script>

<style scoped>
.dynamic-dashboard {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  text-align: center;
  margin-bottom: 30px;
}

.modules-navigation {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  flex-wrap: wrap;
  justify-content: center;
}

.module-tab {
  padding: 12px 24px;
  border: 2px solid #007bff;
  background: white;
  color: #007bff;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.3s;
}

.module-tab:hover {
  background: #007bff;
  color: white;
}

.module-tab.active {
  background: #007bff;
  color: white;
}

.module-content {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  min-height: 400px;
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #dee2e6;
}

.user-roles-badge {
  display: flex;
  gap: 5px;
}

.role-badge {
  background: #6c757d;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8em;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin: 20px 0;
}

.action-card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 1.1em;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  border-color: #007bff;
}

.roles-panel {
  margin-top: 30px;
  padding: 20px;
  background: #e9ecef;
  border-radius: 8px;
}

.role-item {
  padding: 8px 0;
  border-bottom: 1px solid #ced4da;
}

.access-scope {
  color: #6c757d;
  font-style: italic;
  margin-left: 8px;
}

.trust-level {
  background: #17a2b8;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-left: 8px;
}

.no-access {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
}
</style>