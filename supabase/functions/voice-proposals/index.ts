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

  if (!isString(body.business_id) || !isString(body.language_tag) ||
      !["speech", "text"].includes(String(body.input_mode)) ||
      !isString(body.transcript_text) || !isString(body.intent) ||
      !isRecord(body.proposal) || !(body.confidence === null ||
        (typeof body.confidence === "number" && body.confidence >= 0 && body.confidence <= 1)) ||
      !Array.isArray(body.ambiguity_flags) ||
      !body.ambiguity_flags.every(isString) ||
      !isString(body.idempotency_key) || typeof body.confirmed !== "boolean") {
    return json(400, { error: "invalid_voice_proposal_shape" });
  }
  if (body.transcript_text.length > 8000 || body.ambiguity_flags.length > 20 ||
      body.ambiguity_flags.some(flag => flag.length > 80)) {
    return json(400, { error: "voice_proposal_too_large" });
  }

  const { data, error } = await client.rpc("create_voice_proposal", {
    p_business_id: body.business_id,
    p_language_tag: body.language_tag,
    p_input_mode: body.input_mode,
    p_transcript_text: body.transcript_text,
    p_intent: body.intent,
    p_proposal: body.proposal,
    p_confidence: body.confidence,
    p_ambiguity_flags: body.ambiguity_flags,
    p_idempotency_key: body.idempotency_key,
    p_confirmed: body.confirmed,
  });
  if (error) {
    const denied = error.code === "42501";
    const conflict = error.code === "40001" || error.code === "23505";
    return json(denied ? 403 : conflict ? 409 : 422, {
      error: denied ? "business_access_denied" : conflict ? "proposal_conflict" : "proposal_rejected",
    });
  }
  return json(200, { result: data });
});
