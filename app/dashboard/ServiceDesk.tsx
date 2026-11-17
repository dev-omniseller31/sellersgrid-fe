"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../api";
import styles from "./ServiceDesk.module.css";

type Service = { id: string; group: string; name: string; description: string };
type Package = { name: string; markets: string; catalog: number; images: number; banners: number; videos: number; infographics: number };
type Catalog = { services: Service[]; markets: string[]; statuses: string[]; packages: Package[] };
type Member = { role: string; user: { id: string; name: string } };
type RequestItem = { id: string; service: string; title: string; brief: string; quantity: number; marketplace: string; status: string; assigneeId: string | null; revision: number; createdAt: string; createdById: string };
type Detail = RequestItem & { updates: { id: string; authorId: string; body: string; status: string; createdAt: string }[] };
type Page = { items: RequestItem[]; total: number; page: number };
const human = (s: string) => s.toLowerCase().replaceAll("_", " ");

export default function ServiceDesk({ role }: { role: string }) {
  const [catalog, setCatalog] = useState<Catalog>();
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<Page>({ items: [], total: 0, page: 1 });
  const [tab, setTab] = useState("Services");
  const [group, setGroup] = useState("All services");
  const [selected, setSelected] = useState<Service>();
  const [detail, setDetail] = useState<Detail>();
  const [packageName, setPackageName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const canEdit = role !== "VIEWER";
  const canManage = ["OWNER", "ADMIN"].includes(role);

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) { window.location.assign("/login"); return; }
    setError(e instanceof Error ? e.message : "Unable to complete request");
  };
  const loadPage = useCallback(async (page = 1) => {
    setRequests(await api<Page>(`/service-desk/requests?page=${page}`));
  }, []);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [data, team] = await Promise.all([api<Catalog>("/service-desk/catalog"), api<Member[]>("/service-desk/members")]);
      setCatalog(data); setMembers(team); await loadPage();
    } catch (e) { fail(e); } finally { setLoading(false); }
  }, [loadPage]);
  useEffect(() => { void load(); }, [load]);

  async function openRequest(id: string) {
    setBusy(true); setError(""); setNotice("");
    try { setDetail(await api<Detail>(`/service-desk/requests/${id}`)); setSelected(undefined); }
    catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError("");
    try {
      const record = await api<RequestItem>("/service-desk/requests", { method: "POST", body: JSON.stringify({ ...fields, service: selected.id, quantity: Number(fields.quantity) }) });
      setSelected(undefined); setTab("Requests"); setPackageName(""); await loadPage();
      setDetail({ ...record, updates: [] }); setNotice("Request saved. Your team can now review and assign it.");
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError("");
    try {
      await api(`/service-desk/requests/${detail.id}`, { method: "PATCH", body: JSON.stringify({ body: fields.body, revision: detail.revision, ...(canManage ? { status: fields.status, assigneeId: fields.assigneeId || null } : {}) }) });
      setDetail(await api<Detail>(`/service-desk/requests/${detail.id}`)); await loadPage(requests.page);
      setNotice("Update saved.");
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  const name = (id: string | null) => members.find(m => m.user.id === id)?.user.name ?? (id ? "Former workspace member" : "Unassigned");
  function choose(service: Service, pack = "") {
    setSelected(service); setPackageName(pack); setDetail(undefined); setError(""); setNotice("");
  }
  if (loading) return <section className={styles.root} aria-busy="true"><p>Loading your service workspace…</p></section>;
  if (!catalog) return <section className={styles.root}><p role="alert">{error}</p><button className="secondary" onClick={() => void load()}>Retry services</button></section>;

  return <section className={styles.root} aria-label="Managed services">
    <div className={styles.hero}><div><span className={styles.kicker}>YOUR TEAM, CONNECTED</span><h2>From a brief<br/>to a better storefront.</h2><p>Creative work, seller operations and growth support.<br/>One place to request, coordinate and review delivery.</p></div><div className={styles.heroAside}><strong>{requests.total}</strong><span>requests in your workspace</span><small>Human-led services. Progress recorded by your team.</small></div></div>
    <nav className={styles.tabs} aria-label="Service workspace views">{["Services", "Requests", "Packages"].map(t => <button key={t} aria-pressed={tab === t} onClick={() => { setTab(t); setSelected(undefined); setDetail(undefined); }}>{t}</button>)}</nav>
    {error && <div className={styles.error} role="alert">{error} <button type="button" onClick={() => detail ? void openRequest(detail.id) : void load()}>Refresh data</button></div>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {!canEdit && <p className={styles.hint}>Your viewer role can read requests. An editor can submit a brief.</p>}

    {selected ? <section className={styles.panel}>
      <div className={styles.heading}><div><span className={styles.kicker}>NEW REQUEST</span><h3>{selected.name}</h3></div><button className="secondary" disabled={busy} onClick={() => setSelected(undefined)}>Cancel</button></div>
      <p>{selected.description}</p><p className={styles.hint}>Include SKU / FSN or order references and links to approved assets. Do not include passwords, API tokens or customer payment details.</p>
      <form key={selected.id + packageName} onSubmit={create} className={styles.form}>
        <label>Request title<input autoFocus name="title" required minLength={3} maxLength={140} defaultValue={packageName ? `${packageName} package consultation` : ""} placeholder="e.g. Update product images for summer collection"/></label>
        <div className={styles.formRow}><label>Marketplace<select name="marketplace">{catalog.markets.map(m => <option key={m} value={m}>{m === "GENERAL" ? "General / multiple marketplaces" : human(m)}</option>)}</select></label><label>Quantity / deliverables<input name="quantity" type="number" min={1} max={1000} defaultValue={1} required/></label></div>
        <label>Brief and requirements<textarea name="brief" rows={6} required minLength={10} maxLength={6000} defaultValue={packageName ? `Please review the ${packageName} reference package and confirm the scope, price, availability and service period.` : ""} placeholder="Describe your goal, product references, preferred date/time, timezone and expected deliverables."/></label>
        <p className={styles.hint}>Submitting creates a tracked request. It does not charge your account, launch an ad or contact a marketplace.</p>
        <button className="primary" disabled={busy || !canEdit}>{busy ? "Saving…" : "Submit request"}</button>
      </form>
    </section> : detail ? <section className={styles.panel}>
      <div className={styles.heading}><div><span className={styles.kicker}>REQUEST {detail.id.slice(0, 8)}</span><h3>{detail.title}</h3></div><button className="secondary" disabled={busy} onClick={() => setDetail(undefined)}>Back to requests</button></div>
      <div className={styles.meta}><span className={styles.badge}>{human(detail.status)}</span><span>{human(detail.marketplace)}</span><span>{detail.quantity} deliverables</span><span>Assigned: {name(detail.assigneeId)}</span></div>
      <p className={styles.brief}>{detail.brief}</p>
      {canEdit && <form key={detail.id + detail.revision} onSubmit={update} className={styles.form}>
        {canManage && <div className={styles.formRow}><label>Progress<select name="status" defaultValue={detail.status}>{catalog.statuses.map(s => <option key={s} value={s}>{human(s)}</option>)}</select></label><label>Assigned team member<select name="assigneeId" defaultValue={detail.assigneeId ?? ""}><option value="">Unassigned</option>{members.filter(m => m.role !== "VIEWER").map(m => <option key={m.user.id} value={m.user.id}>{m.user.name} ({human(m.role)})</option>)}</select></label></div>}
        <label>Progress note / delivery details<textarea name="body" rows={4} required minLength={3} maxLength={4000} placeholder="Add a question, a delivery link or explain this status change."/></label>
        <button className="primary" disabled={busy}>{busy ? "Saving…" : "Save update"}</button>
      </form>}
      <h4>Activity & delivery notes</h4><p className={styles.hint}>Most recent 100 updates. Links are displayed as text; open only trusted destinations.</p>
      <ol className={styles.timeline}>{detail.updates.map(u => <li key={u.id}><div><strong>{name(u.authorId)}</strong><span>{human(u.status)} · {new Date(u.createdAt).toLocaleString()}</span></div><p>{u.body}</p></li>)}<li><strong>{name(detail.createdById)} submitted this request</strong><p>{new Date(detail.createdAt).toLocaleString()}</p></li></ol>
    </section> : tab === "Services" ? <>
      <div className={styles.filters} aria-label="Filter service category">{["All services", ...new Set(catalog.services.map(s => s.group))].map(g => <button key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}</div>
      <div className={styles.grid}>{catalog.services.filter(s => group === "All services" || s.group === group).map((s, i) => <article className={styles.card} key={s.id}><span className={styles.serviceNumber}>{String(i + 1).padStart(2, "0")}</span><small>{s.group}</small><h3>{s.name}</h3><p>{s.description}</p><button className="secondary" disabled={!canEdit} onClick={() => choose(s)}>Create brief <span aria-hidden="true">↗</span></button></article>)}</div>
      <p className={styles.hint}>Shopsy and Meesho are supported as service-request destinations, not automated publishing connectors. Calling, WhatsApp, AI production and webinar delivery are coordinated by your team.</p>
    </> : tab === "Requests" ? <section className={styles.panel}>
      <div className={styles.heading}><div><h3>Your service requests</h3><p>{requests.total} total · newest first</p></div><button className="secondary" disabled={busy} onClick={() => { setBusy(true); void loadPage(requests.page).catch(fail).finally(() => setBusy(false)); }}>Refresh</button></div>
      {requests.items.length === 0 ? <div className={styles.empty}><h3>A clear brief is the first step.</h3><p>Your requests and delivery history will appear here.</p><button className="primary" onClick={() => setTab("Services")}>Explore services</button></div> : <div className={styles.requestList}>{requests.items.map(r => <button key={r.id} className={styles.request} disabled={busy} onClick={() => void openRequest(r.id)}><div><strong>{r.title}</strong><small>{catalog.services.find(s => s.id === r.service)?.name ?? r.service} · {human(r.marketplace)}</small></div><span className={styles.badge}>{human(r.status)}</span><small>{name(r.assigneeId)}</small><span aria-hidden="true">→</span></button>)}</div>}
      <div className={styles.pagination}><button className="secondary" disabled={busy || requests.page <= 1} onClick={() => { setBusy(true); void loadPage(requests.page - 1).catch(fail).finally(() => setBusy(false)); }}>Previous</button><span>Page {requests.page} of {Math.max(1, Math.ceil(requests.total / 20))}</span><button className="secondary" disabled={busy || requests.page * 20 >= requests.total} onClick={() => { setBusy(true); void loadPage(requests.page + 1).catch(fail).finally(() => setBusy(false)); }}>Next</button></div>
    </section> : <>
      <div className={styles.heading}><div><h3>A service package for your next stage</h3><p>Reference scopes inspired by your service matrix. Request a quote to agree on pricing and delivery.</p></div></div>
      <div className={styles.grid}>{catalog.packages.map(pack => <article className={styles.package} key={pack.name}><span className={styles.kicker}>60-DAY REFERENCE SCOPE</span><h3>{pack.name}</h3><p>{pack.markets}</p><dl>{[["Catalog creations", pack.catalog], ["Image edits", pack.images], ["Banner designs", pack.banners], ["AI videos", pack.videos], ["Infographic callouts", pack.infographics]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not included"}</dd></div>)}</dl><button className="primary" disabled={!canEdit} onClick={() => choose(catalog.services.find(s => s.id === "PACKAGE")!, pack.name)}>Request {pack.name} quote</button></article>)}</div>
      <p className={styles.hint}>These are proposed service quantities, not active entitlements. Package requests do not change your SaaS plan. Staff availability, marketplace access, support hours, taxes and pricing must be confirmed in a quote. Duplicate manager/calling rows in the reference are consolidated.</p>
    </>}
  </section>;
}
