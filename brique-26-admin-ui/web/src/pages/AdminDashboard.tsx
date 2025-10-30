// web/src/pages/AdminDashboard.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export default function AdminDashboard() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const api = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
  });

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = filter ? { department: filter } : {};
      const [empRes, auditRes, statsRes] = await Promise.all([
        api.get('/api/id/admin/employees', { params }),
        api.get('/api/id/admin/audit', { params: { ...params, limit: 50 } }),
        api.get('/api/id/admin/stats')
      ]);
      setEmployees(empRes.data.employees || []);
      setAudit(auditRes.data.audit || []);
      setStats(statsRes.data.stats || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDepartmentColor = (dept: string) => {
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
    return colors[dept] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading admin console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Molam Admin Console</h1>
          <p className="mt-2 text-gray-600">Internal employee management by subsidiary</p>
        </div>

        {/* Department Filter */}
        <div className="mb-6">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            <option value="pay">Molam Pay</option>
            <option value="eats">Molam Eats</option>
            <option value="talk">Molam Talk</option>
            <option value="ads">Molam Ads</option>
            <option value="shop">Molam Shop</option>
            <option value="free">Molam Free</option>
            <option value="id">Molam ID</option>
            <option value="global">Global/Corporate</option>
          </select>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <div key={stat.department} className="bg-white rounded-xl shadow-sm p-4">
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-2 ${getDepartmentColor(stat.department)}`}>
                {stat.department.toUpperCase()}
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.active_employees}</div>
              <div className="text-sm text-gray-500">Active Employees</div>
            </div>
          ))}
        </div>

        {/* Employees Table */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Employees</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr className="text-left">
                  <th className="pb-3 font-medium text-gray-700">Employee ID</th>
                  <th className="pb-3 font-medium text-gray-700">Name</th>
                  <th className="pb-3 font-medium text-gray-700">Department</th>
                  <th className="pb-3 font-medium text-gray-700">Position</th>
                  <th className="pb-3 font-medium text-gray-700">Roles</th>
                  <th className="pb-3 font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-gray-100">
                    <td className="py-3 text-gray-900">{emp.employee_id}</td>
                    <td className="py-3">
                      <div className="font-medium text-gray-900">{emp.display_name}</div>
                      <div className="text-xs text-gray-500">{emp.email}</div>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getDepartmentColor(emp.department)}`}>
                        {emp.department.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-gray-700">{emp.position}</td>
                    <td className="py-3 text-gray-600">
                      {emp.roles?.length > 0 ? emp.roles.map((r: any) => r.role_name).join(', ') : '—'}
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Audit Logs</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {audit.map((log) => (
              <div key={log.id} className="border-b border-gray-100 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{log.action}</span>
                    {log.employee_id && (
                      <span className="ml-2 text-sm text-gray-500">by {log.employee_id}</span>
                    )}
                    {log.department && (
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getDepartmentColor(log.department)}`}>
                        {log.department}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
                {log.context && Object.keys(log.context).length > 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    {JSON.stringify(log.context)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
