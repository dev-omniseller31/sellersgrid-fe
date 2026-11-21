import Link from "next/link";

const benefits = [
  ["One master catalog", "Create product data once and push it cleanly to Amazon, Flipkart and Myntra from a single source of truth."],
  ["Reliable sync", "Stock, prices and orders stay in sync automatically. A sale on one channel updates the others in seconds."],
  ["Clear profitability", "See revenue, fees, shipping and returns in one view. Know your actual net margin per product and channel."],
];

export default function MarketingPage() {
  return (
    <main className="marketingShell">
      <nav className="marketingNav" aria-label="Main navigation">
        <Link className="brand" href="/">
          <span className="brandMark"><i /><i /><i /><i /></span>
          <span className="brandName">SellersGrid</span>
        </Link>
        <div>
          <a href="#platform">Platform</a>
          <a href="#security">Security</a>
          <Link className="secondary" href="/login">Sign in</Link>
          <Link className="primary" href="/login">Start free trial</Link>
        </div>
      </nav>

      <section className="marketingHero">
        <div>
          <span className="sectionKicker">AMAZON · FLIPKART · MYNTRA</span>
          <h1>List once.<br /><em>Sell everywhere.</em></h1>
          <p>Add a product to SellersGrid and publish it to every marketplace you sell on. Stock, orders and payouts stay in sync, in one place.</p>
          <div className="heroActions">
            <Link className="primary" href="/login">Start your free trial</Link>
            <a className="secondary" href="#platform">See how it works</a>
          </div>
          <small style={{ color: "var(--muted)", fontSize: 12 }}>14-day free trial · No credit card required</small>
        </div>

        <div className="marketingVisual" aria-label="Publishing workflow preview">
          <span className="visualLabel">LIVE PUBLISHING WORKFLOW</span>
          <div className="visualProduct">
            <span className="productInit" style={{ width: 44, height: 44, fontSize: 10 }}>OCK</span>
            <div>
              <strong>Organic Cotton Kurta – Indigo</strong>
              <small>MF-APP-108 · 5 sizes · 140 in stock</small>
            </div>
            <strong>₹849</strong>
          </div>
          {[
            { name: "Amazon India", cls: "amazon", short: "AZ", status: "Live" },
            { name: "Flipkart", cls: "flipkart", short: "FK", status: "Live" },
            { name: "Myntra", cls: "myntra", short: "MY", status: "In upload file" },
          ].map(ch => (
            <div className="visualChannel" key={ch.name}>
              <span className={ch.cls}>{ch.short}</span>
              <strong>{ch.name}</strong>
              <b>✓</b>
            </div>
          ))}
        </div>
      </section>

      <section className="trustStrip">
        <span>One catalog</span><i />
        <span>Auto stock sync</span><i />
        <span>Orders in one queue</span><i />
        <span>Real margin visibility</span>
      </section>

      <section className="benefitSection" id="platform">
        <span className="sectionKicker">BUILT FOR INDIAN MULTICHANNEL SELLERS</span>
        <h2>A calmer way to run<br />a complex selling operation.</h2>
        <div className="benefitGrid">
          {benefits.map(([title, text], i) => (
            <article key={title as string}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="securitySection" id="security">
        <div>
          <span className="sectionKicker">SECURE BY DESIGN</span>
          <h2>Your marketplace accounts stay yours.</h2>
          <p>We never store your marketplace password. Access keys are encrypted, tenant-scoped and can be revoked from the marketplace at any time. HttpOnly sessions, signed webhooks and strict CSP are built in.</p>
        </div>
        <Link className="primary" href="/login" style={{ padding: "14px 20px", fontSize: 14, borderRadius: 8 }}>
          Start selling with SellersGrid
        </Link>
      </section>
    </main>
  );
}
