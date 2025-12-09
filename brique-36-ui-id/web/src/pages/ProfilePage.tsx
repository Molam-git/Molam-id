import { useState } from 'react';
import { useMolamId } from '../contexts/AuthContext';
import { useTTS } from '../contexts/TTSContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { User, Mail, Phone, Calendar, Volume2, VolumeX, Moon, Sun, Globe, Edit2, X } from 'lucide-react';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, loading, updateProfile, uploadProfilePicture } = useMolamId();
  const { enabled: ttsEnabled, toggleTTS } = useTTS();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);

  console.log('📄 ProfilePage - User data:', user);
  console.log('📄 ProfilePage - Loading:', loading);

  const openEditModal = () => {
    setFormData({
      firstName: user?.profile?.given_name || '',
      lastName: user?.profile?.family_name || '',
      email: user?.email || '',
      phone: user?.phone_number || ''
    });
    setError('');
    setSuccess('');
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await updateProfile(formData);
      setSuccess('Profil mis à jour avec succès!');
      setTimeout(() => {
        setIsEditing(false);
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('La taille du fichier ne doit pas dépasser 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image');
      return;
    }

    setUploadingPicture(true);
    setError('');

    try {
      await uploadProfilePicture(file);
      setSuccess('Photo de profil mise à jour!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'upload');
    } finally {
      setUploadingPicture(false);
    }
  };

  const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--spacing-xl) 0' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          {t('profile.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: 'var(--spacing-xl) 0' }}>
      <div className="profile-page">
        <div className="profile-header">
          <div className="profile-avatar-container">
            {user?.profile_picture_url ? (
              <img
                src={`${API_URL}/api/id${user.profile_picture_url}`}
                alt="Profile"
                className="profile-avatar-large profile-avatar-image"
              />
            ) : (
              <div className="profile-avatar-large">
                {user?.profile?.given_name?.[0] || user?.phone_number?.[0] || 'U'}
              </div>
            )}
            <input
              type="file"
              id="profile-picture-input"
              accept="image/*"
              onChange={handlePictureUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => document.getElementById('profile-picture-input')?.click()}
              className="avatar-edit-btn"
              disabled={uploadingPicture}
              title="Changer la photo de profil"
            >
              <Edit2 size={16} />
            </button>
          </div>
          <h1 className="profile-name">
            {user?.profile?.given_name && user?.profile?.family_name
              ? `${user.profile.given_name} ${user.profile.family_name}`
              : user?.phone_number || t('common.user')}
          </h1>
          <p className="profile-subtitle">{t('profile.title')}</p>
          {uploadingPicture && (
            <p style={{ color: 'var(--color-primary)', fontSize: '0.875rem', marginTop: 'var(--spacing-xs)' }}>
              Upload en cours...
            </p>
          )}
          {error && !isEditing && (
            <div style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', background: '#fee', color: '#c00', borderRadius: '4px', fontSize: '0.875rem', maxWidth: '400px', margin: 'var(--spacing-sm) auto 0' }}>
              {error}
            </div>
          )}
          {success && !isEditing && (
            <div style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', background: '#efe', color: '#060', borderRadius: '4px', fontSize: '0.875rem', maxWidth: '400px', margin: 'var(--spacing-sm) auto 0' }}>
              {success}
            </div>
          )}
        </div>

        <div className="profile-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>{t('profile.section.personal')}</h2>
            <button onClick={openEditModal} className="btn btn-secondary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Edit2 size={18} />
              Modifier
            </button>
          </div>
          <div className="card">
            <div className="info-row">
              <div className="info-label">
                <User size={20} />
                <span>{t('profile.full_name')}</span>
              </div>
              <div className="info-value">
                {user?.profile?.given_name && user?.profile?.family_name
                  ? `${user.profile.given_name} ${user.profile.family_name}`
                  : t('profile.not_provided')}
              </div>
            </div>

            <div className="info-row">
              <div className="info-label">
                <Phone size={20} />
                <span>{t('profile.phone')}</span>
              </div>
              <div className="info-value">
                {user?.phone_number || t('profile.not_provided')}
              </div>
            </div>

            <div className="info-row">
              <div className="info-label">
                <Mail size={20} />
                <span>{t('profile.email')}</span>
              </div>
              <div className="info-value">
                {user?.email || t('profile.not_provided')}
              </div>
            </div>

            <div className="info-row">
              <div className="info-label">
                <Calendar size={20} />
                <span>{t('profile.member_since')}</span>
              </div>
              <div className="info-value">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : t('profile.not_available')}
              </div>
            </div>
          </div>
        </div>

        <div className="profile-section">
          <h2 className="section-title">{t('profile.section.accessibility')}</h2>
          <div className="card">
            <div className="preference-row">
              <div className="preference-info">
                <div className="preference-label">
                  {ttsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                  <span>{t('profile.tts')}</span>
                </div>
                <p className="preference-description">
                  {t('profile.tts.description')}
                </p>
              </div>
              <button
                onClick={toggleTTS}
                className={`toggle-btn ${ttsEnabled ? 'active' : ''}`}
                aria-label={ttsEnabled ? 'Désactiver la synthèse vocale' : 'Activer la synthèse vocale'}
              >
                <div className="toggle-slider" />
              </button>
            </div>

            <div className="preference-row">
              <div className="preference-info">
                <div className="preference-label">
                  {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                  <span>{t('profile.theme')}</span>
                </div>
                <p className="preference-description">
                  {t('profile.theme.description')}
                </p>
              </div>
              <button
                onClick={toggleTheme}
                className={`toggle-btn ${theme === 'dark' ? 'active' : ''}`}
                aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
              >
                <div className="toggle-slider" />
              </button>
            </div>

            <div className="preference-row">
              <div className="preference-info">
                <div className="preference-label">
                  <Globe size={20} />
                  <span>{t('profile.language')}</span>
                </div>
                <p className="preference-description">
                  {t('profile.language.description')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setLanguage('fr')}
                  className={`btn ${language === 'fr' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  FR
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`btn ${language === 'en' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('wo')}
                  className={`btn ${language === 'wo' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  WO
                </button>
                <button
                  onClick={() => setLanguage('ar')}
                  className={`btn ${language === 'ar' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  AR
                </button>
                <button
                  onClick={() => setLanguage('es')}
                  className={`btn ${language === 'es' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  ES
                </button>
                <button
                  onClick={() => setLanguage('pt')}
                  className={`btn ${language === 'pt' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  PT
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-section">
          <h2 className="section-title">{t('profile.section.services')}</h2>
          <div className="card">
            <p className="services-description">
              {t('profile.services.description')}
            </p>
            <div className="services-grid">
              <button className="service-badge" onClick={() => window.location.href = "http://app.molam.tech/api/connect"}>
              💰 Molam Pay
              </button>
              <div className="service-badge">🍔 Molam Eats</div>
              <div className="service-badge">🛒 Molam Shop</div>
              <div className="service-badge">💬 Molam Talk</div>
              <div className="service-badge">📢 Molam Ads</div>
              <div className="service-badge">🆓 Molam Free</div>
            </div>
          </div>
        </div>

        {/* Edit Profile Modal */}
        {isEditing && (
          <div className="modal-overlay" onClick={() => setIsEditing(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Modifier le profil</h2>
                <button onClick={() => setIsEditing(false)} className="modal-close">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="firstName">Prénom</label>
                  <input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">Nom</label>
                  <input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Numéro de téléphone</label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                {error && (
                  <div className="error-message" style={{ marginBottom: 'var(--spacing-md)', padding: 'var(--spacing-sm)', background: '#fee', color: '#c00', borderRadius: '4px' }}>
                    {error}
                  </div>
                )}

                {success && (
                  <div className="success-message" style={{ marginBottom: 'var(--spacing-md)', padding: 'var(--spacing-sm)', background: '#efe', color: '#060', borderRadius: '4px' }}>
                    {success}
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Mise à jour...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
