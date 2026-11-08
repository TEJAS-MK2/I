import { createClient } from "@supabase/supabase-js";
import { getPublishableApiKey } from "../_shared/keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "http://localhost:5173",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(401, { error: "authentication_required" });

  const url = Deno.env.get("SUPABASE_URL");
  const key = getPublishableApiKey();
  if (!url || !key) return json(503, { error: "backend_not_configured" });
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user) return json(401, { error: "invalid_session" });

  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return json(400, { error: "invalid_request" });
    body = value as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid_json" });
  }

  let rpcName: string;
  let rpcArgs: Record<string, unknown>;
  if (body.action === "create_business" && typeof body.name === "string" && typeof body.idempotency_key === "string") {
    rpcName = "create_business";
    rpcArgs = { p_name: body.name, p_idempotency_key: body.idempotency_key };
  } else if (body.action === "create_customer"
    && typeof body.business_id === "string" && typeof body.display_name === "string"
    && (body.phone_e164 === null || body.phone_e164 === undefined || typeof body.phone_e164 === "string")
    && typeof body.idempotency_key === "string") {
    rpcName = "create_customer";
    rpcArgs = { p_business_id: body.business_id, p_display_name: body.display_name, p_phone_e164: body.phone_e164 ?? null, p_idempotency_key: body.idempotency_key };
  } else if (body.action === "create_product"
    && typeof body.business_id === "string" && typeof body.name === "string"
    && typeof body.unit_label === "string" && typeof body.unit_price_paise === "number"
    && Number.isSafeInteger(body.unit_price_paise) && typeof body.opening_stock === "number"
    && typeof body.idempotency_key === "string") {
    rpcName = "create_product";
    rpcArgs = {
      p_business_id: body.business_id,
      p_name: body.name,
      p_unit_label: body.unit_label,
      p_unit_price_paise: body.unit_price_paise,
      p_opening_stock: body.opening_stock,
      p_idempotency_key: body.idempotency_key,
    };
  } else {
    return json(400, { error: "invalid_request_shape" });
  }

  const { data, error } = await client.rpc(rpcName, rpcArgs);
  if (error) {
    const denied = error.code === "42501";
    return json(denied ? 403 : 422, { error: denied ? "business_access_denied" : "setup_request_rejected" });
  }
  return json(200, { result: data });
});
