import { createClient } from "@supabase/supabase-js";
import { getPublishableApiKey } from "../_shared/keys.ts";

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
const isSafePaise = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
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
    const value: unknown = await request.json();
    if (!isRecord(value)) return json(400, { error: "invalid_request" });
    body = value;
  } catch {
    return json(400, { error: "invalid_json" });
  }

  if (!isString(body.business_id) || typeof body.confirmed !== "boolean" || !isString(body.action)) {
    return json(400, { error: "invalid_request_shape" });
  }

  let rpc: string;
  let args: Record<string, unknown>;
  if (body.action === "create") {
    if (!isString(body.reference_code) || !isString(body.recipient_name) ||
      !isString(body.delivery_address) || !isString(body.idempotency_key) ||
      !isSafePaise(body.delivery_fee_paise) || !isSafePaise(body.cash_to_collect_paise) ||
      !(body.customer_id === null || isString(body.customer_id)) ||
      !(body.recipient_phone === null || typeof body.recipient_phone === "string")) {
      return json(400, { error: "invalid_delivery_details" });
    }
    rpc = "create_delivery_job";
    args = {
      p_business_id: body.business_id,
      p_customer_id: body.customer_id,
      p_reference_code: body.reference_code,
      p_recipient_name: body.recipient_name,
      p_recipient_phone: body.recipient_phone,
      p_delivery_address: body.delivery_address,
      p_delivery_fee_paise: body.delivery_fee_paise,
      p_cash_to_collect_paise: body.cash_to_collect_paise,
      p_idempotency_key: body.idempotency_key,
      p_confirmed: body.confirmed,
    };
  } else if (body.action === "assign") {
    if (!isString(body.delivery_job_id) || !isString(body.assigned_user_id)) {
      return json(400, { error: "invalid_assignment_details" });
    }
    rpc = "assign_delivery_job";
    args = {
      p_business_id: body.business_id,
      p_delivery_job_id: body.delivery_job_id,
      p_assigned_user_id: body.assigned_user_id,
      p_confirmed: body.confirmed,
    };
  } else if (body.action === "event") {
    const events = ["picked_up", "in_transit", "delivered", "failed", "cancelled", "returned", "cash_collected", "note_added"];
    if (!isString(body.delivery_job_id) || !isString(body.event_type) || !events.includes(body.event_type) ||
      !(body.note === undefined || body.note === null || typeof body.note === "string") ||
      !(body.cash_collected_paise === undefined || body.cash_collected_paise === null || isSafePaise(body.cash_collected_paise))) {
      return json(400, { error: "invalid_delivery_event" });
    }
    rpc = "record_delivery_event";
    args = {
      p_business_id: body.business_id,
      p_delivery_job_id: body.delivery_job_id,
      p_event_type: body.event_type,
      p_note: body.note ?? null,
      p_cash_collected_paise: body.cash_collected_paise ?? null,
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
      error: denied ? "business_access_denied" : conflict ? "request_conflict" : "delivery_operation_rejected",
    });
  }
  return json(200, { result: data });
});
