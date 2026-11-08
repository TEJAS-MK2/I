import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { supabase, supabaseConfigured } from "../lib/supabase";

export type BusinessSummary = { id: string; name: string; currency: "INR"; role: string };
type BusinessState = {
  business: BusinessSummary | null;
  loading: boolean;
  error: string;
  configured: boolean;
  refresh: () => Promise<void>;
};
const BusinessContext = createContext<BusinessState>({
  business: null,
  loading: false,
  error: "",
  configured: false,
  refresh: async () => undefined,
});
export const useBusiness = () => useContext(BusinessContext);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [business, setBusiness] = useState<BusinessSummary | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase || !user) {
      setBusiness(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const membership = await supabase.from("business_memberships")
      .select("business_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membership.error) {
      setError("Could not load your business access. Please refresh and try again.");
      setBusiness(null);
      setLoading(false);
      return;
    }
    if (!membership.data) {
      setBusiness(null);
      setLoading(false);
      return;
    }
    const result = await supabase.from("businesses")
      .select("id, name, currency")
      .eq("id", membership.data.business_id)
      .single();
    if (result.error || !result.data || result.data.currency !== "INR") {
      setError("Your business workspace could not be loaded.");
      setBusiness(null);
    } else {
      setBusiness({ ...result.data, role: membership.data.role, currency: "INR" });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<BusinessState>(() => ({
    business,
    loading,
    error,
    configured: supabaseConfigured,
    refresh,
  }), [business, loading, error, refresh]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}
