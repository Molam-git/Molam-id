// web/src/components/ProfileCard.tsx

import { useState } from 'react';

interface ProfileCardProps {
  user: any;
  onRefresh: () => void;
}

export default function ProfileCard({ user, onRefresh }: ProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="rounded-2xl shadow-sm p-6 bg-white border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Display Name */}
        <div>
          <div className="text-sm text-gray-500 mb-1">Display Name</div>
          <div className="font-medium text-gray-900">{user.display_name}</div>
        </div>

        {/* Email */}
        <div>
          <div className="text-sm text-gray-500 mb-1">Email</div>
          <div className="font-medium text-gray-900">{user.email || '—'}</div>
        </div>

        {/* Phone */}
        <div>
          <div className="text-sm text-gray-500 mb-1">Phone</div>
          <div className="font-medium text-gray-900">{user.phone || '—'}</div>
        </div>

        {/* User Type */}
        <div>
          <div className="text-sm text-gray-500 mb-1">Account Type</div>
          <div className="font-medium text-gray-900">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              user.user_type === 'internal' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
            }`}>
              {user.user_type === 'internal' ? 'Internal (Employee)' : 'External (Customer)'}
            </span>
          </div>
        </div>

        {/* KYC Level */}
        <div>
          <div className="text-sm text-gray-500 mb-1">KYC Level</div>
          <div className="font-medium text-gray-900">
            Level {user.kyc_level}
            <span className="ml-2 text-xs text-gray-500">
              {user.kyc_level === 0 && '(Not verified)'}
              {user.kyc_level === 1 && '(Basic)'}
              {user.kyc_level === 2 && '(Intermediate)'}
              {user.kyc_level === 3 && '(Advanced)'}
            </span>
          </div>
        </div>

        {/* Member Since */}
        <div>
          <div className="text-sm text-gray-500 mb-1">Member Since</div>
          <div className="font-medium text-gray-900">
            {new Date(user.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}
