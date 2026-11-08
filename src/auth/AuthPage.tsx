import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole, Store } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (mode === "signin") {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
      } else {
        const result = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (result.error) throw result.error;
        if (!result.data.session) setMessage("Account created. Check your email to confirm your address, then sign in.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><span><Store size={22}/></span><div><strong>Boli-Khata</strong><small>YOUR BUSINESS, IN YOUR WORDS</small></div></div>
      <div className="auth-lock"><LockKeyhole size={18}/></div>
      <div className="eyebrow">SECURE BUSINESS WORKSPACE</div>
      <h1>{mode === "signin" ? "Welcome back." : "Create your account."}</h1>
      <p className="auth-intro">{mode === "signin" ? "Sign in to access your business workspace and customer records." : "Start your Boli-Khata workspace with a verified email address."}</p>
      <form onSubmit={submit} className="auth-form">
        <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
        <label>Password<input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-success" role="status">{message}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"} <ArrowRight size={16}/></button>
      </form>
      <p className="auth-switch">{mode === "signin" ? "New to Boli-Khata?" : "Already have an account?"} <button onClick={()=>{setMode(mode==="signin"?"signup":"signin");setError("");setMessage("");}}>{mode==="signin"?"Create an account":"Sign in instead"}</button></p>
      <p className="auth-privacy">Your business data is protected by authenticated access and business-level permissions.</p>
    </section>
  </main>;
}
