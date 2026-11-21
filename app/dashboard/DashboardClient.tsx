"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "../api";
import ServiceDesk from "./ServiceDesk";

/* ── Types ──────────────────────────────────────────────────────── */
type Me = { user: { id: string; name: string; email: string }; organization: { id: string; name: string; plan: string }; role: string };
type Store = { id: string; marketplace: string; name: string; externalAccountId?: string; status: string; lastSyncAt?: string; _count: { listings: number; orders: number } };
type Product = { id: string; name: string; sku: string; description: string; brand?: string; category: string; price: string; stock: number; status: string; attributes?: Record<string, unknown>; images: { id: string; mimeType: string }[]; listings: { id: string; status: string; externalId?: string; errorMessage?: string; store: { id: string; name: string; marketplace: string } }[] };
type Job = { id: string; status: string; attempt: number; errorMessage?: string; createdAt: string; product: { name: string; sku: string }; store: { name: string; marketplace: string } };
type Order = { id: string; externalId: string; status: string; customerName: string; total: string; currency: string; orderedAt: string; store: { name: string; marketplace: string } };
type Dashboard = { sales: number; orders: number; products: number; listings: number; stores: number; needsAttention: number };
type View = "Overview" | "Catalog" | "Listings" | "Inventory" | "Orders" | "Returns" | "Profitability" | "Channels" | "Sync activity" | "Settings";

const PRIMARY_NAV: View[] = ["Overview", "Catalog", "Listings", "Inventory", "Orders", "Returns"];
const INSIGHT_NAV: View[] = ["Profitability", "Channels", "Sync activity"];
const NAV_ICONS: Record<View, string> = {
  Overview: "▦", Catalog: "◻", Listings: "≡", Inventory: "▤", Orders: "⊡", Returns: "↩",
  Profitability: "▲", Channels: "⌁", "Sync activity": "↻", Settings: "⚙",
};

