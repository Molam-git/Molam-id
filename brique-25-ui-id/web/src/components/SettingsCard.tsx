// web/src/components/SettingsCard.tsx

import { useState } from 'react';

interface SettingsCardProps {
  settings: any;
  api: any;
  onUpdate: () => void;
}

export default function SettingsCard({ settings, api, onUpdate }: SettingsCardProps) {
  const [form, setForm] = useState({
    language_code: settings.language_code || 'fr',
    currency_code: settings.currency_code || 'XOF',
    country_code: settings.country_code || 'SN',
    time_zone: settings.time_zone || 'Africa/Dakar',
    theme: settings.theme || 'system'
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      setSuccess(false);
      await api.patch('/api/id/settings', form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onUpdate();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl shadow-sm p-6 bg-white border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Preferences</h2>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Language
          </label>
          <select
            value={form.language_code}
            onChange={(e) => setForm({ ...form, language_code: e.target.value })}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="wo">Wolof</option>
            <option value="ar">العربية</option>
          </select>
        </div>

        {/* Currency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Currency
          </label>
          <select
            value={form.currency_code}
            onChange={(e) => setForm({ ...form, currency_code: e.target.value })}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="XOF">XOF (CFA Franc)</option>
            <option value="USD">USD (US Dollar)</option>
            <option value="EUR">EUR (Euro)</option>
            <option value="GBP">GBP (British Pound)</option>
          </select>
        </div>

        {/* Country */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Country
          </label>
          <select
            value={form.country_code}
            onChange={(e) => setForm({ ...form, country_code: e.target.value })}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="SN">Senegal (SN)</option>
            <option value="CI">Côte d'Ivoire (CI)</option>
            <option value="ML">Mali (ML)</option>
            <option value="BF">Burkina Faso (BF)</option>
            <option value="BJ">Benin (BJ)</option>
            <option value="TG">Togo (TG)</option>
            <option value="NE">Niger (NE)</option>
          </select>
        </div>

        {/* Time Zone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time Zone
          </label>
          <select
            value={form.time_zone}
            onChange={(e) => setForm({ ...form, time_zone: e.target.value })}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Africa/Dakar">Africa/Dakar (GMT+0)</option>
            <option value="Africa/Abidjan">Africa/Abidjan (GMT+0)</option>
            <option value="Africa/Lagos">Africa/Lagos (GMT+1)</option>
            <option value="Europe/Paris">Europe/Paris (GMT+1)</option>
          </select>
        </div>

        {/* Theme */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Theme
          </label>
          <select
            value={form.theme}
            onChange={(e) => setForm({ ...form, theme: e.target.value })}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="system">System (Auto)</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {success && (
          <span className="text-green-600 text-sm font-medium">✓ Saved successfully</span>
        )}
      </div>
    </div>
  );
}
