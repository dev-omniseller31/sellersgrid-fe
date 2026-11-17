import Link from "next/link";

const benefits = [
  ["One master catalog", "Create product data once and map it cleanly to every connected channel."],
  ["Reliable publishing", "Queue-based jobs publish in parallel, retry safely, and show actionable errors."],
  ["Inventory clarity", "Keep stock, listings, and marketplace orders visible from one calm workspace."],
];

export default function MarketingPage() {
  return <main className="marketingShell">
    <nav className="marketingNav" aria-label="Main navigation">
      <Link className="brand" href="/"><span className="brandMark"><i/><i/><i/></span><span>MarketFlow</span></Link>
      <div><a href="#platform">Platform</a><a href="#security">Security</a><Link className="secondary" href="/login">Sign in</Link><Link className="primary" href="/login">Start selling</Link></div>
    </nav>
    <section className="marketingHero">
      <div><span className="authPill">MULTICHANNEL COMMERCE, SIMPLIFIED</span><h1>Create once.<br/><em>Sell everywhere.</em></h1><p>Connect your seller accounts, publish products across marketplaces, and run inventory and orders from one elegant operating system.</p><div className="heroActions"><Link className="primary" href="/login">Create your workspace</Link><a className="secondary" href="#platform">Explore the platform</a></div><small>No card required · Secure organization workspace</small></div>
      <div className="marketingVisual" aria-label="Publishing workflow preview"><span className="visualLabel">PUBLISHING WORKFLOW</span><div className="visualProduct"><span className="productThumb chair"><i/><b/></span><div><strong>Signature lounge chair</strong><small>SKU · CHAIR-OAK-01</small></div><b>₹12,499</b></div><div className="visualFlow"><i/><i/><i/></div>{["Shopify","Amazon","eBay"].map((name,index)=><div className="visualChannel" key={name}><span className={["shopify","amazon","ebay"][index]}>{name[0]}</span><strong>{name}</strong><small>Ready to publish</small><b>✓</b></div>)}</div>
    </section>
    <section className="trustStrip"><span>One click</span><i/><span>Parallel jobs</span><i/><span>Encrypted credentials</span><i/><span>Actionable retries</span></section>
    <section className="benefitSection" id="platform"><span className="sectionKicker">BUILT FOR SERIOUS SELLERS</span><h2>A quieter way to run<br/>a complex commerce operation.</h2><div className="benefitGrid">{benefits.map(([title,text],i)=><article key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="securitySection" id="security"><div><span className="sectionKicker">SECURE BY DESIGN</span><h2>Your channels stay yours.</h2><p>HttpOnly sessions, tenant-scoped data, encrypted marketplace credentials, signed webhooks, strict request validation, and a restrictive content security policy are built into the foundation.</p></div><Link className="primary" href="/login">Open MarketFlow</Link></section>
  </main>;
}
