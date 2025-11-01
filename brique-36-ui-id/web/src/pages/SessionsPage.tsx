import { useState, useEffect } from 'react';
import { useTTS } from '../contexts/TTSContext';
import { Smartphone, Monitor, Globe, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import './SessionsPage.css';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

interface Session {
  id: string;
  channel: string;
  device_fingerprint?: any;
  geo_country?: string;
  last_seen_at: string;
  created_at: string;
  is_active: boolean;
  is_current?: boolean;
  anomalies?: number;
}

export default function SessionsPage() {
  const { speak } = useTTS();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('Non authentifié');
        setLoading(false);
        return;
      }

      console.log('📋 Loading sessions...');
      const response = await fetch(`${API_URL}/api/id/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des sessions');
      }

      const data = await response.json();
      console.log('📋 Sessions loaded:', data);
      setSessions(data.sessions || []);
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors du chargement des sessions';
      setError(errorMsg);
      console.error('Sessions error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer cette session ?')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('Non authentifié');
        return;
      }

      const response = await fetch(`${API_URL}/api/id/sessions/${sessionId}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la révocation');
      }

      speak('Session révoquée avec succès');
      await loadSessions();
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors de la révocation';
      setError(errorMsg);
      speak(`Erreur: ${errorMsg}`);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'mobile':
        return <Smartphone size={20} />;
      case 'web':
        return <Globe size={20} />;
      case 'ussd':
        return <Monitor size={20} />;
      default:
        return <Monitor size={20} />;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'mobile':
        return 'Application Mobile';
      case 'web':
        return 'Navigateur Web';
      case 'ussd':
        return 'USSD (*131#)';
      case 'api':
        return 'API';
      default:
        return channel;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR');
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--spacing-xl) 0' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          Chargement des sessions...
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: 'var(--spacing-xl) 0' }}>
      <div className="sessions-page">
        <div className="page-header">
          <h1 className="page-title">Mes sessions actives</h1>
          <p className="page-description">
            Gérez les appareils et services connectés à votre compte Molam ID
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="card">
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <p className="empty-state">Aucune session active</p>
            </div>
          </div>
        ) : (
          <div className="sessions-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`session-card ${session.is_current ? 'current' : ''} ${
                  session.anomalies && session.anomalies > 0 ? 'anomaly' : ''
                }`}
              >
                <div className="session-icon">
                  {getChannelIcon(session.channel)}
                </div>

                <div className="session-content">
                  <div className="session-header">
                    <div>
                      <h3 className="session-title">
                        {getChannelLabel(session.channel)}
                        {session.is_current && (
                          <span className="session-badge current">Session actuelle</span>
                        )}
                      </h3>
                      <p className="session-details">
                        {session.device_fingerprint?.os && (
                          <span>{session.device_fingerprint.os} • </span>
                        )}
                        {session.device_fingerprint?.browser && (
                          <span>{session.device_fingerprint.browser} • </span>
                        )}
                        {session.geo_country && <span>{session.geo_country}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="session-footer">
                    <div className="session-status">
                      {session.is_active ? (
                        <>
                          <CheckCircle size={16} className="status-icon active" />
                          <span>Active • {formatDate(session.last_seen_at)}</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={16} className="status-icon inactive" />
                          <span>Inactive</span>
                        </>
                      )}
                    </div>

                    {session.anomalies && session.anomalies > 0 && (
                      <div className="session-warning">
                        <AlertTriangle size={16} />
                        <span>{session.anomalies} anomalie(s) détectée(s)</span>
                      </div>
                    )}
                  </div>
                </div>

                {!session.is_current && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    className="btn btn-outline btn-sm session-revoke-btn"
                    title="Révoquer cette session"
                  >
                    Révoquer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="security-tips card" style={{ marginTop: 'var(--spacing-xl)' }}>
          <h3 className="tips-title">Conseils de sécurité</h3>
          <ul className="tips-list">
            <li>Révoquez les sessions que vous ne reconnaissez pas</li>
            <li>Vérifiez régulièrement vos sessions actives</li>
            <li>Déconnectez-vous des appareils partagés après utilisation</li>
            <li>Activez l'authentification à deux facteurs pour plus de sécurité</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
