"use client";

import { FormEvent, useState } from "react";
import { api } from "../api";

type Mode = "login" | "register";

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 20, label: "Weak", color: "#c0392b" };
  if (score === 2) return { score: 40, label: "Fair", color: "#d97706" };
  if (score === 3) return { score: 65, label: "Good · at least 8 characters with a number", color: "#2d8653" };
  return { score: 100, label: "Strong", color: "#1a6b3f" };
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [keepSigned, setKeepSigned] = useState(true);
  const [password, setPassword] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const strength = getPasswordStrength(password);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setPassword("");
    setForgotSent(false);
  }

  async function handleForgotPassword() {
    const email = (document.getElementById("loginEmail") as HTMLInputElement)?.value?.trim();
    if (!email) { setError("Enter your email address first, then click Forgot password."); return; }
    setBusy(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setForgotSent(true);
      setError("");
    } catch {
      // Always show success to prevent email enumeration
      setForgotSent(true);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));

    // Build a payload that matches the API DTOs exactly.
    // LoginDto  : { email, password }
    // RegisterDto: { name, email, password, organizationName }
    const payload = mode === "login"
      ? { email: data.email, password: data.password }
      : { name: data.name, email: data.email, password: data.password, organizationName: data.organizationName };

    try {
      await api(`/auth/${mode}`, { method: "POST", body: JSON.stringify(payload) });
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="authShell" aria-label="SellersGrid authentication">
      {/* ── Left: form panel ── */}
      <section className="authPanel" aria-label="Sign in form">
        <div className="authInner">
          <div className="authBrand" aria-label="SellersGrid">
            <span className="brandMark" aria-hidden="true"><i /><i /><i /><i /></span>
            <span className="brandName">SellersGrid</span>
          </div>

          {mode === "register" && (
            <p className="authTopRight">
              Have an account?{" "}
              <button type="button" className="authLink" onClick={() => switchMode("login")}>Sign in</button>
            </p>
          )}

          <div className="authFormWrap">
            {mode === "register" && (
              <span className="trialBadge" aria-label="14-day free trial">14-day free trial</span>
            )}

            <h1 className="authHeading">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="authSub">
              {mode === "login"
                ? "Sign in to your SellersGrid workspace."
                : "Set up a workspace for your business in a couple of minutes."}
            </p>

            <button
              type="button"
              className="googleBtn"
              aria-label={mode === "login" ? "Continue with Google" : "Sign up with Google"}
              onClick={() => window.location.assign("/api/auth/google")}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.1-6.1C34.49 3.03 29.56 1 24 1 14.82 1 7.07 6.49 3.68 14.24l7.14 5.55C12.6 13.59 17.84 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.52 24.5c0-1.57-.14-3.08-.4-4.54H24v8.59h12.68c-.55 2.95-2.2 5.44-4.68 7.11l7.14 5.55C43.68 37.37 46.52 31.44 46.52 24.5z"/>
                <path fill="#FBBC05" d="M10.82 28.21A14.5 14.5 0 0 1 9.5 24c0-1.46.25-2.87.68-4.21l-7.14-5.55A23.94 23.94 0 0 0 0 24c0 3.84.92 7.48 2.54 10.69l8.28-6.48z"/>
                <path fill="#34A853" d="M24 47c5.56 0 10.22-1.84 13.63-5l-7.14-5.55c-1.84 1.23-4.19 1.95-6.49 1.95-6.16 0-11.4-4.09-13.18-9.79l-8.28 6.48C7.07 41.51 14.82 47 24 47z"/>
              </svg>
              {mode === "login" ? "Continue with Google" : "Sign up with Google"}
            </button>

            <div className="authDivider" aria-hidden="true">
              <span>or {mode === "login" ? "sign in with email" : "use your email"}</span>
            </div>

            {forgotSent && (
              <div className="formSuccess" role="status">
                If that email is registered, a reset link is on its way. Check your inbox.
              </div>
            )}

            <form onSubmit={submit} noValidate>
              {mode === "register" && (
                <div className="authFieldRow">
                  <label htmlFor="regName">
                    Your name
                    <input
                      id="regName"
                      name="name"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Abhay Sharma"
                      autoComplete="name"
                      autoFocus
                    />
                  </label>
                  <label htmlFor="regOrg">
                    Business name
                    <input
                      id="regOrg"
                      name="organizationName"
                      required
                      minLength={2}
                      maxLength={100}
                      placeholder="ABC Retail Pvt Ltd"
                      autoComplete="organization"
                    />
                  </label>
                </div>
              )}

              <label htmlFor="loginEmail">
                Email
                <input
                  id="loginEmail"
                  type="email"
                  name="email"
                  required
                  placeholder="you@business.in"
                  autoComplete="email"
                  autoFocus={mode === "login"}
                />
                {mode === "register" && (
                  <small className="fieldHint">We&apos;ll send a 6-digit code to confirm it.</small>
                )}
              </label>

              {mode === "register" && (
                <label htmlFor="regPhone">
                  Mobile number
                  <div className="phoneRow">
                    <span className="phonePrefix" aria-hidden="true">+91</span>
                    <input
                      id="regPhone"
                      name="phone"
                      type="tel"
                      required
                      pattern="[6-9][0-9]{9}"
                      placeholder="98765 43210"
                      autoComplete="tel-national"
                      title="Enter a valid 10-digit Indian mobile number"
                    />
                  </div>
                </label>
              )}

              <label htmlFor="loginPassword">
                <span className="passwordLabelRow">
                  Password
                  {mode === "login" && (
                    <button
                      type="button"
                      className="forgotBtn"
                      disabled={busy}
                      onClick={handleForgotPassword}
                    >
                      Forgot password?
                    </button>
                  )}
                </span>
                <input
                  id="loginPassword"
                  type="password"
                  name="password"
                  required
                  minLength={mode === "login" ? 1 : 8}
                  placeholder={mode === "login" ? "Your password" : "••••••••••••"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={mode === "register" ? password : undefined}
                  onChange={mode === "register" ? e => setPassword(e.target.value) : undefined}
                  aria-describedby={mode === "register" ? "pwStrengthHint" : undefined}
                />
                {mode === "register" && password && (
                  <>
                    <div
                      className="strengthBar"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={strength.score}
                      aria-label="Password strength"
                    >
                      <i
                        className="strengthFill"
                        style={{ width: `${strength.score}%`, background: strength.color }}
                      />
                    </div>
                    <small id="pwStrengthHint" className="fieldHint" style={{ color: strength.color }}>
                      {strength.label}
                    </small>
                  </>
                )}
              </label>

              {mode === "login" && (
                <label className="checkLabel">
                  <input
                    type="checkbox"
                    name="keepSigned"
                    checked={keepSigned}
                    onChange={e => setKeepSigned(e.target.checked)}
                  />
                  Keep me signed in on this device
                </label>
              )}

              {mode === "register" && (
                <label className="checkLabel">
                  <input type="checkbox" name="termsAccepted" value="true" required />
                  I agree to the{" "}
                  <a href="/terms" className="authLink" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                  {" "}and{" "}
                  <a href="/privacy" className="authLink" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                </label>
              )}

              {error && (
                <p className="formError" role="alert" aria-live="polite">{error}</p>
              )}

              <button type="submit" className="authSubmit" disabled={busy} aria-busy={busy}>
                {busy
                  ? <><span className="btnSpinner" aria-hidden="true" />Please wait…</>
                  : mode === "login" ? "Sign in" : "Create account"
                }
              </button>
            </form>

            {mode === "login" && (
              <p className="authSwitch">
                New to SellersGrid?{" "}
                <button type="button" className="authLink" onClick={() => switchMode("register")}>
                  Create an account
                </button>
              </p>
            )}
          </div>

          <footer className="authFooter">
            <span>© SellersGrid</span>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/help">Help</a>
          </footer>
        </div>
      </section>

      {/* ── Right: marketing story ── */}
      <section className="authStory" aria-label="Why SellersGrid">
        <div className="authStoryInner">
          {mode === "login" ? (
            <>
              <p className="storyKicker">AMAZON · FLIPKART · MYNTRA</p>
              <h2 className="storyHeading">List once.<br />Sell everywhere.</h2>
              <p className="storyBody">
                Add a product to SellersGrid and publish it to every marketplace you sell on.
                Stock, orders and payouts stay in sync, in one place.
              </p>

              <div className="storyCard" aria-label="Live product example">
                <div className="storyProduct">
                  <span className="storyProductIcon" aria-label="Organic Cotton Kurta">OCK</span>
                  <div>
                    <strong>Organic Cotton Kurta – Indigo</strong>
                    <small>MF-APP-108 · 5 sizes · 140 in stock</small>
                  </div>
                </div>
                <ul className="storyChannels" aria-label="Channel status">
                  {[
                    { name: "Amazon India", badge: "live", label: "Live" },
                    { name: "Flipkart", badge: "live", label: "Live" },
                    { name: "Myntra", badge: "upload", label: "In upload file" },
                  ].map(ch => (
                    <li key={ch.name} className="storyChannel">
                      <span>{ch.name}</span>
                      <span className={`channelBadge ${ch.badge}`}>{ch.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="storyFootnote">
                When an order comes in on one channel, stock updates on the others automatically.
              </p>
            </>
          ) : (
            <>
              <p className="storyKicker">YOUR FIRST HOUR</p>
              <h2 className="storyHeadingAlt">From sign-up to selling everywhere</h2>
              <ol className="stepList" aria-label="Onboarding steps">
                {[
                  {
                    title: "Connect your marketplace accounts",
                    desc: "Sign in to Amazon Seller Central and Flipkart Seller Hub to give SellersGrid access. Myntra takes your partner credentials.",
                  },
                  {
                    title: "Bring in what you already sell",
                    desc: "Your existing listings are imported and matched by SKU, so nothing is listed twice.",
                  },
                  {
                    title: "Add a product once, publish everywhere",
                    desc: "Fill in one form. SellersGrid checks each marketplace's rules before you publish.",
                  },
                ].map((step, i) => (
                  <li key={i}>
                    <span className="stepNum" aria-hidden="true">{i + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
