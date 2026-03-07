'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type AuthContextType = {
  isAdmin: boolean | null;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  isAdmin: null,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      setIsAdmin(data.admin === true);
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ isAdmin, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
