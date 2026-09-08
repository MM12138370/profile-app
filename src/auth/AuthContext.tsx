import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { loginOrRegister, logout as persistLogout, restoreSession } from '../storage';
import type { SessionUser } from '../types';

type AuthContextValue = {
  user: SessionUser | null;
  ready: boolean;
  login: (username: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void restoreSession()
      .then(setUser)
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (username: string) => {
    const record = await loginOrRegister(username);
    setUser(record);
  }, []);

  const logout = useCallback(async () => {
    await persistLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
