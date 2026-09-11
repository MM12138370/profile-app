import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { loginOrRegister, logout as persistLogout, restoreSession, saveNickname } from '../storage';
import type { UserRecord } from '../types';

type AuthContextValue = {
  user: UserRecord | null;
  ready: boolean;
  login: (username: string, nickname?: string) => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void restoreSession()
      .then(setUser)
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (username: string, nickname?: string) => {
    const record = await loginOrRegister(username, nickname);
    setUser(record);
  }, []);

  const updateNickname = useCallback(async (nickname: string) => {
    if (!user) {
      return;
    }
    setUser(saveNickname(user.username, nickname));
  }, [user]);

  const logout = useCallback(async () => {
    await persistLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, updateNickname, logout }),
    [user, ready, login, updateNickname, logout],
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
