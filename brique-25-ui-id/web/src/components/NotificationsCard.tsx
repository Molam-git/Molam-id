// web/src/components/NotificationsCard.tsx

import { useState } from 'react';

interface NotificationsCardProps {
  notifications: any[];
  api: any;
  onRefresh: () => void;
}

export default function NotificationsCard({ notifications, api, onRefresh }: NotificationsCardProps) {
  const [marking, setMarking] = useState<string | null>(null);

  const handleMarkRead = async (notificationId: string) => {
    try {
      setMarking(notificationId);
      await api.post(`/api/id/notifications/${notificationId}/read`);
      onRefresh();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    } finally {
      setMarking(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      info: 'bg-blue-50 border-blue-200',
      warning: 'bg-yellow-50 border-yellow-200',
      critical: 'bg-red-50 border-red-200'
    };
    return colors[severity] || 'bg-gray-50 border-gray-200';
  };

  const getSeverityIcon = (severity: string) => {
    const icons: Record<string, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨'
    };
    return icons[severity] || 'ℹ️';
  };

  const getCategoryBadge = (category: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      security: { color: 'bg-red-100 text-red-800', label: 'Security' },
      product: { color: 'bg-blue-100 text-blue-800', label: 'Product' },
      legal: { color: 'bg-gray-100 text-gray-800', label: 'Legal' },
      system: { color: 'bg-purple-100 text-purple-800', label: 'System' }
    };
    const badge = badges[category] || { color: 'bg-gray-100 text-gray-800', label: category };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="rounded-2xl shadow-sm p-6 bg-white border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
        <span className="text-sm text-gray-500">
          {notifications.filter(n => !n.is_read).length} unread
        </span>
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`border rounded-xl p-4 transition-all ${
              notification.is_read ? 'opacity-60' : ''
            } ${getSeverityColor(notification.severity)}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{getSeverityIcon(notification.severity)}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getCategoryBadge(notification.category)}
                  <span className="text-xs text-gray-500">
                    {new Date(notification.created_at).toLocaleString()}
                  </span>
                </div>
                <h3 className="font-medium text-gray-900 mb-1">{notification.title}</h3>
                <p className="text-sm text-gray-700">{notification.body}</p>
                {notification.action_url && notification.action_label && (
                  <a
                    href={notification.action_url}
                    className="inline-block mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {notification.action_label} →
                  </a>
                )}
              </div>
              {!notification.is_read && (
                <button
                  onClick={() => handleMarkRead(notification.id)}
                  disabled={marking === notification.id}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {marking === notification.id ? '...' : 'Mark read'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
