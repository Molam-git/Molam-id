import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTTS } from '../contexts/TTSContext';
import { FileText, Calendar, Volume2 } from 'lucide-react';
import './LegalPage.css';

interface LegalDocument {
  id: string;
  type: string;
  lang: string;
  version: number;
  content: string;
  html_content?: string;
  published_at: string;
}

const DOCUMENT_TITLES: Record<string, string> = {
  cgu: 'Conditions Générales d\'Utilisation',
  privacy: 'Politique de Confidentialité',
  legal: 'Mentions Légales',
  cookies: 'Politique des Cookies',
  data_protection: 'Protection des Données',
};

export default function LegalPage() {
  const { type } = useParams<{ type: string }>();
  const { speak } = useTTS();
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'text' | 'html'>('html');

  useEffect(() => {
    loadDocument();
  }, [type]);

  const loadDocument = async () => {
    if (!type) return;

    try {
      setLoading(true);
      setError('');

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/api/legal/${type}/fr`);

      if (!response.ok) {
        throw new Error('Document non trouvé');
      }

      const data = await response.json();
      setDocument(data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du document');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReadAloud = () => {
    if (!document) return;
    speak(document.content);
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--spacing-xl) 0' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          Chargement du document...
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="container" style={{ padding: 'var(--spacing-xl) 0' }}>
        <div className="alert alert-danger">
          {error || 'Document non trouvé'}
        </div>
      </div>
    );
  }

  const title = type ? DOCUMENT_TITLES[type] : 'Document légal';

  return (
    <div className="container" style={{ padding: 'var(--spacing-xl) 0' }}>
      <div className="legal-page">
        <div className="legal-header">
          <div className="legal-icon">
            <FileText size={32} />
          </div>
          <div>
            <h1 className="legal-title">{title}</h1>
            <div className="legal-meta">
              <div className="legal-meta-item">
                <Calendar size={16} />
                <span>
                  Publié le{' '}
                  {new Date(document.published_at).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="legal-meta-item">
                <span className="version-badge">Version {document.version}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="legal-actions">
          <button
            onClick={handleReadAloud}
            className="btn btn-outline"
            title="Lire à voix haute"
          >
            <Volume2 size={18} />
            <span>Lire à voix haute</span>
          </button>
          {document.html_content && (
            <div className="view-toggle">
              <button
                onClick={() => setViewMode('html')}
                className={`toggle-option ${viewMode === 'html' ? 'active' : ''}`}
              >
                Mise en forme
              </button>
              <button
                onClick={() => setViewMode('text')}
                className={`toggle-option ${viewMode === 'text' ? 'active' : ''}`}
              >
                Texte brut
              </button>
            </div>
          )}
        </div>

        <div className="legal-content card">
          {viewMode === 'html' && document.html_content ? (
            <div
              className="legal-html"
              dangerouslySetInnerHTML={{ __html: document.html_content }}
            />
          ) : (
            <pre className="legal-text">{document.content}</pre>
          )}
        </div>

        <div className="legal-footer">
          <p className="legal-footer-text">
            Pour toute question concernant ce document, veuillez nous contacter à{' '}
            <a href="mailto:legal@molam.sn">legal@molam.sn</a>
          </p>
        </div>
      </div>
    </div>
  );
}