const MKT: Record<string, { short: string; label: string; color: string; bg: string }> = {
  AMAZON:   { short: "AZ", label: "Amazon India", color: "#e47911", bg: "#fff4df" },
  FLIPKART: { short: "FK", label: "Flipkart",     color: "#2874f0", bg: "#e8f0ff" },
  MYNTRA:   { short: "MY", label: "Myntra",       color: "#ff3f6c", bg: "#fff0f3" },
  SHOPIFY:  { short: "SH", label: "Shopify",      color: "#3c9b5e", bg: "#e9f9ef" },
  EBAY:     { short: "EB", label: "eBay",         color: "#527bd9", bg: "#eaf1ff" },
};
function mktInfo(mp: string) {
  return MKT[mp.toUpperCase()] ?? { short: mp.slice(0, 2).toUpperCase(), label: mp, color: "#666", bg: "#eee" };
}
function money(v: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
}
function csvDownload(filename: string, content: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

/* ═══════════════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════════════ */
export default function DashboardClient() {
  const [active, setActive] = useState<View>("Overview");
  const [me, setMe] = useState<Me>();
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"product" | "connect" | "publish" | null>(null);
  const [editing, setEditing] = useState<Product | undefined>();
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [m, d, p, s, j, o] = await Promise.all([
        api<Me>("/auth/me"),
        api<Dashboard>("/dashboard"),
        api<Product[]>("/products"),
        api<Store[]>("/stores"),
        api<Job[]>("/publish-jobs"),
        api<Order[]>("/orders"),
      ]);
      setMe(m); setDashboard(d); setProducts(p); setStores(s); setJobs(j); setOrders(o); setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { window.location.assign("/login"); return; }
      setError(e instanceof Error ? e.message : "Unable to load workspace");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Global ⌘K / Ctrl+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) : products;
  }, [products, search]);

  const openProduct = (p?: Product) => { setEditing(p); setModal("product"); };

  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    window.location.assign("/login");
  }

  async function archive(p: Product) {
    if (!window.confirm(`Archive "${p.name}"? It will be hidden from all channels.`)) return;
    await api(`/products/${p.id}`, { method: "DELETE" });
    notify("Product archived");
    await load();
  }

  async function adjustStock(p: Product) {
    const value = window.prompt(`New stock quantity for "${p.name}"`, String(p.stock));
    if (value === null) return;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) { notify("Stock must be a whole number, zero or more"); return; }
    await api(`/products/${p.id}/inventory`, { method: "PATCH", body: JSON.stringify({ stock: n }) });
    notify("Inventory updated");
    await load();
  }

  if (!me) {
    return (
      <div className="loadingScreen">
        <div>
          <span className="brandMark" aria-hidden="true"><i /><i /><i /><i /></span>
          <p>{error || "Opening your SellersGrid workspace…"}</p>
          {error && <button className="primary" onClick={() => void load()}>Retry</button>}
        </div>
      </div>
    );
  }

  const initials = me.user.name.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();
  const failedJobs = jobs.filter(j => j.status === "FAILED");
  const unfulfilledOrders = orders.filter(o => o.status === "UNFULFILLED");

  return (
    <main className="shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="brandName">SellersGrid</span>
        </div>

        <div className="workspace">
          <span className="avatar storeAvatar">{me.organization.name.slice(0, 2).toUpperCase()}</span>
          <span>
            <strong>{me.organization.name}</strong>
            <small className="planLabel">{me.organization.plan.charAt(0).toUpperCase() + me.organization.plan.slice(1).toLowerCase()} plan</small>
          </span>
          <button className="chevronBtn" aria-label="Workspace settings" title="Workspace settings" onClick={() => setActive("Settings")}>›</button>
        </div>

        <nav aria-label="Main navigation">
          {PRIMARY_NAV.map(item => (
            <button key={item} className={`navBtn${active === item ? " active" : ""}`} onClick={() => setActive(item)}>
              <span className="navIcon" aria-hidden="true">{NAV_ICONS[item]}</span>
              <span>{item}</span>
              {item === "Orders" && unfulfilledOrders.length > 0 && <b className="navBadge">{unfulfilledOrders.length}</b>}
              {item === "Listings" && failedJobs.length > 0 && <b className="navBadge">{failedJobs.length}</b>}
            </button>
          ))}
          <p className="navEyebrow">INSIGHT AND SETUP</p>
          {INSIGHT_NAV.map(item => (
            <button key={item} className={`navBtn${active === item ? " active" : ""}`} onClick={() => setActive(item)}>
              <span className="navIcon" aria-hidden="true">{NAV_ICONS[item]}</span>
              <span>{item}</span>
            </button>
          ))}
        </nav>

        <div className="sidebarSpacer" />

        <button className={`navBtn settingsNavBtn${active === "Settings" ? " active" : ""}`} onClick={() => setActive("Settings")}>
          <span className="navIcon" aria-hidden="true">⚙</span>
          <span>Settings</span>
        </button>

        <div className="planCard">
          <div className="planCardLabel">Products</div>
          <div className="planMeter" role="progressbar" aria-valuenow={dashboard?.products ?? 0} aria-valuemax={2000} aria-label="Product usage">
            <div className="planMeterFill" style={{ width: `${Math.min(100, (dashboard?.products ?? 0) / 2000 * 100)}%` }} />
          </div>
          <div className="planCardCount">{(dashboard?.products ?? 0).toLocaleString("en-IN")} of 2,000</div>
          <button className="manageBtn" onClick={() => setActive("Settings")}>Manage plan</button>
        </div>

        <div className="profile">
          <span className="avatar">{initials}</span>
          <span>
            <strong>{me.user.name}</strong>
            <small>{me.role.charAt(0) + me.role.slice(1).toLowerCase()}</small>
          </span>
          <button className="signOutBtn" aria-label="Sign out" title="Sign out" onClick={() => void logout()}>⏻</button>
        </div>
      </aside>

      {/* ── Content ── */}
      <section className="content">
        <header className="topbar">
          <div className="searchWrap">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="6" /><path d="M13.5 13.5 18 18" />
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products, SKUs, orders"
              aria-label="Search"
            />
            <kbd aria-label="Keyboard shortcut">⌘K</kbd>
          </div>

          <div className="topbarRight">
            <button className="channelsBadge" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }} onClick={() => setActive("Channels")} aria-label="Go to Channels">
              <i className="dot green" />
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{stores.filter(s => s.status === "CONNECTED").length} channels connected</span>
            </button>

            {/* Notifications */}
            <div style={{ position: "relative" }}>
              <button className="iconBtn" aria-label="Notifications" onClick={() => { setNotifOpen(v => !v); setHelpOpen(false); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {failedJobs.length > 0 && <i className="notifDot" />}
              </button>
              {notifOpen && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 280, background: "white", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 8px 30px rgba(35,16,56,.15)", zIndex: 50, overflow: "hidden" }}>
                  <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 12 }}>Notifications</div>
                  {failedJobs.length === 0
                    ? <p style={{ padding: "14px", fontSize: 12, color: "var(--muted)", margin: 0 }}>All clear — no issues.</p>
                    : failedJobs.slice(0, 5).map(j => (
                        <div key={j.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
                          <strong style={{ display: "block" }}>{j.product.name}</strong>
                          <span style={{ color: "var(--red)", fontSize: 11 }}>{j.errorMessage ?? "Failed"}</span>
                        </div>
                      ))
                  }
                  <button style={{ display: "block", width: "100%", padding: "10px 14px", background: "none", border: "none", textAlign: "left", fontSize: 12, color: "var(--purple-brand)", fontWeight: 600, cursor: "pointer" }} onClick={() => { setActive("Listings"); setNotifOpen(false); }}>View all in Listings →</button>
                </div>
              )}
            </div>

            {/* Help */}
            <div style={{ position: "relative" }}>
              <button className="iconBtn" aria-label="Help" onClick={() => { setHelpOpen(v => !v); setNotifOpen(false); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>
              {helpOpen && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 240, background: "white", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 8px 30px rgba(35,16,56,.15)", zIndex: 50, padding: 16 }}>
                  <strong style={{ display: "block", fontSize: 12, marginBottom: 6 }}>Need help?</strong>
                  <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 10px" }}>Email us and we&apos;ll get back to you within one business day.</p>
                  <a href="mailto:support@sellersgrid.com" style={{ fontSize: 12, color: "var(--purple-brand)", fontWeight: 600, textDecoration: "none" }}>support@sellersgrid.com</a>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page" onClick={() => { setNotifOpen(false); setHelpOpen(false); }}>
          {error && (
            <div className="errorBanner" role="alert">
              <span>{error}</span>
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}

          {active === "Overview"      && <Overview me={me} data={dashboard} products={products} stores={stores} jobs={jobs} orders={orders} go={setActive} openProduct={() => openProduct()} notify={notify} />}
          {active === "Catalog"       && <CatalogPage products={visibleProducts} allProducts={products} edit={openProduct} archive={archive} stock={adjustStock} addProduct={() => openProduct()} openPublish={() => setModal("publish")} notify={notify} />}
          {active === "Listings"      && <ListingsPage jobs={jobs} notify={notify} reload={load} retry={async id => { await api(`/publish-jobs/${id}/retry`, { method: "POST" }); notify("Retry queued"); await load(); }} />}
          {active === "Inventory"     && <InventoryPage products={products} stores={stores} notify={notify} reload={load} />}
          {active === "Orders"        && <OrdersPage orders={orders} notify={notify} reload={load} update={async (id, status) => { await api(`/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); notify("Order updated"); await load(); }} />}
          {active === "Returns"       && <ReturnsPage notify={notify} />}
          {active === "Profitability" && <ProfitabilityPage notify={notify} />}
          {active === "Channels"      && <ChannelsPage stores={stores} connect={() => setModal("connect")} reload={load} notify={notify} go={setActive} />}
          {active === "Sync activity" && <SyncActivityPage jobs={jobs} stores={stores} go={setActive} notify={notify} reload={load} />}
          {active === "Settings"      && <SettingsPage me={me} saved={async () => { notify("Settings saved"); await load(); }} notify={notify} />}
        </div>
      </section>

      {/* ── Modals ── */}
      {modal && (
        <Modal title={modal} close={() => { setModal(null); setEditing(undefined); }}>
          {modal === "product" && (
            <ProductForm product={editing} saved={async () => { setModal(null); setEditing(undefined); notify(editing ? "Product updated" : "Product created"); await load(); }} />
          )}
          {modal === "connect" && (
            <ConnectForm saved={async () => { setModal(null); notify("Channel connected"); await load(); }} />
          )}
          {modal === "publish" && (
            <PublishForm products={products} stores={stores.filter(s => s.status === "CONNECTED")} done={async () => { setModal(null); setActive("Listings"); notify("Publishing jobs queued"); await load(); }} />
          )}
        </Modal>
      )}

      {toast && <div className="toast" role="status" aria-live="polite"><span>✓</span>{toast}</div>}
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   OVERVIEW
═══════════════════════════════════════════════════════════════════ */
function Overview({ me, data, products, stores, jobs, orders, go, openProduct, notify }: {
  me: Me; data?: Dashboard; products: Product[]; stores: Store[]; jobs: Job[]; orders: Order[];
  go: (v: View) => void; openProduct: () => void; notify: (m: string) => void;
}) {
  const [period, setPeriod] = useState("Last 30 days");
  const [periodOpen, setPeriodOpen] = useState(false);
  const periods = ["Last 7 days", "Last 30 days", "Last 90 days"];
  const firstName = me.user.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const setupSteps = [
    { done: true,                             title: "Create your account",        sub: `Signed up as ${me.user.email}` },
    { done: true,                             title: "Tell us what you sell",       sub: "Categories and GSTIN verified" },
    { done: stores.some(s => s.marketplace === "AMAZON"),  title: "Connect Amazon India",  sub: "Connected as your Amazon seller account", action: "Connect", onClick: () => go("Channels") },
    { done: jobs.some(j => j.status === "COMPLETED"),      title: "Review imported listings", sub: "Check which listings were matched by SKU.", action: "Review", onClick: () => go("Listings") },
    { done: stores.some(s => s.marketplace === "FLIPKART"), title: "Connect Flipkart",        sub: "Approve access in Flipkart Seller Hub.",   action: "Connect", onClick: () => go("Channels") },
    { done: false, title: "Turn on stock sync",    sub: "Check how stock is shared between channels.", action: "Review", onClick: () => go("Inventory") },
    { done: false, title: "Publish your first product", sub: "Add a product once and list it everywhere.", action: "Add product", onClick: openProduct },
  ];
  const doneCount = setupSteps.filter(s => s.done).length;
  const allDone = doneCount >= setupSteps.length;

  if (!allDone) {
    return (
      <div className="overviewSetup">
        <div>
          <h1 className="pageTitle">Welcome, {firstName}</h1>
          <p className="pageSub">A few more steps and you can manage every marketplace from here.</p>
          <div className="setupCard">
            <div className="setupCardHeader">
              <span>Set up SellersGrid</span>
              <div className="setupProgress"><div className="setupProgressFill" style={{ width: `${doneCount / setupSteps.length * 100}%` }} /></div>
              <small>{doneCount} of {setupSteps.length} done</small>
            </div>
            <ol className="setupSteps">
              {setupSteps.map((step, i) => (
                <li key={i} className={`setupStep${step.done ? " done" : ""}`}>
                  <span className="stepCircle">{step.done ? "✓" : i + 1}</span>
                  <div className="stepBody"><strong>{step.title}</strong><p>{step.sub}</p></div>
                  {!step.done && step.action && (
                    <button className={i <= 2 ? "primary small" : "secondary small"} onClick={step.onClick}>{step.action}</button>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div className="metricStrip">
            {[
              { label: "Sales, last 30 days",  value: data?.sales ? money(data.sales) : "—",          sub: data?.sales ? "" : "Appears once payouts finish importing" },
              { label: "Orders, last 30 days",  value: (data?.orders ?? 0).toLocaleString("en-IN"),    sub: "All channels" },
              { label: "Live listings",         value: (data?.listings ?? 0).toLocaleString("en-IN"), sub: `${stores.length} channel${stores.length !== 1 ? "s" : ""} connected` },
              { label: "Products in catalog",   value: (data?.products ?? 0).toLocaleString("en-IN"), sub: "Active products" },
            ].map(m => (
              <div key={m.label} className="metricStripItem">
                <small>{m.label}</small>
                <strong>{m.value}</strong>
                {m.sub && <span>{m.sub}</span>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="helpCard">
            <strong>Want help getting set up?</strong>
            <p>Book a 20-minute call and we&apos;ll connect your channels and map your catalog with you.</p>
            <button className="publishButton" onClick={() => window.open("mailto:support@sellersgrid.com?subject=Setup help", "_blank")}>Book a call</button>
          </div>
        </div>
      </div>
    );
  }

  const attentionItems = [
    ...(jobs.filter(j => j.status === "FAILED").length > 0 ? [{ color: "red",   title: `${jobs.filter(j => j.status === "FAILED").length} listings failed`,         sub: "Check errors and retry from the Listings page.",       action: "Fix",         onClick: () => go("Listings") }] : []),
    ...(orders.filter(o => o.status === "UNFULFILLED").length > 0 ? [{ color: "amber", title: `${orders.filter(o => o.status === "UNFULFILLED").length} orders need packing`, sub: "Mark them as processing when you hand them to courier.", action: "View orders", onClick: () => go("Orders") }] : []),
    ...(products.filter(p => p.stock === 0).length > 0 ? [{ color: "amber", title: `${products.filter(p => p.stock === 0).length} products out of stock`,             sub: "Update stock to make them visible again.",              action: "Review",      onClick: () => go("Inventory") }] : []),
  ];

  return (
    <div>
      <div className="overviewHeader">
        <div>
          <h1 className="pageTitle">{greeting}, {firstName}</h1>
          <p className="pageSub">How your channels are doing.</p>
        </div>
        <div className="overviewHeaderRight">
          <div style={{ position: "relative" }}>
            <button className="secondary" onClick={() => setPeriodOpen(v => !v)}>{period} ▾</button>
            {periodOpen && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "white", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 0", minWidth: 160, zIndex: 20 }}>
                {periods.map(p => (
                  <button key={p} style={{ display: "block", width: "100%", padding: "8px 14px", background: "none", border: "none", textAlign: "left", fontSize: 12, cursor: "pointer", color: period === p ? "var(--purple-brand)" : "var(--ink)", fontWeight: period === p ? 700 : 400 }} onClick={() => { setPeriod(p); setPeriodOpen(false); }}>{p}</button>
                ))}
              </div>
            )}
          </div>
          <button className="publishButton" onClick={openProduct}>+ Add product</button>
        </div>
      </div>

      <div className="metricsRow">
        {[
          { label: "Gross sales",    value: money(data?.sales ?? 0),                   delta: `${period}`, clickable: false },
          { label: "Orders",         value: (data?.orders ?? 0).toLocaleString("en-IN"), delta: `${period}`, clickable: false },
          { label: "Live listings",  value: (data?.listings ?? 0).toLocaleString("en-IN"), delta: `${stores.length} channels`, clickable: false },
          { label: "Active products", value: (data?.products ?? 0).toLocaleString("en-IN"), delta: "in catalog", clickable: false },
        ].map(m => (
          <div key={m.label} className="metricCard">
            <small>{m.label}</small>
            <strong>{m.value}</strong>
            <span className="metricDelta">{m.delta}</span>
          </div>
        ))}
      </div>

      <div className="dashGrid">
        <div>
          {attentionItems.length > 0 && (
            <div className="attentionPanel">
              <div className="attentionHeader">
                <strong>Needs your attention</strong>
                <span className="attentionCount">{attentionItems.length}</span>
              </div>
              {attentionItems.map((item, i) => (
                <div key={i} className="attentionItem">
                  <span className={`attentionDot ${item.color}`} />
                  <div><strong>{item.title}</strong><p>{item.sub}</p></div>
                  <button className="secondary small" onClick={item.onClick}>{item.action}</button>
                </div>
              ))}
            </div>
          )}

          <div className="topProductsPanel">
            <div className="panelHeader">
              <strong>Top products by sales</strong>
              <button className="linkBtn" onClick={() => go("Profitability")}>See profitability →</button>
            </div>
            {products.length === 0
              ? <p style={{ color: "var(--muted)", fontSize: 12, padding: "8px 0" }}>No products yet. Add your first product to get started.</p>
              : (
                <table className="sgTable">
                  <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Listings</th><th>Status</th></tr></thead>
                  <tbody>
                    {products.slice(0, 5).map(p => {
                      const init = p.name.slice(0, 2).toUpperCase();
                      const published = p.listings.filter(l => l.status === "PUBLISHED").length;
                      const failed = p.listings.filter(l => l.status === "FAILED").length;
                      return (
                        <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => go("Catalog")}>
                          <td><div className="productCell"><span className="productInit">{init}</span><span><strong>{p.name}</strong></span></div></td>
                          <td><small className="mutedText">{p.sku}</small></td>
                          <td className={p.stock === 0 ? "redText" : p.stock < 10 ? "amberText" : ""}>{p.stock}</td>
                          <td>{published} live{failed > 0 ? `, ${failed} failed` : ""}</td>
                          <td><span className={`statusPill ${p.status === "ACTIVE" ? "ready" : "issue"}`}>{p.status.toLowerCase()}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
        </div>

        <div className="channelsSidebar">
          <div className="panelHeader">
            <strong>Channels</strong>
            <button className="linkBtn" onClick={() => go("Channels")}>Manage →</button>
          </div>
          {stores.length === 0
            ? <p style={{ fontSize: 12, color: "var(--muted)" }}>No channels connected yet.</p>
            : stores.map(s => {
                const info = mktInfo(s.marketplace);
                const orderCount = s._count.orders;
                const pct = stores.length > 0 ? Math.round((orderCount / (stores.reduce((a, x) => a + x._count.orders, 0) || 1)) * 100) : 0;
                return (
                  <div key={s.id} className="channelSideCard">
                    <span className="channelSideInit" style={{ background: info.bg, color: info.color }}>{info.short}</span>
                    <div className="channelSideBody">
                      <div className="channelSideRow"><strong>{s.name}</strong><span>{s._count.listings} listings</span></div>
                      <div className="channelSideBar"><div style={{ width: `${pct}%`, background: info.color }} /></div>
                      <div className="channelSideRow">
                        <small className="mutedText">{s.status === "CONNECTED" ? "Healthy" : s.status.toLowerCase()}</small>
                        <small className="mutedText">{s._count.orders} orders</small>
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CATALOG
═══════════════════════════════════════════════════════════════════ */
function CatalogPage({ products, allProducts, edit, archive, stock, addProduct, openPublish, notify }: {
  products: Product[]; allProducts: Product[];
  edit: (p: Product) => void; archive: (p: Product) => void; stock: (p: Product) => void;
  addProduct: () => void; openPublish: () => void; notify: (m: string) => void;
}) {
  const [tab, setTab] = useState("All");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const PAGE = 8;
  const fileRef = useRef<HTMLInputElement>(null);

  const tabCounts = useMemo(() => ({
    All: allProducts.length,
    "Needs attention": allProducts.filter(p => p.listings.some(l => l.status === "FAILED")).length,
    "Low stock": allProducts.filter(p => p.stock > 0 && p.stock < 10).length,
    Drafts: allProducts.filter(p => p.status === "DRAFT").length,
    Archived: 0,
  }), [allProducts]);

  const filtered = useMemo(() => {
    const sq = q.trim().toLowerCase();
    let list = allProducts;
    if (tab === "Needs attention") list = list.filter(p => p.listings.some(l => l.status === "FAILED"));
    else if (tab === "Low stock") list = list.filter(p => p.stock > 0 && p.stock < 10);
    else if (tab === "Drafts") list = list.filter(p => p.status === "DRAFT");
    if (sq) list = list.filter(p => p.name.toLowerCase().includes(sq) || p.sku.toLowerCase().includes(sq));
    return list;
  }, [allProducts, tab, q]);

  const paged = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const allChecked = paged.length > 0 && paged.every(p => selected.has(p.id));

  function toggleAll() {
    if (allChecked) { const s = new Set(selected); paged.forEach(p => s.delete(p.id)); setSelected(s); }
    else { const s = new Set(selected); paged.forEach(p => s.add(p.id)); setSelected(s); }
  }
  function toggle(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  async function archiveSelected() {
    if (!window.confirm(`Archive ${selected.size} product${selected.size !== 1 ? "s" : ""}?`)) return;
    for (const id of selected) {
      const p = allProducts.find(x => x.id === id);
      if (p) await archive(p);
    }
    setSelected(new Set());
  }

  function exportCSV() {
    const rows = ["Name,SKU,Category,Price,Stock,Status", ...allProducts.map(p =>
      [p.name, p.sku, p.category, p.price, p.stock, p.status].map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")
    )].join("\n");
    csvDownload("sellersgrid-catalog.csv", rows);
    notify("Catalog exported");
  }

  const tabs = ["All", "Needs attention", "Low stock", "Drafts"];

  return (
    <div>
      <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={() => notify("CSV imported – bulk import coming soon")} />
      <div className="pageHeaderRow">
        <div>
          <h1 className="pageTitle">Catalog</h1>
          <p className="pageSub">{allProducts.length} product{allProducts.length !== 1 ? "s" : ""}. Edit once here and every channel updates.</p>
        </div>
        <div className="pageHeaderActions">
          <button className="secondary" onClick={() => fileRef.current?.click()}>Import CSV</button>
          <button className="secondary" onClick={exportCSV}>Export</button>
          <button className="publishButton" onClick={addProduct}>+ Add product</button>
        </div>
      </div>

      <div className="tabRow">
        {tabs.map(t => (
          <button key={t} className={`tabBtn${tab === t ? " active" : ""}`} onClick={() => { setTab(t); setPage(0); }}>
            {t} {tabCounts[t as keyof typeof tabCounts]}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="bulkBar">
          <span>{selected.size} selected</span>
          <button className="publishButton small" onClick={openPublish}>Publish to channels</button>
          <button className="secondary small" onClick={() => void archiveSelected()}>Archive selected</button>
          <button className="secondary small" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="catalogToolbar">
        <div className="searchWrap small" style={{ flex: 1, maxWidth: 360 }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" /><path d="M13.5 13.5 18 18" /></svg>
          <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Search by name, SKU, barcode or HSN" />
        </div>
      </div>

      <div className="sgTableWrap">
        <table className="sgTable">
          <thead>
            <tr>
              <th style={{ width: 32 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" /></th>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Channels</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0
              ? <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No products match</td></tr>
              : paged.map(p => {
                  const init = p.name.slice(0, 2).toUpperCase();
                  const hasFailed = p.listings.some(l => l.status === "FAILED");
                  return (
                    <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => edit(p)}>
                      <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
                      <td><div className="productCell"><span className="productInit">{init}</span><span><strong>{p.name}</strong><small>{p.sku}</small></span></div></td>
                      <td><small>{p.category}</small></td>
                      <td><strong>{money(Number(p.price))}</strong>{p.attributes && typeof p.attributes === "object" && "compareAtPrice" in p.attributes && <small className="mutedText">MRP {money(Number(p.attributes.compareAtPrice))}</small>}</td>
                      <td className={p.stock === 0 ? "redText" : p.stock < 10 ? "amberText" : ""}>{p.stock}</td>
                      <td>
                        <div className="mktDots">
                          {p.listings.map(l => {
                            const info = mktInfo(l.store.marketplace);
                            return <span key={l.id} className={`mktDot ${l.status === "PUBLISHED" ? "green" : l.status === "FAILED" ? "amber" : "gray"}`} title={`${info.label}: ${l.status}`}>{info.short}</span>;
                          })}
                        </div>
                      </td>
                      <td>
                        <span className={`statusPill ${hasFailed ? "issue" : p.status === "ACTIVE" ? "ready" : "issue"}`}>
                          {hasFailed ? "Issue" : p.status === "ACTIVE" ? "Ready" : p.status.toLowerCase()}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="secondary small" onClick={() => stock(p)}>Adjust stock</button>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      <div className="tableFooter">
        <div className="tableLegend">
          <span><i className="dot green" />Live</span>
          <span><i className="dot amber" />Issue</span>
          <span><i className="dot gray" />Not listed</span>
        </div>
        <div className="tablePagination">
          <button className="secondary small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span>Showing {page * PAGE + 1}–{Math.min((page + 1) * PAGE, filtered.length)} of {filtered.length}</span>
          <button className="secondary small" disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LISTINGS
═══════════════════════════════════════════════════════════════════ */
function ListingsPage({ jobs, notify, reload, retry }: { jobs: Job[]; notify: (m: string) => void; reload: () => Promise<void>; retry: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState("All");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const tabDefs = [
    { key: "All", label: "All" },
    { key: "COMPLETED", label: "Live" },
    { key: "FAILED", label: "Needs attention" },
    { key: "QUEUED", label: "Queued" },
  ];

  const filtered = useMemo(() => {
    const sq = q.trim().toLowerCase();
    let list = jobs;
    if (activeTab !== "All") list = list.filter(j => j.status === activeTab);
    if (sq) list = list.filter(j => j.product.name.toLowerCase().includes(sq) || j.store.name.toLowerCase().includes(sq) || j.product.sku.toLowerCase().includes(sq));
    return list;
  }, [jobs, activeTab, q]);

  const failedInView = filtered.filter(j => j.status === "FAILED");
  const selectedJob = filtered.find(j => j.id === selectedId) ?? null;

  async function retryAll() {
    setRetrying(true);
    notify(`Retrying ${failedInView.length} listing${failedInView.length !== 1 ? "s" : ""}…`);
    for (const j of failedInView) {
      try { await api(`/publish-jobs/${j.id}/retry`, { method: "POST" }); } catch { /* continue */ }
    }
    await reload();
    notify(`Resubmitted ${failedInView.length} listing${failedInView.length !== 1 ? "s" : ""}`);
    setRetrying(false);
  }

  return (
    <div className="listingsLayout">
      <div>
        <div className="pageHeaderRow">
          <div>
            <h1 className="pageTitle">Listings</h1>
            <p className="pageSub">Each product on each channel, with its status.</p>
          </div>
        </div>
        <div className="tabRow">
          {tabDefs.map(t => {
            const cnt = t.key === "All" ? jobs.length : jobs.filter(j => j.status === t.key).length;
            return <button key={t.key} className={`tabBtn${activeTab === t.key ? " active" : ""}`} onClick={() => setActiveTab(t.key)}>{t.label} {cnt}</button>;
          })}
        </div>
        <div className="catalogToolbar">
          <div className="searchWrap small" style={{ flex: 1, maxWidth: 360 }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" /><path d="M13.5 13.5 18 18" /></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by product, SKU or store" />
          </div>
        </div>
        <div className="sgTableWrap">
          <table className="sgTable">
            <thead><tr><th>Product</th><th>Channel</th><th>Attempts</th><th>Status</th><th>Error</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No listings found</td></tr>
                : filtered.map(j => (
                    <tr key={j.id} className={selectedId === j.id ? "selected" : ""} style={{ cursor: "pointer" }} onClick={() => setSelectedId(j.id === selectedId ? null : j.id)}>
                      <td><strong>{j.product.name}</strong><small className="mutedText">{j.product.sku}</small></td>
                      <td>{j.store.name}<small className="mutedText">{j.store.marketplace}</small></td>
                      <td>{j.attempt}</td>
                      <td>
                        <span className={`problemBadge ${j.status === "FAILED" ? "rejected" : j.status === "QUEUED" ? "amber" : j.status === "PROCESSING" ? "amber" : "gray"}`}>
                          {j.status === "COMPLETED" ? "Live" : j.status.toLowerCase()}
                        </span>
                      </td>
                      <td><small className="mutedText">{j.errorMessage ?? "—"}</small></td>
                      <td onClick={e => e.stopPropagation()}>
                        {j.status === "FAILED" && <button className="primary small" onClick={() => retry(j.id)}>Retry</button>}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="tableFooter"><span className="mutedText">Showing {filtered.length} of {jobs.length}</span></div>
        <div className="listingsActions">
          <button className="secondary" onClick={() => setSelectedId(null)}>Clear selection</button>
          {failedInView.length > 0 && (
            <button className="publishButton" disabled={retrying} onClick={() => void retryAll()}>
              {retrying ? "Retrying…" : `Resubmit ${failedInView.length} failed`}
            </button>
          )}
        </div>
      </div>

      <aside className="fixPanel">
        <div className="fixPanelHeader">
          <strong>{selectedJob ? "Listing detail" : "Fix listing"}</strong>
          {selectedJob && <small>{selectedJob.product.name} · {selectedJob.store.name}</small>}
          {selectedJob && <small className="mutedText">SKU: {selectedJob.product.sku}</small>}
          {!selectedJob && <small className="mutedText">Select a row to inspect</small>}
          <button className="iconBtn" style={{ position: "absolute", right: 8, top: 8 }} onClick={() => setSelectedId(null)} aria-label="Close">×</button>
        </div>
        {selectedJob ? (
          <>
            <div className={`fixIssue${selectedJob.status === "FAILED" ? " red" : ""}`}>
              <strong>Status: {selectedJob.status === "COMPLETED" ? "Live" : selectedJob.status.toLowerCase()}</strong>
              <p>{selectedJob.errorMessage ?? (selectedJob.status === "COMPLETED" ? "This listing is live on the marketplace." : "No additional details.")}</p>
              {selectedJob.status === "FAILED" && (
                <button className="primary small" style={{ marginTop: 8 }} onClick={() => retry(selectedJob.id)}>Retry this listing</button>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
              <strong>Queued:</strong> {new Date(selectedJob.createdAt).toLocaleString("en-IN")}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 11, color: "var(--muted)", padding: "8px 0" }}>Click any row to inspect it here.</p>
        )}
      </aside>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   INVENTORY
═══════════════════════════════════════════════════════════════════ */
function InventoryPage({ products, stores, notify, reload }: { products: Product[]; stores: Store[]; notify: (m: string) => void; reload: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState("All levels");
  const [filterOpen, setFilterOpen] = useState(false);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustVal, setAdjustVal] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const sq = q.trim().toLowerCase();
    let list = products;
    if (sq) list = list.filter(p => p.name.toLowerCase().includes(sq) || p.sku.toLowerCase().includes(sq));
    if (stockFilter === "Low stock") list = list.filter(p => p.stock > 0 && p.stock < 10);
    if (stockFilter === "Out of stock") list = list.filter(p => p.stock === 0);
    return list;
  }, [products, q, stockFilter]);

  async function saveAdjust() {
    if (!adjustingId) return;
    const n = Number(adjustVal);
    if (!Number.isInteger(n) || n < 0) { notify("Enter a valid whole number"); return; }
    setSaving(true);
    try {
      await api(`/products/${adjustingId}/inventory`, { method: "PATCH", body: JSON.stringify({ stock: n }) });
      notify("Inventory updated"); await reload(); setAdjustingId(null);
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="pageHeaderRow">
        <div><h1 className="pageTitle">Inventory</h1><p className="pageSub">One stock count per warehouse, shared across your channels.</p></div>
        <div className="pageHeaderActions">
          <div style={{ position: "relative" }}>
            <button className="secondary" onClick={() => setWarehouseOpen(v => !v)}>Bhiwandi Central Hub ▾</button>
            {warehouseOpen && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "white", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 0", minWidth: 200, zIndex: 20 }}>
                <button style={{ display: "block", width: "100%", padding: "8px 14px", background: "none", border: "none", textAlign: "left", fontSize: 12, cursor: "pointer", color: "var(--purple-brand)" }} onClick={() => setWarehouseOpen(false)}>✓ Bhiwandi Central Hub</button>
              </div>
            )}
          </div>
          <button className="secondary" onClick={() => notify("Stock count feature coming soon")}>Start a stock count</button>
        </div>
      </div>

      <div className="metricsRow">
        {[
          { label: "Units on hand",        value: products.reduce((s, p) => s + p.stock, 0).toLocaleString("en-IN"), color: "" },
          { label: "Products",             value: products.length.toString(),                                         color: "" },
          { label: "Low stock",            value: products.filter(p => p.stock > 0 && p.stock < 10).length.toString() + " products", color: "amber" },
          { label: "Out of stock",         value: products.filter(p => p.stock === 0).length.toString() + " products",               color: "red" },
        ].map(m => (
          <div key={m.label} className="metricCard">
            <small>{m.label}</small>
            <strong className={m.color ? `${m.color}Text` : ""}>{m.value}</strong>
          </div>
        ))}
      </div>

      <div className="stockShareBanner">
        <span className="stockShareIcon">❖</span>
        <div><strong>Stock sharing: pooled, with a buffer of 2</strong><p>Every channel shows all available units minus 2, so a sale on one channel can&apos;t oversell another.</p></div>
        <button className="secondary" onClick={() => notify("Stock sharing rules – feature coming soon")}>Change rules</button>
      </div>

      <div className="catalogToolbar">
        <div className="searchWrap small" style={{ flex: 1, maxWidth: 360 }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" /><path d="M13.5 13.5 18 18" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by product or SKU" />
        </div>
        <div style={{ position: "relative" }}>
          <button className="secondary small" onClick={() => setFilterOpen(v => !v)}>{stockFilter} ▾</button>
          {filterOpen && (
            <div style={{ position: "absolute", left: 0, top: "calc(100% + 4px)", background: "white", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 0", minWidth: 160, zIndex: 20 }}>
              {["All levels", "Low stock", "Out of stock"].map(o => (
                <button key={o} style={{ display: "block", width: "100%", padding: "8px 14px", background: "none", border: "none", textAlign: "left", fontSize: 12, cursor: "pointer", color: stockFilter === o ? "var(--purple-brand)" : "var(--ink)", fontWeight: stockFilter === o ? 700 : 400 }} onClick={() => { setStockFilter(o); setFilterOpen(false); }}>{o}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sgTableWrap">
        <table className="sgTable">
          <thead><tr><th>Product</th><th>SKU</th><th>On hand</th><th>Channels</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No products found</td></tr>
              : filtered.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td><small className="mutedText">{p.sku}</small></td>
                    <td>
                      {adjustingId === p.id
                        ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input type="number" min={0} value={adjustVal} onChange={e => setAdjustVal(e.target.value)} style={{ width: 72, border: "1px solid var(--purple-brand)", borderRadius: 6, padding: "4px 8px", fontSize: 12 }} autoFocus onKeyDown={e => { if (e.key === "Enter") void saveAdjust(); if (e.key === "Escape") setAdjustingId(null); }} />
                            <button className="primary small" disabled={saving} onClick={() => void saveAdjust()}>{saving ? "…" : "Save"}</button>
                            <button className="secondary small" onClick={() => setAdjustingId(null)}>Cancel</button>
                          </span>
                        : <span className={p.stock === 0 ? "redText" : p.stock < 10 ? "amberText" : ""}>{p.stock}</span>
                      }
                    </td>
                    <td>
                      <div className="mktDots">
                        {p.listings.map(l => { const info = mktInfo(l.store.marketplace); return <span key={l.id} className={`mktDot ${l.status === "PUBLISHED" ? "green" : "gray"}`} title={info.label}>{info.short}</span>; })}
                      </div>
                    </td>
                    <td>
                      {adjustingId !== p.id && <button className="secondary small" onClick={() => { setAdjustingId(p.id); setAdjustVal(String(p.stock)); }}>Adjust</button>}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <p className="tableNote">Channel columns show what each marketplace displays to buyers. A dash means the product isn&apos;t listed there.</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ORDERS
═══════════════════════════════════════════════════════════════════ */
function OrdersPage({ orders, notify, reload, update }: { orders: Order[]; notify: (m: string) => void; reload: () => Promise<void>; update: (id: string, status: string) => Promise<void> }) {
  const [tab, setTab] = useState("To pack");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortAsc, setSortAsc] = useState(false);
  const [channelFilter, setChannelFilter] = useState("All channels");
  const [channelOpen, setChannelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const statusMap: Record<string, string[]> = {
    "To pack": ["UNFULFILLED"],
    "Processing": ["PROCESSING"],
    "Shipped": ["FULFILLED"],
    "Cancelled": ["CANCELLED"],
  };

  const storeNames = useMemo(() => ["All channels", ...Array.from(new Set(orders.map(o => o.store.name)))], [orders]);

  const tabCounts = useMemo(() => ({
    "To pack": orders.filter(o => o.status === "UNFULFILLED").length,
    "Processing": orders.filter(o => o.status === "PROCESSING").length,
    "Shipped": orders.filter(o => o.status === "FULFILLED").length,
    "Cancelled": orders.filter(o => o.status === "CANCELLED").length,
  }), [orders]);

  const filtered = useMemo(() => {
    const statuses = statusMap[tab] ?? [];
    const sq = q.trim().toLowerCase();
    let list = orders.filter(o => statuses.includes(o.status));
    if (channelFilter !== "All channels") list = list.filter(o => o.store.name === channelFilter);
    if (sq) list = list.filter(o => o.externalId.toLowerCase().includes(sq) || o.customerName.toLowerCase().includes(sq));
    list = [...list].sort((a, b) => {
      const diff = new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime();
      return sortAsc ? diff : -diff;
    });
    return list;
  }, [orders, tab, q, sortAsc, channelFilter]);

  const allChecked = filtered.length > 0 && filtered.every(o => selected.has(o.id));
  function toggleAll() { if (allChecked) { const s = new Set(selected); filtered.forEach(o => s.delete(o.id)); setSelected(s); } else { const s = new Set(selected); filtered.forEach(o => s.add(o.id)); setSelected(s); } }
  function toggle(id: string) { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); }

  async function bulkUpdate(status: string, label: string) {
    if (selected.size === 0) return;
    setBusy(true);
    for (const id of selected) { try { await update(id, status); } catch { /* continue */ } }
    setSelected(new Set());
    notify(`${label} — ${selected.size} order${selected.size !== 1 ? "s" : ""} updated`);
    setBusy(false);
  }

  function exportCSV() {
    const rows = ["Order,Channel,Customer,Total,Status,Date",
      ...orders.map(o => [o.externalId, o.store.name, o.customerName, o.total, o.status, new Date(o.orderedAt).toLocaleDateString("en-IN")].map(v => `"${String(v).replaceAll('"', '""')}"`).join(","))
    ].join("\n");
    csvDownload("sellersgrid-orders.csv", rows);
    notify("Orders exported");
  }

  const tabs = ["To pack", "Processing", "Shipped", "Cancelled"];

  return (
    <div>
      <div className="pageHeaderRow">
        <div><h1 className="pageTitle">Orders</h1><p className="pageSub">Orders from every channel, in one queue.</p></div>
        <div className="pageHeaderActions">
          <button className="secondary" onClick={exportCSV}>Export</button>
          <button className="secondary" onClick={() => notify("Picklist printing – feature coming soon")}>Print picklist</button>
        </div>
      </div>

      {orders.filter(o => o.status === "UNFULFILLED").length > 0 && (
        <div className="urgentBanner">
          <span>⚠</span>
          <strong>{orders.filter(o => o.status === "UNFULFILLED").length} orders need packing</strong>
          <span>Mark them as processing when ready.</span>
          <button className="secondary small" onClick={() => setTab("To pack")}>Show these</button>
        </div>
      )}

      <div className="tabRow">
        {tabs.map(t => <button key={t} className={`tabBtn${tab === t ? " active" : ""}`} onClick={() => { setTab(t); setSelected(new Set()); }}>{t} {tabCounts[t as keyof typeof tabCounts]}</button>)}
      </div>

      {selected.size > 0 && (
        <div className="bulkBar">
          <span>{selected.size} selected</span>
          <button className="publishButton small" disabled={busy} onClick={() => void bulkUpdate("PROCESSING", "Marked as processing")}>{busy ? "…" : "Mark as processing"}</button>
          <button className="secondary small" disabled={busy} onClick={() => notify("Invoice printing – feature coming soon")}>Print invoices</button>
          <button className="secondary small" disabled={busy} onClick={() => void bulkUpdate("CANCELLED", "Cancelled")}>Cancel orders</button>
          <button className="secondary small" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="catalogToolbar">
        <div className="searchWrap small" style={{ flex: 1, maxWidth: 360 }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" /><path d="M13.5 13.5 18 18" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by order ID or customer name" />
        </div>
        <div style={{ position: "relative" }}>
          <button className="secondary small" onClick={() => setChannelOpen(v => !v)}>{channelFilter} ▾</button>
          {channelOpen && (
            <div style={{ position: "absolute", left: 0, top: "calc(100% + 4px)", background: "white", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 0", minWidth: 180, zIndex: 20 }}>
              {storeNames.map(n => <button key={n} style={{ display: "block", width: "100%", padding: "8px 14px", background: "none", border: "none", textAlign: "left", fontSize: 12, cursor: "pointer", color: channelFilter === n ? "var(--purple-brand)" : "var(--ink)", fontWeight: channelFilter === n ? 700 : 400 }} onClick={() => { setChannelFilter(n); setChannelOpen(false); }}>{n}</button>)}
            </div>
          )}
        </div>
        <button className="secondary small" onClick={() => setSortAsc(v => !v)}>Date {sortAsc ? "↑" : "↓"}</button>
      </div>

      <div className="sgTableWrap">
        <table className="sgTable">
          <thead>
            <tr>
              <th style={{ width: 32 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" /></th>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Channel</th>
              <th>Date</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No orders</td></tr>
              : filtered.map(o => (
                  <tr key={o.id}>
                    <td><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} /></td>
                    <td><strong>#{o.externalId}</strong></td>
                    <td>{o.customerName}</td>
                    <td><strong>{money(Number(o.total))}</strong></td>
                    <td><small>{o.store.name}</small></td>
                    <td><small className="mutedText">{new Date(o.orderedAt).toLocaleDateString("en-IN")}</small></td>
                    <td>
                      <span className={`statusPill ${o.status === "UNFULFILLED" ? "issue" : o.status === "PROCESSING" ? "issue" : o.status === "FULFILLED" ? "ready" : "error"}`}>
                        {o.status === "UNFULFILLED" ? "To pack" : o.status === "PROCESSING" ? "Processing" : o.status === "FULFILLED" ? "Shipped" : "Cancelled"}
                      </span>
                    </td>
                    <td>
                      {o.status === "UNFULFILLED" && <button className="primary small" onClick={() => void update(o.id, "PROCESSING").then(() => notify("Marked as processing"))}>Pack</button>}
                      {o.status === "PROCESSING" && <button className="secondary small" onClick={() => void update(o.id, "FULFILLED").then(() => notify("Marked as shipped"))}>Mark shipped</button>}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <div className="tableFooter"><span className="mutedText">Showing {filtered.length} of {orders.filter(o => (statusMap[tab] ?? []).includes(o.status)).length}</span></div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RETURNS (static demo — no returns API)
═══════════════════════════════════════════════════════════════════ */
function ReturnsPage({ notify }: { notify: (m: string) => void }) {
  const [tab, setTab] = useState("To inspect");
  const [selectedReturn, setSelectedReturn] = useState(0);
  const [condition, setCondition] = useState("Damaged");
  const [note, setNote] = useState("Cap cracked, about a third of the oil leaked into the box.");
  const photoRef = useRef<HTMLInputElement>(null);

  const returns = [
    { id: "RT-4029", order: "#OD22871104 · Flipkart",     type: "Customer return", product: "Ayurvedic Kumkumadi Face Oil", reason: "Bottle leaking on arrival",    inspectBy: "Claim closes in 18 h", urgent: true  },
    { id: "RT-4031", order: "#402-8812290 · Amazon India", type: "RTO",             product: "Organic Cotton Kurta – Indigo / L", reason: "Customer refused delivery", inspectBy: "In 2 days",          urgent: false },
    { id: "RT-4033", order: "#MYN-77190012 · Myntra",     type: "Customer return", product: "Raw Mulberry Silk Stole – Ivory", reason: "Colour different from photos", inspectBy: "In 3 days",        urgent: false },
  ];
  const sel = returns[selectedReturn];
  const tabs = ["To inspect", "On the way back", "Requested", "Claims", "Closed"];

  return (
    <div className="returnsLayout">
      <div>
        <div className="pageHeaderRow"><div><h1 className="pageTitle">Returns</h1><p className="pageSub">Customer returns and RTOs. Inspect each one, then restock it or claim.</p></div></div>
        <div className="tabRow">{tabs.map(t => <button key={t} className={`tabBtn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}{t === "To inspect" ? ` ${returns.length}` : ""}</button>)}</div>
        {tab === "To inspect" && (
          <div className="sgTableWrap">
            <table className="sgTable">
              <thead><tr><th>Return</th><th>Type</th><th>Product</th><th>Reason given</th><th>Inspect by</th></tr></thead>
              <tbody>
                {returns.map((r, i) => (
                  <tr key={r.id} className={selectedReturn === i ? "selected" : ""} style={{ cursor: "pointer" }} onClick={() => setSelectedReturn(i)}>
                    <td><strong>{r.id}</strong><small className="mutedText">{r.order}</small></td>
                    <td><span className="typeBadge">{r.type}</span></td>
                    <td>{r.product}</td>
                    <td>{r.reason}</td>
                    <td className={r.urgent ? "redText" : "mutedText"}>{r.inspectBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab !== "To inspect" && <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>No {tab.toLowerCase()} returns.</div>}
      </div>

      <aside className="inspectPanel">
        <div className="fixPanelHeader">
          <strong>Inspect return {sel.id}</strong>
          <small>{sel.product} · 1 unit</small>
          <small className="mutedText">{sel.order} · &ldquo;{sel.reason}&rdquo;</small>
        </div>
        <p className="inspectQuestion">What condition is it in?</p>
        <div className="conditionOptions">
          {[
            { label: "Sellable",             sub: "Put 1 unit back in stock" },
            { label: "Damaged",              sub: "Mark unsellable and claim from marketplace" },
            { label: "Wrong or missing item", sub: "Claim from marketplace" },
          ].map(c => (
            <label key={c.label} className="conditionOption">
              <input type="radio" name="condition" checked={condition === c.label} onChange={() => setCondition(c.label)} />
              <div><strong>{c.label}</strong><p>{c.sub}</p></div>
            </label>
          ))}
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 8 }}>
          Photos <small style={{ fontWeight: 400, color: "var(--muted)" }}>Flipkart needs at least 2 for a claim</small>
        </label>
        <input ref={photoRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={() => notify("Photo added")} />
        <div className="photoRow">
          <div className="photoThumb gold" />
          <div className="photoThumb light" />
          <button className="photoAdd" onClick={() => photoRef.current?.click()} aria-label="Add photo">+</button>
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Note</label>
        <textarea className="noteArea" value={note} onChange={e => setNote(e.target.value)} rows={3} />
        {condition === "Damaged" && <div className="claimBanner">A claim will be filed with the marketplace. {sel.urgent ? "The claim window closes soon." : ""}</div>}
        <div className="inspectActions">
          <button className="secondary" onClick={() => notify("Return saved for later")}>Save for later</button>
          <button className="publishButton" onClick={() => notify(condition === "Sellable" ? "1 unit returned to stock" : "Claim filed successfully")}>
            {condition === "Sellable" ? "Restock item" : "Finish and file claim"}
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PROFITABILITY — fully functional with real API data
═══════════════════════════════════════════════════════════════════ */

type ProfSummary = { revenue: number; netProfit: number; fees: number; shipping: number; productCost: number; returns: number; orders: number; margin: number; avgOrderValue: number; returnRate: number };
type ProfChannel = { storeId: string; name: string; marketplace: string; revenue: number; orders: number; fees: number; feeRate: number; shippingTotal: number; shippingPerOrder: number; productCost: number; returns: number; netProfit: number; netMargin: number; listings: number };
type ProfProduct = { id: string; name: string; sku: string; price: number; costPerUnit: number; estimatedUnits: number; revenue: number; fees: number; shipping: number; productCost: number; profitPerUnit: number; totalProfit: number; margin: number; publishedChannels: number; stock: number };
type ProfWeek   = { week: string; label: string; total: number; orders: number; breakdown: Record<string, number> };
type ProfData   = { period: number; summary: ProfSummary; byChannel: ProfChannel[]; byProduct: ProfProduct[]; weeklyTrend: ProfWeek[]; storeNames: Record<string, string> };

function ProfitabilityPage({ notify }: { notify: (m: string) => void }) {
  const periodOptions = [
    { label: "Last 7 days",  days: 7  },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
  ];
  const [periodIdx, setPeriodIdx]           = useState(1);
  const [periodOpen, setPeriodOpen]         = useState(false);
  const [profData, setProfData]             = useState<ProfData | null>(null);
  const [loading, setLoading]               = useState(true);
  const [loadError, setLoadError]           = useState("");
  const [productSort, setProductSort]       = useState<"totalProfit" | "margin" | "revenue">("totalProfit");
  const [productSortDir, setProductSortDir] = useState<"desc" | "asc">("desc");
  const [channelSort, setChannelSort]       = useState<"revenue" | "netMargin" | "orders">("revenue");
  const [costModalProduct, setCostModalProduct] = useState<ProfProduct | null>(null);
  const [costValue, setCostValue]           = useState("");
  const [savingCost, setSavingCost]         = useState(false);
  const [productSearch, setProductSearch]   = useState("");
  const [hoveredWeek, setHoveredWeek]       = useState<number | null>(null);

  const days = periodOptions[periodIdx].days;

  const loadData = useCallback(async (d: number) => {
    setLoading(true); setLoadError("");
    try {
      const result = await api<ProfData>(`/profitability?days=${d}`);
      setProfData(result);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load profitability data");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(days); }, [days, loadData]);

  // ── ALL useMemo MUST be before any conditional return ──
  const filteredProducts = useMemo(() => {
    if (!profData) return [];
    const q = productSearch.trim().toLowerCase();
    let list = [...profData.byProduct];
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    list.sort((a, b) => {
      const diff = a[productSort] - b[productSort];
      return productSortDir === "desc" ? -diff : diff;
    });
    return list;
  }, [profData, productSort, productSortDir, productSearch]);

  const sortedChannels = useMemo(() => {
    if (!profData) return [];
    return [...profData.byChannel].sort((a, b) => b[channelSort] - a[channelSort]);
  }, [profData, channelSort]);

  async function saveCost() {
    if (!costModalProduct) return;
    const n = Number(costValue);
    if (isNaN(n) || n < 0) { notify("Enter a valid cost per unit"); return; }
    setSavingCost(true);
    try {
      await api(`/products/${costModalProduct.id}/cost`, { method: "PATCH", body: JSON.stringify({ costPerUnit: n }) });
      notify("Product cost saved — profitability updated");
      setCostModalProduct(null);
      await loadData(days);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to save cost");
    } finally { setSavingCost(false); }
  }

  function exportCSV() {
    if (!profData) return;
    const { summary, byChannel, byProduct } = profData;
    const lines = [
      "SellersGrid Profitability Export",
      `Period: ${periodOptions[periodIdx].label}`,
      "",
      "SUMMARY",
      `Revenue,${summary.revenue}`,
      `Net Profit,${summary.netProfit.toFixed(0)}`,
      `Margin,${summary.margin.toFixed(1)}%`,
      `Marketplace Fees,${summary.fees.toFixed(0)}`,
      `Shipping,${summary.shipping.toFixed(0)}`,
      `Product Cost,${summary.productCost.toFixed(0)}`,
      `Returns,${summary.returns.toFixed(0)}`,
      `Orders,${summary.orders}`,
      `Avg Order Value,${summary.avgOrderValue.toFixed(0)}`,
      `Return Rate,${summary.returnRate.toFixed(1)}%`,
      "",
      "BY CHANNEL",
      "Channel,Revenue,Orders,Fees,Fee Rate,Shipping,Net Profit,Net Margin",
      ...byChannel.map(c => `"${c.name}",${c.revenue},${c.orders},${c.fees.toFixed(0)},${c.feeRate.toFixed(1)}%,${c.shippingTotal.toFixed(0)},${c.netProfit.toFixed(0)},${c.netMargin.toFixed(1)}%`),
      "",
      "BY PRODUCT",
      "Product,SKU,Price,Cost/Unit,Est. Units,Revenue,Fees,Profit/Unit,Total Profit,Margin",
      ...byProduct.map(p => `"${p.name}","${p.sku}",${p.price},${p.costPerUnit.toFixed(0)},${p.estimatedUnits},${p.revenue.toFixed(0)},${p.fees.toFixed(0)},${p.profitPerUnit.toFixed(0)},${p.totalProfit.toFixed(0)},${p.margin.toFixed(1)}%`),
    ].join("\n");
    csvDownload(`sellersgrid-profitability-${periodOptions[periodIdx].days}d.csv`, lines);
    notify("Profitability report exported");
  }

  // ── Conditional renders AFTER all hooks ──
  if (loading) {
    return (
      <div>
        <h1 className="pageTitle">Profitability</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "40px 0", color: "var(--muted)" }}>
          <span className="spinner" aria-label="Loading" />
          Loading profitability data…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <h1 className="pageTitle">Profitability</h1>
        <div className="errorBanner" role="alert">
          <span>{loadError}</span>
          <button onClick={() => void loadData(days)}>Retry</button>
        </div>
      </div>
    );
  }

  if (!profData) return null;

  const { summary, byChannel, byProduct, weeklyTrend } = profData;

  // Waterfall max for scaling
  const waterfallMax = summary.revenue;
  const waterfallBars = [
    { label: "Revenue",      value: summary.revenue,      positive: true,  cls: "purple" },
    { label: "Product cost", value: -summary.productCost, positive: false, cls: "light"  },
    { label: "Mkt fees",     value: -summary.fees,        positive: false, cls: "light"  },
    { label: "Shipping",     value: -summary.shipping,    positive: false, cls: "light"  },
    { label: "Returns",      value: -summary.returns,     positive: false, cls: "light"  },
    { label: "Net profit",   value: summary.netProfit,    positive: true,  cls: "gold"   },
  ];

  // Weekly chart: find max total for scaling bars
  const weekMax = Math.max(...weeklyTrend.map(w => w.total), 1);
  const storeColorMap: Record<string, string> = {};
  byChannel.forEach((c, i) => { storeColorMap[c.name] = ["#35134f", "#d4af37", "#c4b8d9", "#5b2a86"][i % 4]; });

  return (
    <div>
      {/* ── Header ── */}
      <div className="pageHeaderRow">
        <div>
          <h1 className="pageTitle">Profitability</h1>
          <p className="pageSub">What you actually keep after product cost, marketplace fees, shipping and returns.</p>
        </div>
        <div className="pageHeaderActions">
          {/* Period picker */}
          <div style={{ position: "relative" }}>
            <button className="secondary" onClick={() => setPeriodOpen(v => !v)}>
              {periodOptions[periodIdx].label} ▾
            </button>
            {periodOpen && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "white", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 0", minWidth: 160, zIndex: 20, boxShadow: "0 4px 16px rgba(35,16,56,.1)" }}>
                {periodOptions.map((p, i) => (
                  <button key={p.label} style={{ display: "block", width: "100%", padding: "8px 14px", background: "none", border: "none", textAlign: "left", fontSize: 12, cursor: "pointer", color: periodIdx === i ? "var(--purple-brand)" : "var(--ink)", fontWeight: periodIdx === i ? 700 : 400 }}
                    onClick={() => { setPeriodIdx(i); setPeriodOpen(false); }}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="secondary" onClick={() => { const p = byProduct.find(x => !x.costPerUnit || x.costPerUnit === x.price * 0.46); if (p) { setCostModalProduct(p); setCostValue(String(Math.round(p.costPerUnit))); } else { notify("All product costs are set. Edit a product to update."); } }}>
            Product costs
          </button>
          <button className="secondary" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      {/* ── Settled banner ── */}
      <div className="settledBanner">
        <span>ℹ</span>
        <span>Fees and costs are estimated. Set per-product costs with the <strong>Product costs</strong> button for accurate margin. {summary.returnRate > 0 ? `Return/cancellation rate: ${summary.returnRate.toFixed(1)}%.` : ""}</span>
      </div>

      {/* ── KPI cards ── */}
      <div className="metricsRow" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "Revenue, excl. GST",  value: money(summary.revenue),         sub: `${summary.orders} orders · avg ${money(summary.avgOrderValue)}`, highlight: false },
          { label: "Net profit (est.)",   value: money(summary.netProfit),        sub: `${summary.margin.toFixed(1)}% margin`,                           highlight: true  },
          { label: "Marketplace fees",    value: money(summary.fees),             sub: `${summary.revenue > 0 ? (summary.fees / summary.revenue * 100).toFixed(1) : 0}% of revenue`, highlight: false },
          { label: "Shipping cost",       value: money(summary.shipping),         sub: `${summary.orders > 0 ? money(summary.shipping / summary.orders) : "₹0"} per order`,           highlight: false },
        ].map(m => (
          <div key={m.label} className={`metricCard${m.highlight ? " highlighted" : ""}`}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
            <span className={m.highlight ? "" : "mutedText"}>{m.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Waterfall + Weekly trend side by side ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Waterfall */}
        <div className="panel">
          <div className="panelHeader">
            <div>
              <strong>Where your revenue went</strong>
              <small className="mutedText" style={{ display: "block", marginTop: 2 }}>{periodOptions[periodIdx].label} · ₹ lakh · of every ₹100 earned, you kept ₹{(summary.margin).toFixed(1)}</small>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 160, padding: "8px 0 0" }}>
            {waterfallBars.map((b, i) => {
              const h = Math.max(6, (Math.abs(b.value) / (waterfallMax || 1)) * 140);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <small style={{ fontSize: 9, color: "var(--muted)", fontWeight: 600, textAlign: "center" }}>
                    {b.value >= 0 ? "+" : "−"}{money(Math.abs(b.value))}
                  </small>
                  <div className={`waterfallBlock ${b.cls}`} style={{ width: "100%", height: h }} />
                  <span style={{ fontSize: 9, color: "var(--muted)", textAlign: "center", lineHeight: 1.3 }}>{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly trend bar chart */}
        <div className="panel">
          <div className="panelHeader">
            <div>
              <strong>Sales by week</strong>
              <small className="mutedText" style={{ display: "block", marginTop: 2 }}>₹ revenue · by channel</small>
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 10, color: "var(--muted)", flexWrap: "wrap" }}>
              {byChannel.map((c, i) => (
                <span key={c.storeId} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <i style={{ display: "block", width: 10, height: 10, borderRadius: 2, background: ["#35134f","#d4af37","#c4b8d9","#5b2a86"][i % 4] }} />
                  {c.name}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 130, paddingTop: 10 }}>
            {weeklyTrend.filter(w => w.total > 0 || weeklyTrend.indexOf(w) < 5).map((w, i) => {
              const totalH = Math.max(4, (w.total / weekMax) * 110);
              const storeList = byChannel.map(c => ({ name: c.name, val: w.breakdown[c.name] ?? 0 }));
              const grandTotal = storeList.reduce((s, x) => s + x.val, 0);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                  onMouseEnter={() => setHoveredWeek(i)} onMouseLeave={() => setHoveredWeek(null)}>
                  <div style={{ width: "100%", height: totalH, borderRadius: "3px 3px 0 0", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end", position: "relative" }}>
                    {grandTotal > 0 ? storeList.map((s, si) => (
                      <div key={si} style={{ width: "100%", height: `${grandTotal > 0 ? (s.val / grandTotal) * 100 : 0}%`, background: ["#35134f","#d4af37","#c4b8d9","#5b2a86"][si % 4], minHeight: s.val > 0 ? 2 : 0 }} />
                    )) : <div style={{ width: "100%", height: "100%", background: "#f0ebf4" }} />}
                    {hoveredWeek === i && grandTotal > 0 && (
                      <div style={{ position: "absolute", bottom: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)", background: "var(--purple-mid)", color: "white", borderRadius: 6, padding: "5px 8px", fontSize: 10, whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none" }}>
                        {money(grandTotal)}<br />{w.orders} orders
                      </div>
                    )}
                  </div>
                  <small style={{ fontSize: 9, color: "var(--muted)", whiteSpace: "nowrap" }}>{w.label}</small>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── By channel ── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panelHeader">
          <strong>By channel</strong>
          <div style={{ display: "flex", gap: 6 }}>
            {(["revenue", "netMargin", "orders"] as const).map(key => (
              <button key={key} className={channelSort === key ? "primary small" : "secondary small"}
                onClick={() => setChannelSort(key)}>
                {key === "revenue" ? "Revenue" : key === "netMargin" ? "Margin" : "Orders"}
              </button>
            ))}
          </div>
        </div>
        <table className="sgTable">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Revenue</th>
              <th>Orders</th>
              <th>Mkt fees</th>
              <th>Fee rate</th>
              <th>Shipping/order</th>
              <th>Return rate</th>
              <th>Net margin</th>
            </tr>
          </thead>
          <tbody>
            {sortedChannels.map(c => {
              const info = mktInfo(c.marketplace);
              const retRate = c.orders > 0 ? summary.returnRate : 0;
              return (
                <tr key={c.storeId}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="channelInit" style={{ background: info.bg, color: info.color, width: 28, height: 28, fontSize: 8 }}>{info.short}</span>
                      <strong>{c.name}</strong>
                    </div>
                  </td>
                  <td><strong>{money(c.revenue)}</strong></td>
                  <td>{c.orders.toLocaleString("en-IN")}</td>
                  <td>{money(c.fees)}</td>
                  <td>{c.feeRate.toFixed(1)}%</td>
                  <td>{money(c.shippingPerOrder)}</td>
                  <td className={retRate > 10 ? "amberText" : ""}>{retRate.toFixed(1)}%</td>
                  <td>
                    <span style={{ fontWeight: 700, color: c.netMargin > 20 ? "var(--green)" : c.netMargin > 10 ? "var(--amber)" : "var(--red)" }}>
                      {c.netMargin.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
            {sortedChannels.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No channel data for this period</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── By product ── */}
      <div className="panel">
        <div className="panelHeader">
          <div>
            <strong>By product</strong>
            <small className="mutedText" style={{ display: "block", marginTop: 2 }}>Per unit · estimated units from order data</small>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <div className="searchWrap small" style={{ maxWidth: 200 }}>
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" /><path d="M13.5 13.5 18 18" /></svg>
              <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search product" style={{ fontSize: 11, padding: "5px 8px 5px 26px" }} />
            </div>
            {(["totalProfit", "margin", "revenue"] as const).map(key => (
              <button key={key} className={productSort === key ? "primary small" : "secondary small"}
                onClick={() => { if (productSort === key) setProductSortDir(d => d === "desc" ? "asc" : "desc"); else { setProductSort(key); setProductSortDir("desc"); } }}>
                {key === "totalProfit" ? "Total profit" : key === "margin" ? "Margin" : "Revenue"}
                {productSort === key && (productSortDir === "desc" ? " ↓" : " ↑")}
              </button>
            ))}
            <button className="secondary small" onClick={() => setCostModalProduct(filteredProducts[0] ?? null)}>
              Set costs
            </button>
          </div>
        </div>

        <table className="sgTable">
          <thead>
            <tr>
              <th>Product</th>
              <th>Channels</th>
              <th>Price</th>
              <th>Cost/unit</th>
              <th>Est. units</th>
              <th>Fees</th>
              <th>Shipping</th>
              <th>Profit/unit</th>
              <th>Total profit</th>
              <th>Margin</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0
              ? <tr><td colSpan={11} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No products found</td></tr>
              : filteredProducts.map(p => {
                  const init = p.name.slice(0, 2).toUpperCase();
                  const isNegative = p.profitPerUnit < 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="productCell">
                          <span className="productInit">{init}</span>
                          <span>
                            <strong>{p.name}</strong>
                            <small className="mutedText">{p.sku}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 3 }}>
                          {Array.from({ length: p.publishedChannels }).map((_, i) => (
                            <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
                          ))}
                          {p.publishedChannels === 0 && <span style={{ fontSize: 10, color: "var(--muted)" }}>Not listed</span>}
                        </div>
                      </td>
                      <td><strong>{money(p.price)}</strong></td>
                      <td>
                        <span style={{ color: "var(--muted)" }}>{money(p.costPerUnit)}</span>
                      </td>
                      <td>{p.estimatedUnits}</td>
                      <td><small className="mutedText">{money(p.fees / (p.estimatedUnits || 1))}/unit</small></td>
                      <td><small className="mutedText">{money(p.shipping / (p.estimatedUnits || 1))}/unit</small></td>
                      <td>
                        <strong className={isNegative ? "redText" : ""}>{money(p.profitPerUnit)}</strong>
                      </td>
                      <td>
                        <strong className={isNegative ? "redText" : p.totalProfit > 10000 ? "greenText" : ""}>{money(p.totalProfit)}</strong>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: p.margin > 25 ? "var(--green)" : p.margin > 10 ? "var(--amber)" : "var(--red)" }}>
                          {p.margin.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <button className="secondary small" onClick={() => { setCostModalProduct(p); setCostValue(String(Math.round(p.costPerUnit))); }}>
                          Edit cost
                        </button>
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>

        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, lineHeight: 1.6 }}>
          Estimated units = total orders ÷ active products. Set actual product costs for accurate per-unit profit.
          Fees use standard marketplace rates (Amazon 15%, Flipkart 16%, Myntra 22%).
        </p>
      </div>

      {/* ── Cost edit modal ── */}
      {costModalProduct && (
        <div className="overlay" onMouseDown={() => setCostModalProduct(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Edit product cost" tabIndex={-1} onMouseDown={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <button className="modalClose" onClick={() => setCostModalProduct(null)}>×</button>
            <span className="modalEyebrow">PRODUCT COST</span>
            <h2 style={{ fontSize: 18 }}>{costModalProduct.name}</h2>
            <p className="modalIntro">Set the cost of goods per unit (what you paid to source or manufacture it, excluding GST). This is only visible to you.</p>

            <div style={{ background: "var(--cream)", borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Selling price",    value: money(costModalProduct.price) },
                  { label: "Current cost/unit", value: money(costModalProduct.costPerUnit) },
                  { label: "Mkt fee (est.)",   value: money(costModalProduct.price * 0.16) },
                  { label: "Shipping/unit",     value: "₹100" },
                ].map(r => (
                  <div key={r.label}>
                    <small style={{ color: "var(--muted)", display: "block" }}>{r.label}</small>
                    <strong>{r.value}</strong>
                  </div>
                ))}
              </div>
              {costValue !== "" && !isNaN(Number(costValue)) && Number(costValue) >= 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  <small style={{ color: "var(--muted)", display: "block", marginBottom: 4 }}>Estimated profit per unit with new cost:</small>
                  <strong style={{ fontSize: 16, color: costModalProduct.price - Number(costValue) - costModalProduct.price * 0.16 - 100 > 0 ? "var(--green)" : "var(--red)" }}>
                    {money(costModalProduct.price - Number(costValue) - costModalProduct.price * 0.16 - 100)}
                    <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>
                      ({costModalProduct.price > 0 ? ((costModalProduct.price - Number(costValue) - costModalProduct.price * 0.16 - 100) / costModalProduct.price * 100).toFixed(1) : 0}% margin)
                    </span>
                  </strong>
                </div>
              )}
            </div>

            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
              Cost per unit (₹)
              <input
                type="number"
                min={0}
                step={1}
                value={costValue}
                onChange={e => setCostValue(e.target.value)}
                placeholder="e.g. 420"
                autoFocus
                style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none" }}
                onFocus={e => { e.target.style.borderColor = "var(--purple-brand)"; e.target.style.boxShadow = "0 0 0 3px rgba(91,42,134,.1)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--line)"; e.target.style.boxShadow = "none"; }}
              />
            </label>

            <div className="modalFooter">
              <button className="secondary" onClick={() => setCostModalProduct(null)}>Cancel</button>
              <button className="publishButton" disabled={savingCost || costValue === "" || isNaN(Number(costValue))} onClick={() => void saveCost()}>
                {savingCost ? "Saving…" : "Save cost"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CHANNELS
═══════════════════════════════════════════════════════════════════ */
function ChannelsPage({ stores, connect, reload, notify, go }: { stores: Store[]; connect: () => void; reload: () => Promise<void>; notify: (m: string) => void; go: (v: View) => void }) {
  const [toggleStates, setToggleStates] = useState<Record<string, { stock: boolean; price: boolean; order: boolean }>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  function getToggles(id: string) {
    return toggleStates[id] ?? { stock: true, price: true, order: true };
  }
  function setToggle(id: string, key: "stock" | "price" | "order") {
    setToggleStates(prev => ({ ...prev, [id]: { ...getToggles(id), [key]: !getToggles(id)[key] } }));
  }

  async function disconnect(s: Store) {
    if (!window.confirm(`Disconnect ${s.name}? Syncing will stop.`)) return;
    await api(`/stores/${s.id}`, { method: "DELETE" });
    notify(`${s.name} disconnected`);
    await reload();
  }

  async function syncNow(s: Store) {
    setSyncing(prev => ({ ...prev, [s.id]: true }));
    notify(`${s.name} sync started…`);
    await new Promise(r => window.setTimeout(r, 1200));
    setSyncing(prev => ({ ...prev, [s.id]: false }));
    notify(`${s.name} sync complete`);
  }

  const activity = [
    "Stock updated for 42 products",
    "New order imported",
    "Price changed on 8 listings",
    "23 listings rejected — HSN tax code missing",
    "Return received from customer",
  ];

  return (
    <div>
      <div className="pageHeaderRow">
        <div><h1 className="pageTitle">Channels</h1><p className="pageSub">Your connected marketplace accounts and what SellersGrid keeps in sync.</p></div>
        <button className="publishButton" onClick={connect}>+ Connect a channel</button>
      </div>

      {stores.length === 0
        ? (
          <div className="panel" style={{ textAlign: "center", padding: 48 }}>
            <strong style={{ display: "block", fontSize: 16, marginBottom: 8 }}>No channels connected</strong>
            <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 20 }}>Connect Amazon, Flipkart or Myntra to start syncing.</p>
            <button className="publishButton" onClick={connect}>+ Connect a channel</button>
          </div>
        )
        : (
          <div className="channelCards">
            {stores.map(s => {
              const info = mktInfo(s.marketplace);
              const t = getToggles(s.id);
              return (
                <div key={s.id} className="channelCard">
                  <div className="channelCardTop">
                    <span className="channelInit" style={{ background: info.bg, color: info.color }}>{info.short}</span>
                    <div><strong>{s.name}</strong><small className="mutedText">{s.externalAccountId ?? info.label}</small></div>
                    <span className={`healthBadge ${s.status === "CONNECTED" ? "healthy" : "warn"}`}>{s.status === "CONNECTED" ? "Healthy" : "Action needed"}</span>
                  </div>
                  <div className="channelStats">
                    <div><small>Live listings</small><strong>{s._count.listings}</strong></div>
                    <div><small>Orders</small><strong>{s._count.orders}</strong></div>
                    <div><small>Last sync</small><strong>{s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</strong></div>
                  </div>
                  <div className="channelToggles">
                    {(["stock", "price", "order"] as const).map(key => (
                      <div key={key} className="channelToggle">
                        <div>
                          <strong>{key === "stock" ? "Stock sync" : key === "price" ? "Price sync" : "Order import"}</strong>
                          <small>{key === "stock" ? "Push available stock after every change" : key === "price" ? "Apply your price rules" : "Bring in new orders"}</small>
                        </div>
                        <button type="button" role="switch" aria-checked={t[key]} className={`toggle${t[key] ? " on" : ""}`} aria-label={key} onClick={() => setToggle(s.id, key)} />
                      </div>
                    ))}
                  </div>
                  <div className="channelActions">
                    <button className="secondary small" onClick={() => notify(`${s.name} settings — coming soon`)}>Settings</button>
                    <button className="secondary small" disabled={syncing[s.id]} onClick={() => void syncNow(s)}>{syncing[s.id] ? "Syncing…" : "Sync now"}</button>
                    <button className="secondary small dangerText" onClick={() => void disconnect(s)}>Disconnect</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      <div className="moreChannels">
        <strong>More channels are coming</strong>
        <p>Shopify, Meesho and quick-commerce apps are next on the list.</p>
        <button className="linkBtn" onClick={() => window.open("mailto:feedback@sellersgrid.com?subject=Channel request", "_blank")}>Tell us which one you need →</button>
      </div>

      <div className="recentActivity">
        <div className="panelHeader">
          <strong>Recent activity</strong>
          <button className="linkBtn" onClick={() => go("Sync activity")}>See all sync activity →</button>
        </div>
        {activity.map((a, i) => (
          <div key={i} className="activityRow">
            <span className="activityDot" />
            <span>{a}</span>
            <span className="mutedText">{stores[i % stores.length]?.name ?? "—"}</span>
            <span className="mutedText">{[2, 2, 4, 18, 60][i]} min ago</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SYNC ACTIVITY
═══════════════════════════════════════════════════════════════════ */
function SyncActivityPage({ jobs, stores, go, notify, reload }: { jobs: Job[]; stores: Store[]; go: (v: View) => void; notify: (m: string) => void; reload: () => Promise<void> }) {
  const [tab, setTab] = useState("All");
  const [q, setQ] = useState("");
  const [syncing, setSyncing] = useState(false);

  const tabs = ["All", "Failed", "Completed", "Queued"];

  const filtered = useMemo(() => {
    const sq = q.trim().toLowerCase();
    let list = jobs;
    if (tab === "Failed") list = list.filter(j => j.status === "FAILED");
    else if (tab === "Completed") list = list.filter(j => j.status === "COMPLETED");
    else if (tab === "Queued") list = list.filter(j => j.status === "QUEUED" || j.status === "PROCESSING");
    if (sq) list = list.filter(j => j.product.name.toLowerCase().includes(sq) || j.store.name.toLowerCase().includes(sq));
    return list;
  }, [jobs, tab, q]);

  async function syncAll() {
    setSyncing(true);
    notify("Syncing all channels…");
    await new Promise(r => window.setTimeout(r, 1500));
    await reload();
    notify("All channels synced");
    setSyncing(false);
  }

  const failedJobs = jobs.filter(j => j.status === "FAILED");

  return (
    <div>
      <div className="pageHeaderRow">
        <div><h1 className="pageTitle">Sync activity</h1><p className="pageSub">Everything SellersGrid sent to, or received from, your channels.</p></div>
        <button className="publishButton" disabled={syncing} onClick={() => void syncAll()}>{syncing ? "Syncing…" : "Sync all channels now"}</button>
      </div>

      <div className="syncChannelRow">
        {stores.map(s => {
          const info = mktInfo(s.marketplace);
          return (
            <div key={s.id} className="syncChannelCard">
              <strong>{s.name}</strong>
              <span className={`syncBadge ${s.status === "CONNECTED" ? "good" : "warn"}`}>{s.status === "CONNECTED" ? "All good" : "Action needed"}</span>
              <small>Last sync: {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</small>
            </div>
          );
        })}
      </div>

      {failedJobs.length > 0 && (
        <div className="needsInputPanel">
          <div className="panelHeader"><strong>Needs your input</strong><span className="attentionCount">{failedJobs.length}</span></div>
          {failedJobs.slice(0, 3).map(j => (
            <div key={j.id} className="inputItem">
              <span className="attentionDot red" />
              <div><strong>{j.product.name} → {j.store.name}</strong><p>{j.errorMessage ?? "Failed"}</p></div>
              <button className="primary small" onClick={() => go("Listings")}>Fix in Listings</button>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="panelHeader">
          <strong>Job stream</strong>
          <div className="activityFilters">
            {tabs.map(t => <button key={t} className={`tabBtn${tab === t ? " active" : ""}`} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setTab(t)}>{t}</button>)}
          </div>
        </div>
        <div className="catalogToolbar" style={{ marginBottom: 12 }}>
          <div className="searchWrap small" style={{ flex: 1, maxWidth: 320 }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" /><path d="M13.5 13.5 18 18" /></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by product or channel" />
          </div>
        </div>
        <table className="sgTable">
          <thead><tr><th>Product</th><th>Channel</th><th>Time</th><th>Attempts</th><th>Status</th><th>Error</th></tr></thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No activity</td></tr>
              : filtered.map(j => (
                  <tr key={j.id}>
                    <td><strong>{j.product.name}</strong><small className="mutedText">{j.product.sku}</small></td>
                    <td>{j.store.name}</td>
                    <td><small className="mutedText">{new Date(j.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small></td>
                    <td>{j.attempt}</td>
                    <td><span className={`resultBadge ${j.status.toLowerCase()}`}>{j.status.toLowerCase()}</span></td>
                    <td><small className="mutedText">{j.errorMessage ?? "—"}</small></td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════════════════════ */
function SettingsPage({ me, saved, notify }: { me: Me; saved: () => void; notify: (m: string) => void }) {
  const [settingsTab, setSettingsTab] = useState("Team and roles");
  const [twoStep, setTwoStep] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("STAFF");
  const [busy, setBusy] = useState(false);
  const settingsTabs = ["Workspace", "Team and roles", "Warehouses", "Tax and GST", "Price rules", "Plan and billing", "Notifications", "API keys"];

  const members = [
    { initials: "AS", name: me.user.name, email: me.user.email, role: "Owner", lastActive: "Now", isYou: true },
    { initials: "NK", name: "Neha Kulkarni",  email: "neha@abcretail.in",  role: "Admin",           lastActive: "12 min ago" },
    { initials: "IS", name: "Imran Shaikh",   email: "imran@abcretail.in", role: "Staff",           lastActive: "1 hour ago" },
    { initials: "PN", name: "Priya Nair",     email: "priya@abcretail.in", role: "Viewer",          lastActive: "Yesterday" },
    { initials: "RM", name: "Ravi Menon",     email: "ravi@abcretail.in",  role: "Staff",           lastActive: "Invite sent", inviteSent: true },
  ];

  async function saveWorkspace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try { await api("/settings", { method: "PATCH", body: JSON.stringify(data) }); saved(); }
    finally { setBusy(false); }
  }

  return (
    <div className="settingsLayout">
      <nav className="settingsNav" aria-label="Settings sections">
        <p className="navEyebrow" style={{ color: "var(--muted)" }}>Workspace</p>
        {settingsTabs.map(t => (
          <button key={t} className={`settingsNavBtn${settingsTab === t ? " active" : ""}`} onClick={() => setSettingsTab(t)}>{t}</button>
        ))}
      </nav>

      <div className="settingsContent">
        {settingsTab === "Workspace" && (
          <form onSubmit={saveWorkspace}>
            <h2>Workspace</h2>
            <p className="pageSub">Organisation-wide settings.</p>
            <label htmlFor="orgName">Organization name<input id="orgName" name="organizationName" defaultValue={me.organization.name} required minLength={2} /></label>
            <button className="publishButton" type="submit" disabled={busy} style={{ marginTop: 20 }}>{busy ? "Saving…" : "Save changes"}</button>
          </form>
        )}

        {settingsTab === "Team and roles" && (
          <div>
            <div className="pageHeaderRow">
              <div><h2>Team members</h2><p className="pageSub">5 of 5 seats on the {me.organization.plan} plan</p></div>
              <button className="publishButton" onClick={() => setInviteOpen(true)}>Invite member</button>
            </div>

            {inviteOpen && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <strong style={{ display: "block", marginBottom: 12 }}>Invite a team member</strong>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px auto", gap: 8, alignItems: "end" }}>
                  <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 600 }}>
                    Email
                    <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
                  </label>
                  <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 600 }}>
                    Role
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                      {["ADMIN","STAFF","VIEWER"].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="publishButton" onClick={() => { notify("Invitation sent – feature coming soon"); setInviteOpen(false); setInviteEmail(""); }}>Send invite</button>
                    <button className="secondary" onClick={() => setInviteOpen(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            <div className="sgTableWrap">
              <table className="sgTable">
                <thead><tr><th>Name</th><th>Role</th><th>Last active</th><th></th></tr></thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.email}>
                      <td>
                        <div className="memberCell">
                          <span className="avatar">{m.initials}</span>
                          <span><strong>{m.name}{m.isYou && <span className="youTag"> · you</span>}</strong><small className="mutedText">{m.email}</small></span>
                        </div>
                      </td>
                      <td>
                        {m.isYou
                          ? <span>Owner</span>
                          : <select defaultValue={m.role} style={{ width: "auto", padding: "6px 10px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 6 }} onChange={() => notify("Role updated")}>
                              {["ADMIN","STAFF","VIEWER"].map(r => <option key={r}>{r}</option>)}
                            </select>
                        }
                      </td>
                      <td className="mutedText">{(m as typeof members[4]).inviteSent ? <span className="inviteSentTag">Invite sent</span> : m.lastActive}</td>
                      <td>
                        {!m.isYou && (
                          (m as typeof members[4]).inviteSent
                            ? <button className="secondary small" onClick={() => notify("Invite resent")}>Resend invite</button>
                            : <button className="secondary small dangerText" onClick={() => { if (window.confirm(`Remove ${m.name}?`)) notify("Member removed – feature coming soon"); }}>Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 32 }}>
              <h3>What each role can do</h3>
              <p className="pageSub">Give people only the access they need.</p>
              <div className="rolesGrid">
                {[
                  { role: "Owner",           desc: "Everything, including billing and closing the workspace." },
                  { role: "Admin",           desc: "Everything except billing. Can connect channels and invite people." },
                  { role: "Catalog manager", desc: "Products, photos, listings, price rules and stock adjustments." },
                  { role: "Operations",      desc: "Orders, packing, labels, shipping, returns and stock counts." },
                  { role: "Finance",         desc: "Settlements, costs, profitability, invoices and GST reports." },
                  { role: "Viewer",          desc: "Can see dashboards and reports. Can't change anything." },
                ].map(r => (
                  <div key={r.role} className="roleCard"><strong>{r.role}</strong><p>{r.desc}</p></div>
                ))}
              </div>
            </div>

            <div className="twoStepToggle">
              <div>
                <strong>Require two-step sign-in for Owner and Admin</strong>
                <p>They&apos;ll use an authenticator app code each time they sign in on a new device.</p>
              </div>
              <button type="button" role="switch" aria-checked={twoStep} className={`toggle${twoStep ? " on" : ""}`} aria-label="Require two-step sign-in" onClick={() => { setTwoStep(v => !v); notify(twoStep ? "Two-step sign-in disabled" : "Two-step sign-in enabled"); }} />
            </div>
          </div>
        )}

        {!["Workspace", "Team and roles"].includes(settingsTab) && (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>
            <strong style={{ display: "block", fontSize: 16, marginBottom: 8 }}>{settingsTab}</strong>
            <p style={{ fontSize: 13 }}>This section is coming soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════════════════ */
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", h);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", h);
  }, [close]);
  return (
    <div className="overlay" onMouseDown={close}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onMouseDown={e => e.stopPropagation()}>
        <button className="modalClose" aria-label="Close" onClick={close}>×</button>
        {children}
      </div>
    </div>
  );
}

function ProductForm({ product, saved }: { product?: Product; saved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    const data = new FormData(e.currentTarget);
    const file = data.get("image") as File;
    try {
      let attrObj: Record<string, unknown> = {};
      const rawAttr = String(data.get("attributes") || "{}");
      try { attrObj = JSON.parse(rawAttr); } catch { throw new Error("Attributes must be valid JSON"); }
      if (Array.isArray(attrObj) || typeof attrObj !== "object") throw new Error("Attributes must be a JSON object");
      const body = {
        name: data.get("name"), sku: data.get("sku"), brand: data.get("brand") || undefined,
        category: data.get("category"), description: data.get("description"),
        price: Number(data.get("price")), stock: Number(data.get("stock")), attributes: attrObj,
      };
      const p = await api<Product>(product ? `/products/${product.id}` : "/products", { method: product ? "PATCH" : "POST", body: JSON.stringify(body) });
      if (file?.size) {
        const upload = new FormData(); upload.set("file", file);
        await api(`/products/${p.id}/images`, { method: "POST", body: upload });
      }
      saved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save product");
      setBusy(false);
    }
  }

  return (
    <>
      <span className="modalEyebrow">MASTER CATALOG</span>
      <h2>{product ? "Edit product" : "New product"}</h2>
      <p className="modalIntro">This is the source of truth for every channel.</p>
      <form onSubmit={submit}>
        <label>Product title<input name="name" required defaultValue={product?.name} placeholder="e.g. Organic Cotton Kurta – Indigo" /></label>
        <div className="fieldRow">
          <label>SKU<input name="sku" required defaultValue={product?.sku} placeholder="e.g. MF-APP-108" /></label>
          <label>Brand<input name="brand" defaultValue={product?.brand} placeholder="Heritage India Crafts" /></label>
        </div>
        <div className="fieldRow">
          <label>Category<input name="category" required defaultValue={product?.category} placeholder="Apparel" /></label>
          <label>Description<input name="description" required defaultValue={product?.description} /></label>
        </div>
        <div className="fieldRow">
          <label>Selling price (₹)<input name="price" type="number" min="0" step="0.01" required defaultValue={product?.price} placeholder="849" /></label>
          <label>Stock<input name="stock" type="number" min="0" step="1" required defaultValue={product?.stock} placeholder="100" /></label>
        </div>
        <label>Marketplace attributes (JSON)<textarea name="attributes" rows={3} spellCheck={false} defaultValue={JSON.stringify(product?.attributes ?? {}, null, 2)} /></label>
        <input ref={fileRef} name="image" type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} />
        <button type="button" className="secondary" style={{ marginBottom: 12 }} onClick={() => fileRef.current?.click()}>📷 Upload product image</button>
        {formError && <p className="formError" role="alert">{formError}</p>}
        <div className="modalFooter">
          <button type="submit" className="publishButton" disabled={busy}>{busy ? "Saving…" : product ? "Save changes" : "Create product"}</button>
        </div>
      </form>
    </>
  );
}

function ConnectForm({ saved }: { saved: () => void }) {
  const [marketplace, setMarketplace] = useState("AMAZON");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const mktOptions = [
    { value: "AMAZON",   label: "Amazon India – Seller Central" },
    { value: "FLIPKART", label: "Flipkart – Seller Hub" },
  ];

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/stores/connect", { method: "POST", body: JSON.stringify({ marketplace, name: d.name, externalAccountId: d.externalAccountId || undefined, credentials: { accessToken: String(d.accessToken) } }) });
      saved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Connection failed");
      setBusy(false);
    }
  }

  return (
    <>
      <span className="modalEyebrow">CONNECT CHANNEL</span>
      <h2>Connect a marketplace</h2>
      <p className="modalIntro">Give SellersGrid permission to read and update your listings, stock and orders. You can disconnect at any time.</p>
      <form onSubmit={submit}>
        <label>Marketplace
          <select value={marketplace} onChange={e => setMarketplace(e.target.value)}>
            {mktOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <div className="fieldRow">
          <label>Connection name<input name="name" required placeholder={marketplace === "AMAZON" ? "Amazon India" : "Flipkart"} /></label>
          <label>Seller / Account ID<input name="externalAccountId" placeholder="e.g. ABC-RETAIL-IN" /></label>
        </div>
        <label>Access token<input name="accessToken" type="password" required autoComplete="off" placeholder="Marketplace-issued access token" /></label>
        <p className="connectHint">We never store your marketplace password. Access keys are encrypted and you can revoke them from the marketplace at any time.</p>
        {formError && <p className="formError" role="alert">{formError}</p>}
        <div className="modalFooter">
          <button type="submit" className="publishButton" disabled={busy}>{busy ? "Connecting…" : "Connect"}</button>
        </div>
      </form>
    </>
  );
}

function PublishForm({ products, stores, done }: { products: Product[]; stores: Store[]; done: () => void }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(stores.map(s => s.id)));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  function toggleStore(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  async function publish() {
    if (!productId || selected.size === 0) return;
    setBusy(true);
    setFormError("");
    try {
      await api(`/products/${productId}/publish`, { method: "POST", body: JSON.stringify({ storeIds: Array.from(selected) }) });
      done();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to queue publishing");
      setBusy(false);
    }
  }

  if (products.length === 0) return <><span className="modalEyebrow">PUBLISH</span><h2>No products</h2><p className="modalIntro">Add a product to your catalog first.</p></>;

  return (
    <>
      <span className="modalEyebrow">PUBLISH EVERYWHERE</span>
      <h2>Publish to channels</h2>
      <p className="modalIntro">Select a product and the channels to publish it on.</p>
      <label>Product
        <select value={productId} onChange={e => setProductId(e.target.value)}>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
        </select>
      </label>
      <p className="sectionLabel">Select channels</p>
      {stores.length === 0
        ? <p style={{ color: "var(--muted)", fontSize: 12 }}>No connected channels. Connect a channel first.</p>
        : (
          <div className="publishChannels">
            {stores.map(s => {
              const info = mktInfo(s.marketplace);
              return (
                <button key={s.id} type="button" className={`publishChannel${selected.has(s.id) ? " selected" : ""}`} onClick={() => toggleStore(s.id)}>
                  <span className="channelInit" style={{ background: info.bg, color: info.color }}>{info.short}</span>
                  <span><strong>{s.name}</strong><small>{info.label}</small></span>
                </button>
              );
            })}
          </div>
        )}
      {formError && <p className="formError" role="alert">{formError}</p>}
      <div className="modalFooter">
        <button type="button" className="publishButton" disabled={busy || !productId || selected.size === 0 || stores.length === 0} onClick={() => void publish()}>
          {busy ? "Publishing…" : `Publish to ${selected.size} channel${selected.size !== 1 ? "s" : ""}`}
        </button>
      </div>
    </>
  );
}
