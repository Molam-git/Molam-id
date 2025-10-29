// frontend/src/stores/rbac-store.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api';

export const useRbacStore = defineStore('rbac', () => {
    const userRoles = ref<Array<any>>([]);
    const availableRoles = ref<Array<any>>([]);

    const hasRole = computed(() => (module: string, role: string) => {
        return userRoles.value.some(r =>
            r.module === module && r.role === role
        );
    });

    const hasPermission = computed(() => (module: string, action: string) => {
        // Logique de vérification des permissions
        return userRoles.value.some(role =>
            role.module === module && role.permissions?.[action]
        );
    });

    const accessibleModules = computed(() => {
        const modules = new Set(userRoles.value.map(role => role.module));
        return Array.from(modules);
    });

    async function loadUserRoles(userId: string) {
        try {
            const response = await api.get(`/rbac/${userId}`);
            userRoles.value = response.data.roles;
        } catch (error) {
            console.error('Erreur chargement rôles:', error);
        }
    }

    async function assignRole(userId: string, roleData: any) {
        await api.post(`/rbac/${userId}/assign`, roleData);
        await loadUserRoles(userId);
    }

    async function revokeRole(userId: string, module: string, role: string) {
        await api.post(`/rbac/${userId}/revoke`, { module, role });
        await loadUserRoles(userId);
    }

    async function loadAvailableRoles() {
        const response = await api.get('/rbac/modules/available');
        availableRoles.value = response.data;
    }

    return {
        userRoles,
        availableRoles,
        hasRole,
        hasPermission,
        accessibleModules,
        loadUserRoles,
        assignRole,
        revokeRole,
        loadAvailableRoles
    };
});