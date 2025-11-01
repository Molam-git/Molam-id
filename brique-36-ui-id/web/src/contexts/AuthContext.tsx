import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  phone_number?: string;
  email?: string;
  created_at?: string;
  profile?: {
    given_name?: string;
    family_name?: string;
  };
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

export function MolamIdProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const storedUserData = localStorage.getItem('user_data');

      console.log('🔄 Refreshing user...');
      console.log('📦 Stored user_data:', storedUserData);

      if (!token) {
        setLoading(false);
        return;
      }

      // Load user data from localStorage if available
      if (storedUserData) {
        const userData = JSON.parse(storedUserData);
        console.log('✅ Loading user from localStorage:', userData);
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        // Fallback: Decode JWT to get user info
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser({
            id: payload.user_id || payload.sub,
            phone_number: payload.phone,
            email: payload.email,
            profile: {
              given_name: payload.given_name || payload.firstName,
              family_name: payload.family_name || payload.lastName,
            },
          });
          setIsAuthenticated(true);
        } catch (decodeError) {
          console.error('Failed to decode token:', decodeError);
        }
      }
    } catch (error) {
      console.error('RefreshUser error:', error);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_data');
    } finally {
      setLoading(false);
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (identifier: string, password: string) => {
    try {
      // Detect if identifier is email or phone
      const isEmail = identifier.includes('@');
      const loginData = isEmail
        ? { email: identifier, password }
        : { phone: identifier, password };

      console.log('🔐 Login with:', loginData);

      const response = await fetch(`${API_URL}/api/id/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      console.log('🔐 Login response data:', data);

      // Store tokens in localStorage
      localStorage.setItem('access_token', data.access_token || data.tokens?.accessToken);
      localStorage.setItem('refresh_token', data.refresh_token || data.tokens?.refreshToken);

      const userData = {
        id: data.user?.id || data.user_id,
        phone_number: data.user?.phone_number || data.user?.phone,
        email: data.user?.email,
        created_at: data.user?.created_at,
        profile: {
          given_name: data.user?.profile?.given_name,
          family_name: data.user?.profile?.family_name,
        },
      };

      console.log('👤 User data to store:', userData);
      localStorage.setItem('user_data', JSON.stringify(userData));
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (data: any) => {
    try {
      console.log('📝 Signup request data:', data);

      const response = await fetch(`${API_URL}/api/id/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Signup failed');
      }

      const result = await response.json();
      console.log('📝 Signup response:', result);

      // Store tokens in localStorage
      localStorage.setItem('access_token', result.tokens?.accessToken);
      localStorage.setItem('refresh_token', result.tokens?.refreshToken);

      const userData = {
        id: result.user?.id,
        phone_number: result.user?.phone_number || result.user?.phone,
        email: result.user?.email,
        created_at: result.user?.created_at || result.user?.createdAt,
        profile: {
          given_name: result.user?.profile?.given_name,
          family_name: result.user?.profile?.family_name,
        },
      };

      console.log('📝 Signup user data to store:', userData);
      localStorage.setItem('user_data', JSON.stringify(userData));
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useMolamId() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useMolamId must be used within MolamIdProvider');
  }
  return context;
}
