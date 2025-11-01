import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3 className="footer-title">Molam ID</h3>
            <p className="footer-description">
              Votre identité numérique sécurisée pour l'écosystème Molam
            </p>
          </div>

          <div className="footer-section">
            <h4 className="footer-subtitle">Légal</h4>
            <nav className="footer-links" aria-label="Liens légaux">
              <Link to="/legal/cgu" className="footer-link">
                Conditions Générales d'Utilisation
              </Link>
              <Link to="/legal/privacy" className="footer-link">
                Politique de Confidentialité
              </Link>
              <Link to="/legal/legal" className="footer-link">
                Mentions Légales
              </Link>
              <Link to="/legal/cookies" className="footer-link">
                Politique des Cookies
              </Link>
              <Link to="/legal/data_protection" className="footer-link">
                Protection des Données
              </Link>
            </nav>
          </div>

          <div className="footer-section">
            <h4 className="footer-subtitle">Support</h4>
            <div className="footer-links">
              <a href="https://support.molam.sn" className="footer-link" target="_blank" rel="noopener noreferrer">
                Centre d'aide
              </a>
              <a href="mailto:support@molam.sn" className="footer-link">
                Nous contacter
              </a>
            </div>
          </div>

          <div className="footer-section">
            <h4 className="footer-subtitle">Langues</h4>
            <div className="footer-languages">
              <button className="footer-language active" aria-label="Français">🇫🇷 FR</button>
              <button className="footer-language" aria-label="English">🇬🇧 EN</button>
              <button className="footer-language" aria-label="Wolof">WO</button>
              <button className="footer-language" aria-label="العربية">🇸🇦 AR</button>
              <button className="footer-language" aria-label="Español">🇪🇸 ES</button>
              <button className="footer-language" aria-label="Português">🇵🇹 PT</button>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            &copy; {currentYear} Molam. Tous droits réservés.
          </p>
          <div className="footer-badges">
            <span className="footer-badge" title="Conforme RGPD">🔒 RGPD</span>
            <span className="footer-badge" title="Sécurisé">🛡️ Sécurisé</span>
            <span className="footer-badge" title="Made in Senegal">🇸🇳 Made in SN</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
