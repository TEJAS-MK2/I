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
  if (!isString(body.business_id) || !isString(body.product_id) ||
      typeof body.quantity_delta !== "number" || !Number.isFinite(body.quantity_delta) ||
      !isString(body.note) || !isString(body.idempotency_key) ||
      typeof body.confirmed !== "boolean") return json(400, { error: "invalid_adjustment_shape" });

  const { data, error } = await client.rpc("adjust_stock", {
    p_business_id: body.business_id,
    p_product_id: body.product_id,
    p_quantity_delta: body.quantity_delta,
    p_note: body.note,
    p_idempotency_key: body.idempotency_key,
    p_confirmed: body.confirmed,
  });
  if (error) {
    const denied = error.code === "42501";
    const conflict = error.code === "40001" || error.code === "23505";
    return json(denied ? 403 : conflict ? 409 : 422, {
      error: denied ? "stock_adjustment_denied" : conflict ? "adjustment_conflict" : "stock_adjustment_rejected",
    });
  }
  return json(200, { result: data });
});
