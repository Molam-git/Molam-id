import { useMolamId } from '../contexts/AuthContext';
import { useTTS } from '../contexts/TTSContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { User, Mail, Phone, Calendar, Volume2, VolumeX, Moon, Sun, Globe } from 'lucide-react';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, loading } = useMolamId();
  const { enabled: ttsEnabled, toggleTTS } = useTTS();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  console.log('📄 ProfilePage - User data:', user);
  console.log('📄 ProfilePage - Loading:', loading);

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
          <div className="profile-avatar-large">
            {user?.profile?.given_name?.[0] || user?.phone_number?.[0] || 'U'}
          </div>
          <h1 className="profile-name">
            {user?.profile?.given_name && user?.profile?.family_name
              ? `${user.profile.given_name} ${user.profile.family_name}`
              : user?.phone_number || t('common.user')}
          </h1>
          <p className="profile-subtitle">{t('profile.title')}</p>
        </div>

        <div className="profile-section">
          <h2 className="section-title">{t('profile.section.personal')}</h2>
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
              <div style={{ display: 'flex', gap: '8px' }}>
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
              <div className="service-badge">💰 Molam Pay</div>
              <div className="service-badge">🍔 Molam Eats</div>
              <div className="service-badge">🛒 Molam Shop</div>
              <div className="service-badge">💬 Molam Talk</div>
              <div className="service-badge">📢 Molam Ads</div>
              <div className="service-badge">🆓 Molam Free</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
