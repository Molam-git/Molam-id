import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, LogOut, Settings, Shield } from 'lucide-react';
import { useMolamId } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import './Navigation.css';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, user, logout } = useMolamId();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    closeMenu();
  };

  return (
    <nav className="navbar" role="navigation" aria-label="Navigation principale">
      <div className="container">
        <div className="navbar-content">
          {/* Logo */}
          <Link to="/" className="navbar-brand" onClick={closeMenu}>
            <span className="navbar-logo">M</span>
            <span className="navbar-title">Molam ID</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="navbar-menu-desktop">
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className={`nav-link ${isActive('/profile') ? 'active' : ''}`}
                >
                  <User size={18} />
                  <span>Profil</span>
                </Link>
                <Link
                  to="/sessions"
                  className={`nav-link ${isActive('/sessions') ? 'active' : ''}`}
                >
                  <Shield size={18} />
                  <span>Sessions</span>
                </Link>
                <button onClick={toggleTheme} className="nav-link" title="Changer le thème">
                  {theme === 'light' ? '🌙' : '☀️'}
                </button>
                <button onClick={handleLogout} className="nav-link">
                  <LogOut size={18} />
                  <span>Déconnexion</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`nav-link ${isActive('/login') ? 'active' : ''}`}
                >
                  Connexion
                </Link>
                <Link
                  to="/signup"
                  className="btn btn-primary"
                >
                  Créer un compte
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            className="navbar-toggle"
            onClick={toggleMenu}
            aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="navbar-menu-mobile fade-in">
            {isAuthenticated ? (
              <>
                <div className="mobile-user-info">
                  <div className="mobile-user-avatar">
                    {user?.profile?.given_name?.[0] || user?.phone_number?.[0] || 'U'}
                  </div>
                  <div>
                    <div className="mobile-user-name">
                      {user?.profile?.given_name || user?.phone_number || 'Utilisateur'}
                    </div>
                    <div className="mobile-user-email">{user?.email || user?.phone_number}</div>
                  </div>
                </div>
                <Link
                  to="/profile"
                  className={`mobile-nav-link ${isActive('/profile') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  <User size={20} />
                  <span>Mon Profil</span>
                </Link>
                <Link
                  to="/sessions"
                  className={`mobile-nav-link ${isActive('/sessions') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  <Shield size={20} />
                  <span>Mes Sessions</span>
                </Link>
                <button
                  onClick={() => {
                    toggleTheme();
                    closeMenu();
                  }}
                  className="mobile-nav-link"
                >
                  <Settings size={20} />
                  <span>Thème: {theme === 'light' ? 'Clair' : 'Sombre'}</span>
                </button>
                <hr className="mobile-divider" />
                <button onClick={handleLogout} className="mobile-nav-link danger">
                  <LogOut size={20} />
                  <span>Déconnexion</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`mobile-nav-link ${isActive('/login') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  Connexion
                </Link>
                <Link
                  to="/signup"
                  className="mobile-nav-link primary"
                  onClick={closeMenu}
                >
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
