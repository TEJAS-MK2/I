import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "http://localhost:5173",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(401, { error: "authentication_required" });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return json(503, { error: "backend_not_configured" });

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user) return json(401, { error: "invalid_session" });

  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (!isRecord(value)) return json(400, { error: "invalid_request" });
    body = value;
  } catch {
    return json(400, { error: "invalid_json" });
  }

  if (!isString(body.business_id) || !isString(body.customer_id) || !isString(body.channel) ||
      typeof body.confirmed !== "boolean") return json(400, { error: "invalid_request_shape" });

  let rpc: string;
  let args: Record<string, unknown>;
  if (body.action === "set_consent") {
    if (!["whatsapp", "sms", "email"].includes(body.channel) ||
        !["opted_in", "opted_out"].includes(String(body.consent_status)) ||
        !isString(body.consent_source)) return json(400, { error: "invalid_consent_request" });
    rpc = "set_customer_communication_preference";
    args = {
      p_business_id: body.business_id,
      p_customer_id: body.customer_id,
      p_channel: body.channel,
      p_consent_status: body.consent_status,
      p_consent_source: body.consent_source,
      p_confirmed: body.confirmed,
    };
  } else if (body.action === "queue") {
    if (!["whatsapp", "sms", "email"].includes(body.channel) ||
        !["receipt", "payment_reminder", "delivery_update", "general"].includes(String(body.purpose)) ||
        !isString(body.template_key) || !isString(body.idempotency_key) || !isRecord(body.payload)) {
      return json(400, { error: "invalid_notification_request" });
    }
    rpc = "queue_customer_notification";
    args = {
      p_business_id: body.business_id,
      p_customer_id: body.customer_id,
      p_channel: body.channel,
      p_purpose: body.purpose,
      p_template_key: body.template_key,
      p_payload: body.payload,
      p_idempotency_key: body.idempotency_key,
      p_confirmed: body.confirmed,
    };
  } else {
    return json(400, { error: "unsupported_action" });
  }

  const { data, error } = await client.rpc(rpc, args);
  if (error) {
    const denied = error.code === "42501";
    const conflict = error.code === "40001" || error.code === "23505";
    return json(denied ? 403 : conflict ? 409 : 422, {
      error: denied ? "consent_or_business_access_denied" : conflict ? "request_conflict" : "communication_request_rejected",
    });
  }
  return json(200, { result: data });
});
