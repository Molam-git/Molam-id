import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMolamId } from '../contexts/AuthContext';
import { useTTS } from '../contexts/TTSContext';
import './AuthPages.css';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup, isAuthenticated } = useMolamId();
  const { speak } = useTTS();

  const [formData, setFormData] = useState({
    phone_number: '',
    email: '',
    password: '',
    confirmPassword: '',
    given_name: '',
    family_name: '',
    acceptTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/profile');
    return null;
  }

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      speak('Les mots de passe ne correspondent pas');
      return;
    }

    if (!formData.acceptTerms) {
      setError('Vous devez accepter les conditions générales');
      speak('Vous devez accepter les conditions générales');
      return;
    }

    setLoading(true);

    try {
      await signup({
        phone: formData.phone_number,
        email: formData.email || undefined,
        password: formData.password,
        firstName: formData.given_name,
        lastName: formData.family_name,
      });
      speak('Compte créé avec succès');
      navigate('/profile');
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors de la création du compte';
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
            <h1 className="auth-title">Créer un compte</h1>
            <p className="auth-subtitle">
              Rejoignez l'écosystème Molam
            </p>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="given_name" className="form-label">
                  Prénom *
                </label>
                <input
                  id="given_name"
                  name="given_name"
                  type="text"
                  className="form-control"
                  value={formData.given_name}
                  onChange={handleChange}
                  placeholder="Votre prénom"
                  required
                  autoComplete="given-name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="family_name" className="form-label">
                  Nom *
                </label>
                <input
                  id="family_name"
                  name="family_name"
                  type="text"
                  className="form-control"
                  value={formData.family_name}
                  onChange={handleChange}
                  placeholder="Votre nom"
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="phone_number" className="form-label">
                Numéro de téléphone *
              </label>
              <input
                id="phone_number"
                name="phone_number"
                type="tel"
                className="form-control"
                value={formData.phone_number}
                onChange={handleChange}
                placeholder="+221 XX XXX XX XX"
                required
                autoComplete="tel"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email (optionnel)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
                placeholder="email@example.com"
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Mot de passe *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-control"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 8 caractères"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirmer le mot de passe *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className="form-control"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Répétez le mot de passe"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="acceptTerms"
                  checked={formData.acceptTerms}
                  onChange={handleChange}
                  required
                />
                <span>
                  J'accepte les{' '}
                  <Link to="/legal/cgu" target="_blank" className="auth-link">
                    Conditions Générales d'Utilisation
                  </Link>{' '}
                  et la{' '}
                  <Link to="/legal/privacy" target="_blank" className="auth-link">
                    Politique de Confidentialité
                  </Link>
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Déjà un compte ?{' '}
              <Link to="/login" className="auth-link">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
