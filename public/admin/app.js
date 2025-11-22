// Configuration
const API_BASE_URL = window.location.origin;
let currentToken = localStorage.getItem('adminToken');
let currentUser = JSON.parse(localStorage.getItem('adminUser') || 'null');
let currentPage = 1;
let currentSearch = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (currentToken && currentUser) {
        showDashboard();
        loadDashboardData();
    } else {
        showLogin();
    }

    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);

    // Create user form
    document.getElementById('createUserForm')?.addEventListener('submit', handleCreateUser);

    // Edit user form
    document.getElementById('editUserForm')?.addEventListener('submit', handleEditUser);

    // Upload photo form
    document.getElementById('uploadPhotoForm')?.addEventListener('submit', handleUploadPhoto);

    // Create role form
    document.getElementById('createRoleForm')?.addEventListener('submit', handleCreateRole);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });

    // User search
    document.getElementById('userSearch')?.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        debounce(() => loadUsers(), 300)();
    });
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
        const response = await fetch(`${API_BASE_URL}/api/id/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentToken = data.access_token;
            currentUser = data.user;
            localStorage.setItem('adminToken', currentToken);
            localStorage.setItem('adminUser', JSON.stringify(currentUser));

            showDashboard();
            loadDashboardData();
        } else {
            showError('loginError', data.message || 'Identifiants invalides');
        }
    } catch (error) {
        showError('loginError', 'Erreur de connexion au serveur');
        console.error('Login error:', error);
    }
}

function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    currentToken = null;
    currentUser = null;
    showLogin();
}

// Screen Management
function showLogin() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('dashboardScreen').classList.remove('active');
}

function showDashboard() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('dashboardScreen').classList.add('active');

    if (currentUser) {
        document.getElementById('adminName').textContent = currentUser.email?.split('@')[0] || 'Admin';
        document.getElementById('adminEmail').textContent = currentUser.email || '';
    }
}

// Navigation
function navigateTo(page) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`${page}Page`)?.classList.add('active');

    // Update title
    const titles = {
        dashboard: 'Dashboard',
        users: 'Gestion des utilisateurs',
        roles: 'Gestion des rôles',
        audit: 'Journal d\'audit'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;

    // Load page data
    switch (page) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsers();
            break;
        case 'roles':
            loadRoles();
            break;
        case 'audit':
            loadAudit();
            break;
    }
}

// API Calls
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
        ...options.headers
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        logout();
        throw new Error('Session expirée');
    }

    return response;
}

// Dashboard Data
async function loadDashboardData() {
    try {
        // Load stats
        const statsResponse = await apiCall('/api/admin/users/stats');
        const stats = await statsResponse.json();

        document.getElementById('totalUsers').textContent = stats.total_users || '0';
        document.getElementById('activeUsers').textContent = stats.active_users || '0';
        document.getElementById('pendingUsers').textContent = stats.pending_users || '0';
        document.getElementById('newUsers').textContent = stats.new_this_week || '0';

        // Load recent users
        const usersResponse = await apiCall('/api/admin/users?limit=5');
        const usersData = await usersResponse.json();
        renderRecentUsers(usersData.users || []);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Erreur lors du chargement des données', 'error');
    }
}

function renderRecentUsers(users) {
    const container = document.getElementById('recentUsers');
    if (!users.length) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-light);">Aucun utilisateur</p>';
        return;
    }

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Utilisateur</th>
                    <th>Email</th>
                    <th>Rôles</th>
                    <th>Statut</th>
                    <th>Créé le</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => {
                    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
                    const displayName = fullName || user.email?.split('@')[0] || 'Utilisateur';
                    return `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${user.profile_photo_url ?
                                    `<img src="${user.profile_photo_url}" alt="Photo" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">` :
                                    `<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--gradient-primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${displayName[0].toUpperCase()}</div>`
                                }
                                <span>${displayName}</span>
                            </div>
                        </td>
                        <td>${user.email}</td>
                        <td>${(user.role_profile || []).join(', ')}</td>
                        <td>${getStatusBadge(user.status)}</td>
                        <td>${formatDate(user.created_at)}</td>
                    </tr>
                `}).join('')}
            </tbody>
        </table>
    `;
}

