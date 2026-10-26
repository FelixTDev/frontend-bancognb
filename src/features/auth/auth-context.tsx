import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../../shared/api/endpoints";
import type { AuthSession, UserRole } from "../../shared/types/domain";
import { clearSession, getSession, saveSession } from "./session";

interface AuthContextValue {
  readonly session: AuthSession | null;
  readonly isRestoring: boolean;
  readonly login: (credentials: {
    readonly email: string;
    readonly password: string;
  }) => Promise<AuthSession>;
  readonly logout: () => Promise<void>;
  readonly can: (...roles: readonly UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    getSession(),
  );
  const [isRestoring, setIsRestoring] = useState(() => getSession() !== null);
  const persistedSession = useRef(session);

  const endSession = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => endSession();
    window.addEventListener("gnb:unauthorized", onUnauthorized);
    return () => window.removeEventListener("gnb:unauthorized", onUnauthorized);
  }, [endSession]);

  useEffect(() => {
    const initialSession = persistedSession.current;
    if (!initialSession) return;
    let active = true;
    void api.auth
      .me()
      .then((user) => {
        if (!active) return;
        const next = { ...initialSession, user };
        saveSession(next);
        setSession(next);
      })
      .catch(() => {
        if (active) endSession();
      })
      .finally(() => {
        if (active) setIsRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [endSession]);

  const login = useCallback(
    async (credentials: {
      readonly email: string;
      readonly password: string;
    }) => {
      const next = await api.auth.login(credentials);
      saveSession(next);
      setSession(next);
      return next;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      endSession();
    }
  }, [endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isRestoring,
      login,
      logout,
      can: (...roles) => (session ? roles.includes(session.user.role) : false),
    }),
    [isRestoring, login, logout, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
