import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMolamId } from '../contexts/AuthContext';
import { useTTS } from '../contexts/TTSContext';
import './AuthPages.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useMolamId();
  const { speak } = useTTS();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/profile');
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(identifier, password);
      speak('Connexion réussie');
      navigate('/profile');
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur de connexion';
      setError(errorMsg);
      speak(`Erreur: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Connexion</h1>
            <p className="auth-subtitle">
              Connectez-vous à votre compte Molam ID
            </p>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="identifier" className="form-label">
                Téléphone ou Email
              </label>
              <input
                id="identifier"
                type="text"
                className="form-control"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="+221 XX XXX XX XX ou email@example.com"
                required
                autoComplete="username"
                aria-required="true"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez votre mot de passe"
                required
                autoComplete="current-password"
                aria-required="true"
              />
            </div>

            <div className="form-group">
              <Link to="/forgot-password" className="auth-link">
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Pas encore de compte ?{' '}
              <Link to="/signup" className="auth-link">
                Créer un compte
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
