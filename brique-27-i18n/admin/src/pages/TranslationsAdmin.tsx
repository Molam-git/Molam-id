// admin/src/pages/TranslationsAdmin.tsx
// Admin dashboard for managing translations

import { useEffect, useState } from 'react';
import axios from 'axios';
import type { Language, Translation, MissingTranslation } from '../../../api/src/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'X-User-ID': 'admin' } // In production, use JWT
});

export default function TranslationsAdmin() {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'coverage' | 'missing'>('list');

  // Filters
  const [filterLang, setFilterLang] = useState<Language | ''>('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchKey, setSearchKey] = useState('');

  // Form
  const [formData, setFormData] = useState({
    key: '',
    lang: 'en' as Language,
    value: '',
    category: '',
    platform: 'all',
    notes: ''
  });

  // Coverage & Missing
  const [coverage, setCoverage] = useState<Array<any>>([]);
  const [missing, setMissing] = useState<MissingTranslation[]>([]);
  const [missingLang, setMissingLang] = useState<Language>('fr');

  useEffect(() => {
    if (activeTab === 'list') {
      fetchTranslations();
    } else if (activeTab === 'coverage') {
      fetchCoverage();
    } else if (activeTab === 'missing') {
      fetchMissing();
    }
  }, [activeTab, filterLang, filterCategory, searchKey]);

  const fetchTranslations = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterLang) params.lang = filterLang;
      if (filterCategory) params.category = filterCategory;
      if (searchKey) params.key = searchKey;

      const res = await api.get('/api/admin/i18n/translations', { params });
      setTranslations(res.data.translations || []);
    } catch (error) {
      console.error('Failed to fetch translations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCoverage = async () => {
    try {
      const res = await api.get('/api/admin/i18n/coverage');
      setCoverage(res.data.coverage || []);
    } catch (error) {
      console.error('Failed to fetch coverage:', error);
    }
  };

  const fetchMissing = async () => {
    try {
      const res = await api.get(`/api/admin/i18n/missing/${missingLang}`);
      setMissing(res.data.missing || []);
    } catch (error) {
      console.error('Failed to fetch missing:', error);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/api/admin/i18n/translations', formData);
      alert('Translation created!');
      setFormData({
        key: '',
        lang: 'en',
        value: '',
        category: '',
        platform: 'all',
        notes: ''
      });
      if (activeTab === 'list') fetchTranslations();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create translation');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this translation?')) return;

    try {
      await api.delete(`/api/admin/i18n/translations/${id}`);
      fetchTranslations();
    } catch (error) {
      alert('Failed to delete translation');
    }
  };

  const handleRefreshCache = async () => {
    if (!confirm('Refresh translation cache for all languages?')) return;

    try {
      const res = await api.post('/api/admin/i18n/cache/refresh');
      alert(`Cache refreshed! ${JSON.stringify(res.data.results)}`);
    } catch (error) {
      alert('Failed to refresh cache');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Translation Management</h1>
              <p className="text-gray-600 mt-1">Molam i18n Admin Dashboard</p>
            </div>
            <button
              onClick={handleRefreshCache}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Refresh Cache
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'list', label: 'Translations' },
              { key: 'add', label: 'Add New' },
              { key: 'coverage', label: 'Coverage' },
              { key: 'missing', label: 'Missing' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.key
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* LIST TAB */}
        {activeTab === 'list' && (
          <div>
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4">
              <select
                value={filterLang}
                onChange={(e) => setFilterLang(e.target.value as Language | '')}
                className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Languages</option>
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="wo">Wolof</option>
                <option value="ar">العربية</option>
                <option value="es">Español</option>
              </select>

              <input
                type="text"
                placeholder="Filter by category..."
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />

              <input
                type="text"
                placeholder="Search by key..."
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Translations Table */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                <p className="mt-2 text-gray-600">Loading...</p>
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Key
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lang
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {translations.map((trans) => (
                      <tr key={trans.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {trans.key}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {trans.lang}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                          {trans.value}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {trans.category || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDelete(trans.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {translations.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No translations found
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ADD TAB */}
        {activeTab === 'add' && (
          <div className="bg-white p-8 rounded-lg shadow max-w-2xl">
            <h2 className="text-2xl font-bold mb-6">Add New Translation</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key *</label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="e.g., home.welcome"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language *</label>
                <select
                  value={formData.lang}
                  onChange={(e) => setFormData({ ...formData, lang: e.target.value as Language })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="wo">Wolof</option>
                  <option value="ar">العربية</option>
                  <option value="es">Español</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
                <textarea
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="Translation text"
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., auth, home, settings"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">All Platforms</option>
                  <option value="web">Web Only</option>
                  <option value="mobile">Mobile Only</option>
                  <option value="desktop">Desktop Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Context for translators"
                  rows={2}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <button
                onClick={handleCreate}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Create Translation
              </button>
            </div>
          </div>
        )}

        {/* COVERAGE TAB */}
        {activeTab === 'coverage' && (
          <div className="bg-white p-8 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-6">Translation Coverage</h2>

            <div className="space-y-4">
              {coverage.map((item) => (
                <div key={item.lang} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-semibold">{item.lang.toUpperCase()}</span>
                    <span className="text-2xl font-bold text-green-600">{item.coverage_percent}%</span>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>{item.total} translations</span>
                      <span>{item.missing} missing</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-green-600 h-3 rounded-full transition-all"
                        style={{ width: `${item.coverage_percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MISSING TAB */}
        {activeTab === 'missing' && (
          <div>
            <div className="bg-white p-4 rounded-lg shadow mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Show missing translations for:
              </label>
              <div className="flex gap-4">
                <select
                  value={missingLang}
                  onChange={(e) => {
                    setMissingLang(e.target.value as Language);
                    fetchMissing();
                  }}
                  className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="wo">Wolof</option>
                  <option value="ar">العربية</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Missing Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      English Reference
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {missing.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {item.key}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.reference_value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {missing.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No missing translations! 🎉
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
