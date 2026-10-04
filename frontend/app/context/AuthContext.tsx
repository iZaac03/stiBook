import React, { createContext, useContext, useEffect, useState } from 'react';
import { login, register, logout, getUser, saveToken, clearToken, getToken } from '../../api/axios';

type User = {
  id: number; name: string; username: string; email: string;
  role: 'user' | 'admin'; is_active: boolean;
  profile_picture: string | null; bio: string | null;
  status?: string | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  handleLogin: (email: string, password: string) => Promise<void>;
  handleRegister: (name: string, username: string, email: string, password: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) { const u = await getUser(); setUser(u); }
      } catch { await clearToken(); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const data = await login({ email, password });
    await saveToken(data.token);
    setUser(data.user);
  };

  const handleRegister = async (name: string, username: string, email: string, password: string) => {
    const data = await register({ name, username, email, password });
    await saveToken(data.token);
    setUser(data.user);
  };

  const handleLogout = async () => {
    try { await logout(); } catch {}
    await clearToken();
    setUser(null);
  };

  const refreshUser = async () => {
    try { const u = await getUser(); setUser(u); } catch {}
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      isAdmin: user?.role === 'admin',
      handleLogin, handleRegister, handleLogout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
export default AuthProvider;