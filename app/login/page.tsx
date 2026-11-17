"use client";

import { FormEvent, useState } from "react";
import { api } from "../api";

export default function LoginPage() {
  const [mode, setMode] = useState<"login"|"register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try { await api(`/auth/${mode}`, { method: "POST", body: JSON.stringify(data) }); window.location.assign("/dashboard"); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to continue"); setBusy(false); }
  }
  return <main className="authShell"><section className="authStory"><div className="brand"><span className="brandMark"><i/><i/><i/></span><span>MarketFlow</span></div><div><span className="authPill">MULTICHANNEL COMMERCE</span><h1>One catalog.<br/><em>Every marketplace.</em></h1><p>Connect your seller accounts, publish products everywhere and keep inventory in sync from one calm workspace.</p><div className="authProof"><span>✓ Encrypted credentials</span><span>✓ Tenant-isolated data</span><span>✓ Reliable publishing jobs</span></div></div><small>Built for ambitious commerce teams.</small></section><section className="authPanel"><div className="authCard"><span className="modalEyebrow">WELCOME TO MARKETFLOW</span><h2>{mode === "login" ? "Sign in to your workspace" : "Create your seller workspace"}</h2><p>{mode === "login" ? "Manage every channel from one place." : "Start with a secure organization and owner account."}</p><div className="authTabs"><button className={mode==="login"?"active":""} onClick={()=>setMode("login")}>Sign in</button><button className={mode==="register"?"active":""} onClick={()=>setMode("register")}>Create account</button></div><form onSubmit={submit}>{mode === "register" && <><label>Full name<input name="name" required minLength={2} autoComplete="name" placeholder="Arjun Kumar"/></label><label>Organization<input name="organizationName" required minLength={2} autoComplete="organization" placeholder="Urban Nest"/></label></>}<label>Email address<input type="email" name="email" required autoComplete="email" placeholder="you@company.com"/></label><label>Password<input type="password" name="password" required minLength={10} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 10 characters"/></label>{error && <p className="formError" role="alert">{error}</p>}<button className="primary authSubmit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in securely" : "Create workspace"}</button></form><small className="legal">By continuing, you agree to use marketplace data responsibly.</small></div></section></main>;
}
