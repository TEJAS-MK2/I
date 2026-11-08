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

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(401, { error: "authentication_required" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = getPublishableApiKey();
  if (!supabaseUrl || !publishableKey) return json(503, { error: "backend_not_configured" });

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "invalid_session" });

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json(400, { error: "invalid_request" });
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const requiredStrings = ["business_id", "customer_id", "currency", "idempotency_key"];
  if (requiredStrings.some((key) => typeof body[key] !== "string")
    || typeof body.amount_paise !== "number"
    || !Number.isSafeInteger(body.amount_paise)
    || typeof body.confirmed !== "boolean"
    || !Array.isArray(body.items)) {
    return json(400, { error: "invalid_request_shape" });
  }

  // The database function independently verifies role, tenant ownership, stock,
  // item totals, explicit confirmation and idempotency inside one transaction.
  const { data, error } = await supabase.rpc("record_credit_sale", {
    p_business_id: body.business_id,
    p_customer_id: body.customer_id,
    p_amount_paise: body.amount_paise,
    p_currency: body.currency,
    p_idempotency_key: body.idempotency_key,
    p_items: body.items,
    p_confirmed: body.confirmed,
  });

  if (error) {
    const denied = error.code === "42501" || /business access denied|authentication required/i.test(error.message);
    const conflict = error.code === "40001";
    return json(denied ? 403 : conflict ? 409 : 422, {
      error: denied ? "business_access_denied" : conflict ? "request_in_progress_retry_same_key" : "transaction_rejected",
    });
  }
  return json(200, { result: data });
});
