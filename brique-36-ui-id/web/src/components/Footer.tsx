import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { t } = useLanguage();

  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3 className="footer-title">Molam ID</h3>
            <p className="footer-description">
              {t('footer.description')}
            </p>
          </div>

          <div className="footer-section">
            <h4 className="footer-subtitle">{t('footer.legal')}</h4>
            <nav className="footer-links" aria-label={t('footer.legal.aria')}>
              <Link to="/legal/cgu" className="footer-link">
                {t('footer.legal.terms')}
              </Link>
              <Link to="/legal/privacy" className="footer-link">
                {t('footer.legal.privacy')}
              </Link>
              <Link to="/legal/legal" className="footer-link">
                {t('footer.legal.legal')}
              </Link>
              <Link to="/legal/cookies" className="footer-link">
                {t('footer.legal.cookies')}
              </Link>
              <Link to="/legal/data_protection" className="footer-link">
                {t('footer.legal.data')}
              </Link>
            </nav>
          </div>

          <div className="footer-section">
            <h4 className="footer-subtitle">{t('footer.support')}</h4>
            <div className="footer-links">
              <a href="https://support.molam.sn" className="footer-link" target="_blank" rel="noopener noreferrer">
                {t('footer.support.help')}
              </a>
              <a href="mailto:support@molam.sn" className="footer-link">
                {t('footer.support.contact')}
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            &copy; {currentYear} Molam. {t('footer.rights')}
          </p>
          <div className="footer-badges">
            <span className="footer-badge" title={t('footer.badge.gdpr')}>🔒 RGPD</span>
            <span className="footer-badge" title={t('footer.badge.secure')}>🛡️ {t('footer.badge.secure')}</span>
            <span className="footer-badge" title={t('footer.badge.senegal')}>US Made in USA</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
