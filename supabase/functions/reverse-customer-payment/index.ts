import { createClient } from "@supabase/supabase-js";
import { getPublishableApiKey } from "../_shared/keys.ts";
const cors={ "Access-Control-Allow-Origin":Deno.env.get("APP_ORIGIN")??"http://localhost:5173","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin" };
const json=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
Deno.serve(async(request:Request)=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(request.method!=="POST")return json(405,{error:"method_not_allowed"});
 const token=request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return json(401,{error:"authentication_required"});
 const url=Deno.env.get("SUPABASE_URL"),key=getPublishableApiKey();
 if(!url||!key)return json(503,{error:"backend_not_configured"});
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:auth,error:authError}=await client.auth.getUser(token);
 if(authError||!auth.user)return json(401,{error:"invalid_session"});
 let body:Record<string,unknown>;
 try{const value=await request.json();if(!value||typeof value!=="object"||Array.isArray(value))return json(400,{error:"invalid_request"});body=value as Record<string,unknown>;}catch{return json(400,{error:"invalid_json"});}
 if(typeof body.business_id!=="string"||typeof body.original_transaction_id!=="string"||typeof body.idempotency_key!=="string"||typeof body.confirmed!=="boolean")return json(400,{error:"invalid_request_shape"});
 const {data,error}=await client.rpc("reverse_customer_payment",{p_business_id:body.business_id,p_original_transaction_id:body.original_transaction_id,p_idempotency_key:body.idempotency_key,p_confirmed:body.confirmed});
 if(error){const denied=error.code==="42501";const conflict=error.code==="40001"||error.code==="23505";return json(denied?403:conflict?409:422,{error:denied?"business_access_denied":conflict?"reversal_conflict":"reversal_rejected"});}
 return json(200,{result:data});
});
