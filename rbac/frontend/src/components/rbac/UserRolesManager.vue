<template>
  <div class="user-roles-manager">
    <div class="header">
      <h3>Gestion des Rôles - {{ userName }}</h3>
      <button @click="showAssignModal = true" class="btn-primary">
        Assigner un rôle
      </button>
    </div>

    <div class="roles-list">
      <table class="roles-table">
        <thead>
          <tr>
            <th>Module</th>
            <th>Rôle</th>
            <th>Portée</th>
            <th>Niveau Confiance</th>
            <th>Expiration</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="role in userRoles" :key="`${role.module}-${role.role}`">
            <td>{{ role.module }}</td>
            <td>{{ role.role }}</td>
            <td>{{ role.access_scope }}</td>
            <td>{{ role.trusted_level }}/5</td>
            <td>{{ role.expires_at ? formatDate(role.expires_at) : 'Permanent' }}</td>
            <td>
              <button 
                @click="revokeRole(role.module, role.role)"
                class="btn-danger"
              >
                Révoquer
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <RoleAssignmentModal 
      v-if="showAssignModal"
      :user-id="userId"
      :available-roles="availableRoles"
      @close="showAssignModal = false"
      @assigned="onRoleAssigned"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRbacStore } from '@/stores/rbac-store';
import RoleAssignmentModal from './RoleAssignmentModal.vue';

const props = defineProps<{
  userId: string;
  userName: string;
}>();

const rbacStore = useRbacStore();
const showAssignModal = ref(false);

const userRoles = computed(() => rbacStore.userRoles);
const availableRoles = computed(() => rbacStore.availableRoles);

onMounted(async () => {
  await rbacStore.loadUserRoles(props.userId);
  await rbacStore.loadAvailableRoles();
});

async function revokeRole(module: string, role: string) {
  if (confirm(`Révoquer le rôle ${role} pour le module ${module} ?`)) {
    await rbacStore.revokeRole(props.userId, module, role);
  }
}

function onRoleAssigned() {
  showAssignModal.value = false;
  rbacStore.loadUserRoles(props.userId);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR');
}
</script>