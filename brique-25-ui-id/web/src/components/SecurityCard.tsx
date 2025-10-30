// web/src/components/SecurityCard.tsx

import { useState } from 'react';

interface SecurityCardProps {
  sessions: any[];
  devices: any[];
  api: any;
  onRefresh: () => void;
}

export default function SecurityCard({ sessions, devices, api, onRefresh }: SecurityCardProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'devices'>('sessions');
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session?')) return;

    try {
      setRevoking(sessionId);
      await api.post(`/api/id/security/sessions/${sessionId}/revoke`);
      onRefresh();
    } catch (error) {
      console.error('Error revoking session:', error);
      alert('Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke this device? All its sessions will be terminated.')) return;

    try {
      setRevoking(deviceId);
      await api.post(`/api/id/security/devices/${deviceId}/revoke`);
      onRefresh();
    } catch (error) {
      console.error('Error revoking device:', error);
      alert('Failed to revoke device');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="rounded-2xl shadow-sm p-6 bg-white border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Security</h2>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'sessions'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Active Sessions ({sessions.length})
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'devices'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Devices ({devices.length})
        </button>
      </div>

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No active sessions</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {session.device_type?.toUpperCase() || 'Unknown'}
                    </span>
                    {session.device_name && (
                      <span className="text-sm text-gray-500">— {session.device_name}</span>
                    )}
                    {session.is_active && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {session.ip_address && <span>{session.ip_address}</span>}
                    {session.geo_country && <span> • {session.geo_country}</span>}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    Started {new Date(session.created_at).toLocaleString()}
                    {session.last_seen && ` • Last seen ${new Date(session.last_seen).toLocaleString()}`}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeSession(session.id)}
                  disabled={revoking === session.id}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {revoking === session.id ? 'Revoking...' : 'Revoke'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Devices Tab */}
      {activeTab === 'devices' && (
        <div className="space-y-3">
          {devices.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No registered devices</p>
          ) : (
            devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {device.device_name || device.device_type?.toUpperCase() || 'Unknown Device'}
                    </span>
                    {device.is_trusted && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Trusted
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {device.os_version && <span>OS: {device.os_version}</span>}
                    {device.app_version && <span> • App: {device.app_version}</span>}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    Registered {new Date(device.registered_at).toLocaleString()}
                    {device.last_seen_at && ` • Last seen ${new Date(device.last_seen_at).toLocaleString()}`}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeDevice(device.device_id)}
                  disabled={revoking === device.device_id}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {revoking === device.device_id ? 'Revoking...' : 'Revoke'}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
