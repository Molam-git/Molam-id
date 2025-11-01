import { Routes, Route, Navigate } from 'react-router-dom';
import { MolamIdProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TTSProvider } from './contexts/TTSContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProfilePage from './pages/ProfilePage';
import SessionsPage from './pages/SessionsPage';
import LegalPage from './pages/LegalPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <TTSProvider>
          <MolamIdProvider>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              <Navigation />
              <main style={{ flex: 1, paddingBottom: '80px' }}>
                <Routes>
                  <Route path="/" element={<Navigate to="/profile" replace />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/sessions"
                    element={
                      <ProtectedRoute>
                        <SessionsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/legal/:type" element={<LegalPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </MolamIdProvider>
        </TTSProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