// Users Management
async function loadUsers(page = 1) {
    currentPage = page;
    try {
        const params = new URLSearchParams({
            page: currentPage,
            limit: 10,
            ...(currentSearch && { search: currentSearch })
        });

        const response = await apiCall(`/api/admin/users?${params}`);
        const data = await response.json();

        renderUsersTable(data.users || []);
        renderPagination(data.pagination);
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Erreur lors du chargement des utilisateurs', 'error');
    }
}

function renderUsersTable(users) {
    const container = document.getElementById('usersTable');
    if (!users.length) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 40px;">Aucun utilisateur trouvé</p>';
        return;
    }

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Photo</th>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Téléphone</th>
                    <th>Rôles</th>
                    <th>Statut</th>
                    <th>KYC</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>
                            ${user.profile_photo_url ?
                                `<img src="${user.profile_photo_url}" alt="Photo" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` :
                                `<div style="width: 40px; height: 40px; border-radius: 50%; background: var(--gradient-primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${(user.first_name || user.email || '?')[0].toUpperCase()}</div>`
                            }
                        </td>
                        <td>
                            ${user.first_name || user.last_name ?
                                `${user.first_name || ''} ${user.last_name || ''}`.trim() :
                                '-'
                            }
                            <br><small style="color: var(--text-light);"><code>${user.molam_id}</code></small>
                        </td>
                        <td>${user.email || '-'}</td>
                        <td>${user.phone_e164 || '-'}</td>
                        <td>${(user.role_profile || []).join(', ')}</td>
                        <td>${getStatusBadge(user.status)}</td>
                        <td>${getKycBadge(user.kyc_status)}</td>
                        <td>
                            <button class="btn btn-sm btn-secondary" onclick="viewUser('${user.id}')">
                                👁️
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="showEditUserModal('${user.id}')">
                                ✏️
                            </button>
                            <button class="btn btn-sm btn-info" onclick="showUploadPhotoModal('${user.id}')">
                                📷
                            </button>
                            ${user.status === 'active' ?
                                `<button class="btn btn-sm btn-warning" onclick="suspendUser('${user.id}')">⏸️</button>` :
                                `<button class="btn btn-sm btn-success" onclick="activateUser('${user.id}')">▶️</button>`
                            }
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderPagination(pagination) {
    if (!pagination) return;

    const container = document.getElementById('usersPagination');
    const { page, totalPages } = pagination;

    container.innerHTML = `
        <button ${page === 1 ? 'disabled' : ''} onclick="loadUsers(${page - 1})">
            ← Précédent
        </button>
        <span class="page-info">Page ${page} sur ${totalPages}</span>
        <button ${page === totalPages ? 'disabled' : ''} onclick="loadUsers(${page + 1})">
            Suivant →
        </button>
    `;
}

