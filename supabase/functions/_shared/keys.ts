export function getPublishableApiKey(): string | null {
  const rawKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (rawKeys) {
    try {
      const parsed: unknown = JSON.parse(rawKeys);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const defaultKey = (parsed as Record<string, unknown>).default;
        if (typeof defaultKey === "string" && defaultKey.trim()) return defaultKey.trim();
      }
    } catch {
      // Fall through to the explicit compatibility variables below.
    }
  }

  return Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim()
    || Deno.env.get("SUPABASE_ANON_KEY")?.trim()
    || null;
}
