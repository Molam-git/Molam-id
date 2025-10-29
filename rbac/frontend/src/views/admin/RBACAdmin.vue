<template>
  <div class="rbac-admin">
    <div class="admin-header">
      <h1>Administration RBAC</h1>
      <p>Gestion des rôles et permissions des utilisateurs</p>
    </div>

    <div class="search-section">
      <div class="search-box">
        <input 
          v-model="searchQuery" 
          placeholder="Rechercher un utilisateur..."
          @input="searchUsers"
        >
        <button @click="searchUsers" class="btn-primary">
          🔍 Rechercher
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      Chargement...
    </div>

    <div v-else-if="searchResults.length > 0" class="users-list">
      <div 
        v-for="user in searchResults" 
        :key="user.id"
        class="user-card"
      >
        <div class="user-info">
          <h4>{{ user.name }} ({{ user.email }})</h4>
          <p>ID: {{ user.id }}</p>
          <p>Rôles actuels: {{ getUserRoleSummary(user.id) }}</p>
        </div>
        
        <div class="user-actions">
          <button 
            @click="openUserRoles(user)"
            class="btn-primary"
          >
            Gérer les rôles
          </button>
        </div>
      </div>
    </div>

    <div v-else class="no-results">
      Aucun utilisateur trouvé. Utilisez la recherche pour trouver des utilisateurs.
    </div>

    <!-- Modal de gestion des rôles utilisateur -->
    <div v-if="selectedUser" class="user-roles-modal">
      <div class="modal-overlay" @click.self="closeUserModal">
        <div class="modal-content large">
          <UserRolesManager 
            :user-id="selectedUser.id"
            :user-name="selectedUser.name"
          />
          <button @click="closeUserModal" class="btn-secondary">
            Fermer
          </button>
        </div>
      </div>
    </div>

    <!-- Section statistiques -->
    <div class="stats-section">
      <h3>Statistiques RBAC</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <h4>Utilisateurs avec rôles</h4>
          <span class="stat-number">{{ stats.usersWithRoles }}</span>
        </div>
        <div class="stat-card">
          <h4>Rôles assignés</h4>
          <span class="stat-number">{{ stats.totalAssignments }}</span>
        </div>
        <div class="stat-card">
          <h4>Modules actifs</h4>
          <span class="stat-number">{{ stats.activeModules }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRbacStore } from '@/stores/rbac-store';
import UserRolesManager from '@/components/rbac/UserRolesManager.vue';

const rbacStore = useRbacStore();
const searchQuery = ref('');
const searchResults = ref<Array<any>>([]);
const selectedUser = ref<any>(null);
const loading = ref(false);

const stats = ref({
  usersWithRoles: 0,
  totalAssignments: 0,
  activeModules: 6 // Pay, Eats, Shop, Talk, Ads, Free
});

// Recherche d'utilisateurs (simulée - à connecter avec l'API réelle)
async function searchUsers() {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }

  loading.value = true;
  try {
    // Simulation d'appel API
    const response = await fetch(`/api/id/users/search?q=${encodeURIComponent(searchQuery.value)}`);
    const data = await response.json();
    searchResults.value = data.users || [];
  } catch (error) {
    console.error('Erreur recherche:', error);
    searchResults.value = [];
  } finally {
    loading.value = false;
  }
}

function openUserRoles(user: any) {
  selectedUser.value = user;
}

function closeUserModal() {
  selectedUser.value = null;
  // Recharger les données si nécessaire
  searchUsers();
}

function getUserRoleSummary(userId: string): string {
  const userRoles = rbacStore.userRoles.filter(role => role.user_id === userId);
  if (userRoles.length === 0) return 'Aucun rôle';
  
  const summary = userRoles.map(role => 
    `${role.module}:${role.role}`
  ).join(', ');
  
  return summary.length > 50 ? summary.substring(0, 50) + '...' : summary;
}

onMounted(() => {
  // Charger les statistiques
  loadStats();
});

async function loadStats() {
  // Simulation de chargement des stats
  try {
    const response = await fetch('/api/id/rbac/stats');
    const data = await response.json();
    stats.value = data;
  } catch (error) {
    console.error('Erreur chargement stats:', error);
  }
}
</script>

<style scoped>
.rbac-admin {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.admin-header {
  margin-bottom: 30px;
  text-align: center;
}

.search-section {
  margin-bottom: 30px;
}

.search-box {
  display: flex;
  gap: 10px;
  max-width: 500px;
  margin: 0 auto;
}

.search-box input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.user-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f9f9f9;
}

.user-info h4 {
  margin: 0 0 5px 0;
  color: #333;
}

.user-info p {
  margin: 2px 0;
  color: #666;
  font-size: 0.9em;
}

.stats-section {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.stat-card {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  text-align: center;
  border-left: 4px solid #007bff;
}

.stat-card h4 {
  margin: 0 0 10px 0;
  font-size: 0.9em;
  color: #666;
}

.stat-number {
  font-size: 2em;
  font-weight: bold;
  color: #007bff;
}

.loading, .no-results {
  text-align: center;
  padding: 40px;
  color: #666;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content.large {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 90%;
  max-width: 1000px;
  max-height: 90vh;
  overflow-y: auto;
}
</style>