async function handleCreateUser(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const userData = {
        email: formData.get('email'),
        firstName: formData.get('firstName') || undefined,
        lastName: formData.get('lastName') || undefined,
        phone: formData.get('phone') || undefined,
        password: formData.get('password'),
        roles: [formData.get('role')],
        status: formData.get('status'),
        kycStatus: 'none'
    };

    console.log('Creating user with data:', { ...userData, password: '***' });

    try {
        const response = await apiCall('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        console.log('Create user response status:', response.status, 'ok:', response.ok);

        if (response.ok) {
            const data = await response.json();
            console.log('User created successfully:', data);
            showToast('Utilisateur créé avec succès', 'success');
            closeModal('createUserModal');
            e.target.reset();

            // Recharger la liste (sans bloquer sur les erreurs de chargement)
            loadUsers(1).catch(err => {
                console.error('Error reloading users after creation:', err);
            });
        } else {
            const error = await response.json();
            console.error('Server error response:', error);
            showToast(error.message || error.error || 'Erreur lors de la création', 'error');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showToast('Erreur lors de la création de l\'utilisateur', 'error');
    }
}

async function suspendUser(userId) {
    if (!confirm('Voulez-vous vraiment suspendre cet utilisateur ?')) return;

    try {
        const response = await apiCall(`/api/admin/users/${userId}/suspend`, {
            method: 'POST',
            body: JSON.stringify({ reason: 'Suspendu par admin' })
        });

        if (response.ok) {
            showToast('Utilisateur suspendu', 'success');
            loadUsers(currentPage);
        }
    } catch (error) {
        console.error('Error suspending user:', error);
        showToast('Erreur lors de la suspension', 'error');
    }
}

async function activateUser(userId) {
    try {
        const response = await apiCall(`/api/admin/users/${userId}/activate`, {
            method: 'POST'
        });

        if (response.ok) {
            showToast('Utilisateur activé', 'success');
            loadUsers(currentPage);
        }
    } catch (error) {
        console.error('Error activating user:', error);
        showToast('Erreur lors de l\'activation', 'error');
    }
}

async function viewUser(userId) {
    try {
        const response = await apiCall(`/api/admin/users/${userId}`);
        const user = await response.json();

        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Non renseigné';
        const details = `Détails de l'utilisateur:\n\nNom: ${fullName}\nMolam ID: ${user.molam_id}\nEmail: ${user.email}\nTéléphone: ${user.phone_e164 || '-'}\nStatut: ${user.status}\nKYC: ${user.kyc_status}\nCréé: ${formatDate(user.created_at)}`;

        alert(details);
    } catch (error) {
        console.error('Error viewing user:', error);
    }
}

function showUploadPhotoModal(userId) {
    document.getElementById('uploadPhotoUserId').value = userId;
    document.getElementById('uploadPhotoForm').reset();
    document.getElementById('photoPreview').innerHTML = '';
    openModal('uploadPhotoModal');

    // Add event listener for file preview
    const fileInput = document.querySelector('#uploadPhotoForm input[type="file"]');
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('photoPreview').innerHTML = `
                    <img src="${e.target.result}" alt="Aperçu" style="max-width: 200px; max-height: 200px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                `;
            };
            reader.readAsDataURL(file);
        }
    });
}

async function handleUploadPhoto(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userId = formData.get('userId');
    const photo = formData.get('photo');

    if (!photo || !userId) {
        showToast('Veuillez sélectionner une photo', 'error');
        return;
    }

    try {
        const uploadFormData = new FormData();
        uploadFormData.append('photo', photo);

        const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/upload-photo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            },
            body: uploadFormData
        });

        if (response.ok) {
            showToast('Photo téléchargée avec succès', 'success');
            closeModal('uploadPhotoModal');
            loadUsers(currentPage);
        } else {
            const error = await response.json();
            showToast(error.error || 'Erreur lors du téléchargement', 'error');
        }
    } catch (error) {
        console.error('Error uploading photo:', error);
        showToast('Erreur lors du téléchargement de la photo', 'error');
    }
}

async function showEditUserModal(userId) {
    try {
        // Récupérer les données de l'utilisateur
        const response = await apiCall(`/api/admin/users/${userId}`);
        const user = await response.json();

        // Pré-remplir le formulaire
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUserEmail').value = user.email || '';
        document.getElementById('editUserFirstName').value = user.first_name || '';
        document.getElementById('editUserLastName').value = user.last_name || '';
        document.getElementById('editUserPhone').value = user.phone_e164 || '';
        document.getElementById('editUserStatus').value = user.status || 'active';

        // Ouvrir le modal
        openModal('editUserModal');
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Erreur lors du chargement des données', 'error');
    }
}

