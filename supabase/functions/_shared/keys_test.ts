import { getPublishableApiKey } from "./keys.ts";

Deno.test("prefers the current Supabase publishable-key dictionary", () => {
  const names = ["SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"];
  const previous = new Map(names.map(name => [name, Deno.env.get(name)]));
  try {
    Deno.env.set("SUPABASE_PUBLISHABLE_KEYS", JSON.stringify({ default: "sb_publishable_current" }));
    Deno.env.set("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_legacy-custom");
    Deno.env.set("SUPABASE_ANON_KEY", "legacy-anon");
    if (getPublishableApiKey() !== "sb_publishable_current") throw new Error("current key dictionary was not preferred");

    Deno.env.set("SUPABASE_PUBLISHABLE_KEYS", JSON.stringify({ secondary: "sb_publishable_other" }));
    if (getPublishableApiKey() !== "sb_publishable_legacy-custom") throw new Error("custom compatibility key fallback failed");

    Deno.env.delete("SUPABASE_PUBLISHABLE_KEY");
    if (getPublishableApiKey() !== "legacy-anon") throw new Error("legacy anon fallback failed");
  } finally {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});
