import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../lib/supabase";
import AuthPage from "./AuthPage";

type AuthState = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthState>({
  configured: false,
  loading: false,
  session: null,
  user: null,
  signOut: async () => undefined,
});
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setLoading(false);
      }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(error ? null : data.session);
      setLoading(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(() => ({
    configured: supabaseConfigured,
    loading,
    session,
    user: session?.user ?? null,
    signOut: async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [loading, session]);

  if (!supabaseConfigured) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }
  if (loading) return <div className="auth-loading" role="status">Checking your secure session…</div>;
  if (!session) return <AuthPage />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