async function handleEditUser(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const userId = formData.get('userId');
    const updateData = {
        email: formData.get('email'),
        firstName: formData.get('firstName') || null,
        lastName: formData.get('lastName') || null,
        phone: formData.get('phone') || null,
        status: formData.get('status')
    };

    try {
        const response = await apiCall(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            showToast('Utilisateur modifié avec succès', 'success');
            closeModal('editUserModal');
            loadUsers(currentPage);
        } else {
            const error = await response.json();
            showToast(error.message || 'Erreur lors de la modification', 'error');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showToast('Erreur lors de la modification de l\'utilisateur', 'error');
    }
}

// Roles Management
async function loadRoles() {
    try {
        const response = await apiCall('/api/admin/roles');
        const data = await response.json();
        renderRolesGrid(data.roles || []);
    } catch (error) {
        console.error('Error loading roles:', error);
        showToast('Erreur lors du chargement des rôles', 'error');
    }
}

function renderRolesGrid(roles) {
    const container = document.getElementById('rolesGrid');
    if (!roles.length) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-light);">Aucun rôle</p>';
        return;
    }

    container.innerHTML = roles.map(role => `
        <div class="role-card">
            <div class="role-card-header">
                <div>
                    <div class="role-title">${role.display_name || role.role_name}</div>
                    <span class="role-module">${role.module}</span>
                </div>
            </div>
            <div class="role-description">
                ${role.description || 'Aucune description'}
            </div>
            <div class="role-actions">
                ${!role.is_system_role ? `
                    <button class="btn btn-sm btn-danger" onclick="deleteRole('${role.role_name}')">
                        🗑️ Supprimer
                    </button>
                ` : `
                    <span class="badge badge-info">Système</span>
                `}
            </div>
        </div>
    `).join('');
}

async function handleCreateRole(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const roleData = {
        role_name: formData.get('role_name'),
        display_name: formData.get('display_name'),
        module: formData.get('module'),
        description: formData.get('description')
    };

    try {
        const response = await apiCall('/api/admin/roles', {
            method: 'POST',
            body: JSON.stringify(roleData)
        });

        if (response.ok) {
            showToast('Rôle créé avec succès', 'success');
            closeModal('createRoleModal');
            e.target.reset();
            loadRoles();
        } else {
            const error = await response.json();
            showToast(error.message || 'Erreur lors de la création', 'error');
        }
    } catch (error) {
        console.error('Error creating role:', error);
        showToast('Erreur lors de la création du rôle', 'error');
    }
}

async function deleteRole(roleName) {
    if (!confirm(`Voulez-vous vraiment supprimer le rôle "${roleName}" ?`)) return;

    try {
        const response = await apiCall(`/api/admin/roles/${roleName}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Rôle supprimé', 'success');
            loadRoles();
        } else {
            const error = await response.json();
            showToast(error.message || 'Erreur lors de la suppression', 'error');
        }
    } catch (error) {
        console.error('Error deleting role:', error);
        showToast('Erreur lors de la suppression du rôle', 'error');
    }
}

// Audit
async function loadAudit() {
    // Placeholder - implement if you have audit endpoint
    document.getElementById('auditTable').innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 40px;">Journal d\'audit bientôt disponible</p>';
}

// Modal Management
function showCreateUserModal() {
    document.getElementById('createUserModal').classList.add('active');
}

function showCreateRoleModal() {
    document.getElementById('createRoleModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Helpers
function getStatusBadge(status) {
    const badges = {
        active: 'success',
        pending: 'warning',
        suspended: 'danger',
        closed: 'danger'
    };
    const labels = {
        active: 'Actif',
        pending: 'En attente',
        suspended: 'Suspendu',
        closed: 'Fermé'
    };
    return `<span class="badge badge-${badges[status] || 'info'}">${labels[status] || status}</span>`;
}

function getKycBadge(kycStatus) {
    const badges = {
        verified: 'success',
        initiated: 'warning',
        rejected: 'danger',
        none: 'info'
    };
    const labels = {
        verified: 'Vérifié',
        initiated: 'En cours',
        rejected: 'Rejeté',
        none: 'Non vérifié'
    };
    return `<span class="badge badge-${badges[kycStatus] || 'info'}">${labels[kycStatus] || kycStatus}</span>`;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function refreshData() {
    const activePage = document.querySelector('.nav-item.active')?.dataset.page;
    if (activePage) {
        navigateTo(activePage);
    }
}

// Close modal on click outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});
