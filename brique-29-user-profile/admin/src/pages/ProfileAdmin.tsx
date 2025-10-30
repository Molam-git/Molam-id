// brique-29-user-profile/admin/src/pages/ProfileAdmin.tsx
// Admin dashboard for profile management (badges, media moderation, statistics)

import React, { useState, useEffect } from 'react';
import { MolamProfile, Badge, formatFileSize } from '../../../sdk/molam-profile';

// =====================================================
// TYPES
// =====================================================

interface BadgeStatistic {
  badge_id: string;
  badge_key: string;
  badge_name: string;
  subsidiary_id?: string;
  subsidiary_name?: string;
  total_assignments: number;
  active_assignments: number;
  max_count?: number;
  utilization_pct?: number;
}

interface MediaAssetForModeration {
  asset_id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  media_type: string;
  processing_status: string;
  moderation_status: string;
  created_at: string;
  signed_url?: string;
}

interface ProfileStatistics {
  total_profiles: number;
  profiles_with_avatar: number;
  profiles_with_banner: number;
  profiles_with_bio: number;
  total_badges_assigned: number;
  total_activities: number;
  media_storage_bytes: number;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function ProfileAdmin() {
  const [activeTab, setActiveTab] = useState<'statistics' | 'badges' | 'moderation'>('statistics');
  const [sdk] = useState(() => new MolamProfile({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    authToken: localStorage.getItem('auth_token') || '',
    onAuthError: () => {
      alert('Authentication required. Please log in.');
      window.location.href = '/login';
    }
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Profile Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage user profiles, badges, and media content
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('statistics')}
              className={`${
                activeTab === 'statistics'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Statistics
            </button>
            <button
              onClick={() => setActiveTab('badges')}
              className={`${
                activeTab === 'badges'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Badge Management
            </button>
            <button
              onClick={() => setActiveTab('moderation')}
              className={`${
                activeTab === 'moderation'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Media Moderation
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'statistics' && <StatisticsTab sdk={sdk} />}
        {activeTab === 'badges' && <BadgeManagementTab sdk={sdk} />}
        {activeTab === 'moderation' && <ModerationTab sdk={sdk} />}
      </div>
    </div>
  );
}

// =====================================================
// STATISTICS TAB
// =====================================================

function StatisticsTab({ sdk }: { sdk: MolamProfile }) {
  const [statistics, setStatistics] = useState<ProfileStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const stats = await sdk.getProfileStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load statistics:', error);
      alert('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        <span className="ml-3 text-gray-600">Loading statistics...</span>
      </div>
    );
  }

  if (!statistics) {
    return <div className="text-center py-12 text-gray-500">No statistics available</div>;
  }

  const stats = [
    {
      label: 'Total Profiles',
      value: statistics.total_profiles.toLocaleString(),
      icon: '👤',
      color: 'bg-blue-50 text-blue-600'
    },
    {
      label: 'Profiles with Avatar',
      value: `${statistics.profiles_with_avatar.toLocaleString()} (${Math.round((statistics.profiles_with_avatar / statistics.total_profiles) * 100)}%)`,
      icon: '📷',
      color: 'bg-purple-50 text-purple-600'
    },
    {
      label: 'Profiles with Banner',
      value: `${statistics.profiles_with_banner.toLocaleString()} (${Math.round((statistics.profiles_with_banner / statistics.total_profiles) * 100)}%)`,
      icon: '🖼️',
      color: 'bg-pink-50 text-pink-600'
    },
    {
      label: 'Profiles with Bio',
      value: `${statistics.profiles_with_bio.toLocaleString()} (${Math.round((statistics.profiles_with_bio / statistics.total_profiles) * 100)}%)`,
      icon: '📝',
      color: 'bg-yellow-50 text-yellow-600'
    },
    {
      label: 'Total Badges Assigned',
      value: statistics.total_badges_assigned.toLocaleString(),
      icon: '🏅',
      color: 'bg-emerald-50 text-emerald-600'
    },
    {
      label: 'Total Activities',
      value: statistics.total_activities.toLocaleString(),
      icon: '📊',
      color: 'bg-indigo-50 text-indigo-600'
    },
    {
      label: 'Media Storage',
      value: formatFileSize(statistics.media_storage_bytes),
      icon: '💾',
      color: 'bg-orange-50 text-orange-600'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`flex-shrink-0 rounded-lg p-3 ${stat.color}`}>
                <span className="text-2xl">{stat.icon}</span>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// BADGE MANAGEMENT TAB
// =====================================================

function BadgeManagementTab({ sdk }: { sdk: MolamProfile }) {
  const [statistics, setStatistics] = useState<BadgeStatistic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignForm, setShowAssignForm] = useState(false);

  useEffect(() => {
    loadBadgeStatistics();
  }, []);

  const loadBadgeStatistics = async () => {
    try {
      setLoading(true);
      const stats = await sdk.getBadgeStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load badge statistics:', error);
      alert('Failed to load badge statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        <span className="ml-3 text-gray-600">Loading badges...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Badge Statistics</h2>
        <button
          onClick={() => setShowAssignForm(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Assign Badge
        </button>
      </div>

      {/* Badge Statistics Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Badge
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subsidiary
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Utilization
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {statistics.map((stat) => (
              <tr key={stat.badge_id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm font-medium text-gray-900">{stat.badge_name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {stat.subsidiary_name || 'Global'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {stat.active_assignments.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {stat.total_assignments.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {stat.max_count && stat.utilization_pct !== null ? (
                    <div className="flex items-center">
                      <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full"
                          style={{ width: `${Math.min(stat.utilization_pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{stat.utilization_pct.toFixed(1)}%</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Unlimited</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Badge Modal */}
      {showAssignForm && (
        <AssignBadgeModal
          sdk={sdk}
          onClose={() => {
            setShowAssignForm(false);
            loadBadgeStatistics();
          }}
        />
      )}
    </div>
  );
}

// =====================================================
// ASSIGN BADGE MODAL
// =====================================================

function AssignBadgeModal({ sdk, onClose }: { sdk: MolamProfile; onClose: () => void }) {
  const [userId, setUserId] = useState('');
  const [badgeId, setBadgeId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId || !badgeId) {
      alert('User ID and Badge ID are required');
      return;
    }

    try {
      setSubmitting(true);
      await sdk.assignBadge(userId, badgeId, reason || undefined);
      alert('Badge assigned successfully');
      onClose();
    } catch (error: any) {
      console.error('Failed to assign badge:', error);
      alert(`Failed to assign badge: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Assign Badge</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter user ID"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Badge ID
            </label>
            <input
              type="text"
              value={badgeId}
              onChange={(e) => setBadgeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter badge ID"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              rows={3}
              placeholder="Enter reason for assignment"
            />
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Assigning...' : 'Assign Badge'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =====================================================
// MEDIA MODERATION TAB
// =====================================================

function ModerationTab({ sdk }: { sdk: MolamProfile }) {
  const [assets, setAssets] = useState<MediaAssetForModeration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real implementation, this would fetch pending media for moderation
    // For now, we'll show a placeholder
    setLoading(false);
  }, []);

  const handleModerate = async (assetId: string, status: 'approved' | 'rejected', reason?: string) => {
    try {
      await sdk.moderateMedia(assetId, status, reason);
      alert(`Media ${status} successfully`);
      // Refresh list
    } catch (error: any) {
      console.error('Failed to moderate media:', error);
      alert(`Failed to moderate media: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        <span className="ml-3 text-gray-600">Loading media...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Media Moderation</h3>

        {assets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No media pending moderation</p>
            <p className="text-sm text-gray-400 mt-2">
              All uploaded media has been reviewed
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assets.map((asset) => (
              <div key={asset.asset_id} className="border border-gray-200 rounded-lg p-4">
                <img
                  src={asset.signed_url}
                  alt={asset.file_name}
                  className="w-full h-48 object-cover rounded-lg mb-3"
                />
                <p className="text-sm font-medium text-gray-900 truncate">{asset.file_name}</p>
                <p className="text-xs text-gray-500 mb-3">{formatFileSize(asset.file_size)}</p>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleModerate(asset.asset_id, 'approved')}
                    className="flex-1 px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleModerate(asset.asset_id, 'rejected', 'Inappropriate content')}
                    className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
