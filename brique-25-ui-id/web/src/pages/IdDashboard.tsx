// web/src/pages/IdDashboard.tsx
// Molam ID Management Dashboard - Apple-like UI

import { useEffect, useState } from 'react';
import axios from 'axios';
import ProfileCard from '../components/ProfileCard';
import SettingsCard from '../components/SettingsCard';
import SecurityCard from '../components/SecurityCard';
import RolesCard from '../components/RolesCard';
import NotificationsCard from '../components/NotificationsCard';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export default function IdDashboard() {
  const [me, setMe] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = axios.create({
    baseURL: API_BASE,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('access_token')}`
    }
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [meRes, sessionsRes, devicesRes, notificationsRes] = await Promise.all([
        api.get('/api/id/me'),
        api.get('/api/id/security/sessions'),
        api.get('/api/id/security/devices'),
        api.get('/api/id/notifications?limit=10')
      ]);

      setMe(meRes.data);
      setSessions(sessionsRes.data.sessions || []);
      setDevices(devicesRes.data.devices || []);
      setNotifications(notificationsRes.data.notifications || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">No profile data available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Molam ID</h1>
          <p className="mt-2 text-gray-600">Manage your identity, security, and preferences across all Molam services</p>
        </div>

        {/* Main Grid */}
        <div className="space-y-6">
          {/* Profile Card */}
          <ProfileCard user={me} onRefresh={fetchData} />

          {/* Settings Card */}
          <SettingsCard settings={me.settings} api={api} onUpdate={fetchData} />

          {/* Security Card */}
          <SecurityCard
            sessions={sessions}
            devices={devices}
            api={api}
            onRefresh={fetchData}
          />

          {/* Notifications Card */}
          {notifications.length > 0 && (
            <NotificationsCard
              notifications={notifications}
              api={api}
              onRefresh={fetchData}
            />
          )}

          {/* Roles Card */}
          <RolesCard api={api} />
        </div>
      </div>
    </div>
  );
}
