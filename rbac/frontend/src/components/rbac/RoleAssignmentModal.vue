<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h4>Assigner un nouveau rôle</h4>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <form @submit.prevent="assignRole" class="role-form">
        <div class="form-group">
          <label>Module:</label>
          <select v-model="form.module" required @change="onModuleChange">
            <option value="">Sélectionner un module</option>
            <option 
              v-for="module in availableModules" 
              :key="module"
              :value="module"
            >
              {{ module.toUpperCase() }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Rôle:</label>
          <select v-model="form.role" required>
            <option value="">Sélectionner un rôle</option>
            <option 
              v-for="role in availableRolesForModule" 
              :key="role.role"
              :value="role.role"
            >
              {{ role.role }} - {{ role.permissions }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Portée d'accès:</label>
          <select v-model="form.access_scope">
            <option value="read">Lecture seule</option>
            <option value="write">Lecture/Écriture</option>
            <option value="admin">Administration</option>
          </select>
        </div>

        <div class="form-group">
          <label>Niveau de confiance:</label>
          <input 
            type="range" 
            v-model="form.trusted_level" 
            min="0" 
            max="5" 
            class="trust-slider"
          >
          <span class="trust-value">{{ form.trusted_level }}/5</span>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" v-model="form.hasExpiration">
            Définir une expiration
          </label>
          <input 
            v-if="form.hasExpiration"
            type="datetime-local" 
            v-model="form.expires_at"
            class="expiration-input"
          >
        </div>

        <div class="form-actions">
          <button type="button" @click="$emit('close')" class="btn-secondary">
            Annuler
          </button>
          <button type="submit" class="btn-primary" :disabled="loading">
            {{ loading ? 'Assignation...' : 'Assigner le rôle' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineEmits, defineProps } from 'vue';
import { useRbacStore } from '@/stores/rbac-store';

const props = defineProps<{
  userId: string;
  availableRoles: Array<{
    module: string;
    role: string;
    permissions: any;
  }>;
}>();

const emit = defineEmits<{
  close: [];
  assigned: [];
}>();

const rbacStore = useRbacStore();
const loading = ref(false);

const form = ref({
  module: '',
  role: '',
  access_scope: 'read',
  trusted_level: 0,
  hasExpiration: false,
  expires_at: ''
});

const availableModules = computed(() => {
  const modules = new Set(props.availableRoles.map(r => r.module));
  return Array.from(modules);
});

const availableRolesForModule = computed(() => {
  if (!form.value.module) return [];
  return props.availableRoles.filter(r => r.module === form.value.module);
});

function onModuleChange() {
  form.value.role = ''; // Reset role when module changes
}

async function assignRole() {
  if (!form.value.module || !form.value.role) {
    alert('Veuillez sélectionner un module et un rôle');
    return;
  }

  loading.value = true;

  try {
    const roleData = {
      module: form.value.module,
      role: form.value.role,
      access_scope: form.value.access_scope,
      trusted_level: form.value.trusted_level,
      expires_at: form.value.hasExpiration && form.value.expires_at 
        ? new Date(form.value.expires_at).toISOString()
        : null
    };

    await rbacStore.assignRole(props.userId, roleData);
    emit('assigned');
  } catch (error) {
    console.error('Erreur assignation rôle:', error);
    alert('Erreur lors de l\'assignation du rôle');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
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

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 500px;
  max-width: 90vw;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group select, 
.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.trust-slider {
  width: 80%;
  margin-right: 10px;
}

.trust-value {
  font-weight: bold;
}

.expiration-input {
  margin-top: 5px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.btn-primary, .btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>