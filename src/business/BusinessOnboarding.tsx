import { useState, type FormEvent } from "react";
import { ArrowRight, Store } from "lucide-react";
import { useBusiness } from "./BusinessContext";
import { supabase } from "../lib/supabase";

export default function BusinessOnboarding() {
  const [name,setName]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const { refresh }=useBusiness();

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!supabase)return;
    setBusy(true);setError("");
    const {data,error:invokeError}=await supabase.functions.invoke("business-setup",{
      body:{action:"create_business",name:name.trim()},
    });
    if(invokeError||!data?.result?.business_id){
      setError("We couldn't create your workspace. Please retry or contact support.");
      setBusy(false);
      return;
    }
    await refresh();
    setBusy(false);
  }

  return <main className="auth-screen"><section className="auth-card">
    <div className="auth-brand"><span><Store size={22}/></span><div><strong>Boli-Khata</strong><small>YOUR BUSINESS, IN YOUR WORDS</small></div></div>
    <div className="eyebrow">FIRST-TIME SETUP</div><h1>Set up your shop.</h1>
    <p className="auth-intro">Create your business workspace. Your account will become its owner, and business records will stay isolated from other shops.</p>
    <form className="auth-form" onSubmit={submit}>
      <label>Business name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Pijush General Store"/></label>
      {error&&<p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" disabled={busy||!name.trim()}>{busy?"Creating workspace…":"Create business workspace"} <ArrowRight size={16}/></button>
    </form>
    <p className="auth-privacy">Your first account is assigned the owner role. Staff access can be added after role management is available.</p>
  </section></main>;
}
