import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MolamIdClient } from '@molam/sdk-auth';

interface User {
  id: string;
  phone_number?: string;
  email?: string;
  profile?: {
    given_name?: string;
    family_name?: string;
  };
}

interface AuthContextType {
  client: MolamIdClient;
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = 'http://localhost:3000'; // Update for production

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new MolamIdClient({ apiUrl: API_URL }));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const profile = await client.getProfile();
      setUser({
        id: profile.sub,
        phone_number: profile.phone_number,
        email: profile.email,
        profile: {
          given_name: profile.given_name,
          family_name: profile.family_name,
        }
      });
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const tokens = await client.getTokens();
        if (tokens) {
          await refreshUser();
        }
      } catch (error) {
        console.error('Init error:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (identifier: string, password: string) => {
    await client.login(identifier, password);
    await refreshUser();
  };

  const signup = async (data: any) => {
    await client.signup(data);
    await refreshUser();
  };

  const logout = async () => {
    await client.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        client,
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
