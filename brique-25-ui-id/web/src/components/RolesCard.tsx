// web/src/components/RolesCard.tsx

import { useEffect, useState } from 'react';

interface RolesCardProps {
  api: any;
}

export default function RolesCard({ api }: RolesCardProps) {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await api.get('/api/id/roles');
        setRoles(response.data.roles || []);
      } catch (error) {
        console.error('Error fetching roles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, []);

  const getModuleColor = (module: string) => {
    const colors: Record<string, string> = {
      pay: 'bg-green-100 text-green-800',
      eats: 'bg-orange-100 text-orange-800',
      talk: 'bg-blue-100 text-blue-800',
      shop: 'bg-purple-100 text-purple-800',
      ads: 'bg-yellow-100 text-yellow-800',
      free: 'bg-pink-100 text-pink-800',
      id: 'bg-gray-100 text-gray-800',
      global: 'bg-indigo-100 text-indigo-800'
    };
    return colors[module] || 'bg-gray-100 text-gray-800';
  };

  const getTrustLevelBadge = (level: number) => {
    if (level >= 80) return <span className="text-xs text-red-600 font-medium">High Trust</span>;
    if (level >= 50) return <span className="text-xs text-yellow-600 font-medium">Medium Trust</span>;
    return <span className="text-xs text-green-600 font-medium">Low Trust</span>;
  };

  return (
    <div className="rounded-2xl shadow-sm p-6 bg-white border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Module Roles</h2>
        <span className="text-sm text-gray-500">{roles.length} role{roles.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : roles.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No roles assigned</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role, index) => (
            <div
              key={`${role.module}-${role.role}-${index}`}
              className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getModuleColor(role.module)}`}>
                  {role.module?.toUpperCase() || 'UNKNOWN'}
                </span>
                {getTrustLevelBadge(role.trusted_level)}
              </div>
              <div className="font-medium text-gray-900 mb-1">{role.role}</div>
              <div className="text-xs text-gray-500">
                Scope: {role.scope || 'default'}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Granted {new Date(role.granted_at).toLocaleDateString()}
                {role.expires_at && (
                  <span className="block">Expires {new Date(role.expires_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-xl">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900">About Roles</p>
            <p className="mt-1 text-sm text-blue-700">
              Roles control your access to different Molam services. Contact your administrator to request new roles or modify existing ones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
