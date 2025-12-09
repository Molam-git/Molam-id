import { useEffect, useState } from 'react';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string;
  role_type: string;
  module_scope: string;
  priority: number;
  user_count?: string;
  permission_count?: string;
}

interface User {
  id: number;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  roles?: { role_id: number; role_name: string }[];
}

interface AuditLog {
  id: number;
  user_id: number;
  user_email: string;
  action: string;
  permission_code: string;
  result: 'granted' | 'denied';
  created_at: string;
  ip_address: string;
}

export default function AdminDashboard() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'audit'>('users');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUserForRoles, setSelectedUserForRoles] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    display_name: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Non authentifié');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const [rolesRes, usersRes, auditRes] = await Promise.all([
        fetch(`${API_URL}/rbac/roles`, { headers }),
        fetch(`${API_URL}/rbac/users`, { headers }),
        fetch(`${API_URL}/rbac/audit?limit=50`, { headers })
      ]);

      if (!rolesRes.ok || !usersRes.ok || !auditRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const rolesData = await rolesRes.json();
      const usersData = await usersRes.json();
      const auditData = await auditRes.json();

      setRoles(rolesData.roles || []);
      setUsers(usersData.users || []);
      setAudit(auditData.logs || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to create user');
      }

      setSuccess('Utilisateur créé avec succès');
      setShowAddUser(false);
      setFormData({ email: '', password: '', display_name: '' });
      fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/rbac/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      setSuccess('Utilisateur supprimé avec succès');
      fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/rbac/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      setSuccess('Statut utilisateur mis à jour');
      fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleAssignRole = async (userId: number, roleId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/rbac/users/${userId}/roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role_id: roleId })
      });

      if (!response.ok) {
        throw new Error('Failed to assign role');
      }

      setSuccess('Rôle assigné avec succès');
      fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleRevokeRole = async (userId: number, roleId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/rbac/users/${userId}/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to revoke role');
      }

      setSuccess('Rôle révoqué avec succès');
      fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const getRoleColor = (roleName: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-red-100 text-red-800',
      admin: 'bg-purple-100 text-purple-800',
      auditor: 'bg-blue-100 text-blue-800',
      support: 'bg-green-100 text-green-800',
      merchant: 'bg-yellow-100 text-yellow-800',
      agent: 'bg-orange-100 text-orange-800',
      client: 'bg-gray-100 text-gray-800'
    };
    return colors[roleName] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
          <p className="mt-4" style={{ color: 'var(--color-text)' }}>Chargement du dashboard admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>Dashboard Super Admin</h1>
          <p className="mt-2" style={{ color: 'var(--color-text-muted)' }}>Gestion RBAC Granular - Molam ID</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-xl">
            {success}
          </div>
        )}

        <div className="mb-6 flex space-x-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-xl font-medium transition-all ${activeTab === 'users' ? 'text-white' : ''}`}
            style={activeTab === 'users' ? { backgroundColor: 'var(--color-primary)' } : { backgroundColor: 'var(--color-card)', color: 'var(--color-text)' }}
          >
            Utilisateurs ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-6 py-2 rounded-xl font-medium transition-all ${activeTab === 'roles' ? 'text-white' : ''}`}
            style={activeTab === 'roles' ? { backgroundColor: 'var(--color-primary)' } : { backgroundColor: 'var(--color-card)', color: 'var(--color-text)' }}
          >
            Rôles ({roles.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-6 py-2 rounded-xl font-medium transition-all ${activeTab === 'audit' ? 'text-white' : ''}`}
            style={activeTab === 'audit' ? { backgroundColor: 'var(--color-primary)' } : { backgroundColor: 'var(--color-card)', color: 'var(--color-text)' }}
          >
            Audit ({audit.length})
          </button>
        </div>

        {activeTab === 'users' && (
          <div className="rounded-2xl shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--color-card)' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Utilisateurs</h2>
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className="px-4 py-2 rounded-xl text-white font-medium"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {showAddUser ? 'Annuler' : '+ Ajouter Utilisateur'}
              </button>
            </div>

            {showAddUser && (
              <form onSubmit={handleAddUser} className="mb-6 p-4 border rounded-xl" style={{ borderColor: 'var(--color-border)' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="px-4 py-2 rounded-xl border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Mot de passe"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="px-4 py-2 rounded-xl border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Nom d'affichage"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="px-4 py-2 rounded-xl border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="mt-4 px-6 py-2 rounded-xl text-white font-medium"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Créer l'utilisateur
                </button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <tr className="text-left">
                    <th className="pb-3 font-medium" style={{ color: 'var(--color-text)' }}>Email</th>
                    <th className="pb-3 font-medium" style={{ color: 'var(--color-text)' }}>Nom</th>
                    <th className="pb-3 font-medium" style={{ color: 'var(--color-text)' }}>Rôles</th>
                    <th className="pb-3 font-medium" style={{ color: 'var(--color-text)' }}>Statut</th>
                    <th className="pb-3 font-medium" style={{ color: 'var(--color-text)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="py-3" style={{ color: 'var(--color-text)' }}>{user.email}</td>
                      <td className="py-3" style={{ color: 'var(--color-text)' }}>{user.display_name}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles && user.roles.length > 0 ? (
                            user.roles.map((r) => (
                              <span key={r.role_id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(r.role_name)}`}>
                                {r.role_name}
                                <button
                                  onClick={() => handleRevokeRole(user.id, r.role_id)}
                                  className="ml-1 text-xs font-bold"
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Aucun rôle</span>
                          )}
                        </div>
                        <button
                          onClick={() => setSelectedUserForRoles(user)}
                          className="mt-1 text-xs underline"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          + Ajouter un rôle
                        </button>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {user.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                            className="px-3 py-1 rounded-xl text-xs font-medium"
                            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                          >
                            {user.is_active ? 'Désactiver' : 'Activer'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="px-3 py-1 rounded-xl text-xs font-medium bg-red-500 text-white"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedUserForRoles && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="rounded-2xl p-6 max-w-md w-full" style={{ backgroundColor: 'var(--color-card)' }}>
              <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                Ajouter un rôle à {selectedUserForRoles.display_name}
              </h3>
              <div className="space-y-2">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => {
                      handleAssignRole(selectedUserForRoles.id, role.id);
                      setSelectedUserForRoles(null);
                    }}
                    className="w-full px-4 py-2 rounded-xl text-left border hover:bg-opacity-50"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
                  >
                    <div className="font-medium" style={{ color: 'var(--color-text)' }}>{role.display_name}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{role.description}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSelectedUserForRoles(null)}
                className="mt-4 w-full px-4 py-2 rounded-xl font-medium"
                style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="rounded-2xl shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--color-card)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Rôles Système</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((role) => (
                <div key={role.id} className="border rounded-xl p-4" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(role.name)}`}>
                      {role.name.toUpperCase()}
                    </span>
                    <span className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                      {role.user_count || 0}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg mb-1" style={{ color: 'var(--color-text)' }}>{role.display_name}</h3>
                  <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>{role.description}</p>
                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span>Priorité: {role.priority}</span>
                    <span>{role.permission_count || 0} permissions</span>
                  </div>
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${role.role_type === 'external' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {role.role_type === 'external' ? 'Externe' : 'Interne'}
                    </span>
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                      {role.module_scope}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="rounded-2xl shadow-sm p-6" style={{ backgroundColor: 'var(--color-card)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Journal d'Audit</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {audit.map((log) => (
                <div key={log.id} className="border-b pb-2" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-medium" style={{ color: 'var(--color-text)' }}>{log.action}</span>
                      {log.user_email && (
                        <span className="ml-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>par {log.user_email}</span>
                      )}
                      {log.permission_code && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {log.permission_code}
                        </span>
                      )}
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${log.result === 'granted' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {log.result === 'granted' ? '✓ Accordé' : '✗ Refusé'}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(log.created_at).toLocaleString('fr-FR')}
                    </div>
                  </div>
                  {log.ip_address && (
                    <div className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      IP: {log.ip_address}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
