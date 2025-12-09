import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTTS } from '../contexts/TTSContext';
import './AuthPages.css';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

type Step = 'email' | 'otp' | 'newPassword' | 'success';

export default function ForgotPasswordPage() {
  const { speak } = useTTS();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRequestOTP = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/id/password/request-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'envoi du code');
      }

      await response.json();
      setSuccessMessage('Code de vérification envoyé par email');
      speak('Code de vérification envoyé');
      setStep('otp');
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors de l\'envoi du code';
      setError(errorMsg);
      speak(`Erreur: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/id/password/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Code de vérification invalide');
      }

      const data = await response.json();
      setResetToken(data.resetToken);
      setSuccessMessage('Code vérifié avec succès');
      speak('Code vérifié');
      setStep('newPassword');
    } catch (err: any) {
      const errorMsg = err.message || 'Code de vérification invalide';
      setError(errorMsg);
      speak(`Erreur: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      speak('Les mots de passe ne correspondent pas');
      return;
    }

    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      speak('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/id/password/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          resetToken,
          newPassword
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la réinitialisation');
      }

      setSuccessMessage('Mot de passe réinitialisé avec succès');
      speak('Mot de passe réinitialisé avec succès');
      setStep('success');
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors de la réinitialisation';
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
            <h1 className="auth-title">
              {step === 'email' && 'Mot de passe oublié'}
              {step === 'otp' && 'Vérification'}
              {step === 'newPassword' && 'Nouveau mot de passe'}
              {step === 'success' && 'Succès'}
            </h1>
            <p className="auth-subtitle">
              {step === 'email' && 'Entrez votre email pour recevoir un code de vérification'}
              {step === 'otp' && 'Entrez le code reçu par email'}
              {step === 'newPassword' && 'Créez votre nouveau mot de passe'}
              {step === 'success' && 'Votre mot de passe a été réinitialisé'}
            </p>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {successMessage && !error && (
            <div className="alert alert-success" role="alert">
              {successMessage}
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleRequestOTP} className="auth-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                {loading ? 'Envoi...' : 'Envoyer le code'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="auth-form">
              <div className="form-group">
                <label htmlFor="otp" className="form-label">
                  Code de vérification
                </label>
                <input
                  id="otp"
                  type="text"
                  className="form-control"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                  style={{ fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.5rem' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                {loading ? 'Vérification...' : 'Vérifier le code'}
              </button>

              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="btn btn-outline"
                  style={{ fontSize: '0.875rem' }}
                >
                  Renvoyer le code
                </button>
              </div>
            </form>
          )}

          {step === 'newPassword' && (
            <form onSubmit={handleResetPassword} className="auth-form">
              <div className="form-group">
                <label htmlFor="newPassword" className="form-label">
                  Nouveau mot de passe
                </label>
                <input
                  id="newPassword"
                  type="password"
                  className="form-control"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Au moins 8 caractères"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Confirmer le mot de passe
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
              </button>
            </form>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <p style={{ marginBottom: '1.5rem' }}>
                Votre mot de passe a été réinitialisé avec succès.
              </p>
              <Link to="/login" className="btn btn-primary">
                Se connecter
              </Link>
            </div>
          )}

          <div className="auth-footer">
            <p>
              <Link to="/login" className="auth-link">
                Retour à la connexion
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
