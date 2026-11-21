/**
 * SellersGrid — comprehensive seed script
 * Run: node scripts/seed.mjs
 *
 * Seeds:
 *  - 1 organization (ABC Retail Pvt Ltd) owned by abhay@abcretail.in
 *  - 4 extra team members (admin, catalog manager, ops, viewer)
 *  - 3 connected stores (Amazon India, Flipkart, Myntra)
 *  - 12 products across 5 categories, all ACTIVE, realistic Indian data
 *  - Listings for each product × each store (mix of PUBLISHED / FAILED / DRAFT)
 *  - 8 publish jobs (mix of COMPLETED / FAILED / QUEUED)
 *  - 58 orders (mix of UNFULFILLED / PROCESSING / FULFILLED / CANCELLED)
 *  - Audit log entries
 */

import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { hashSync } from "bcryptjs";

const db = new PrismaClient();

/* ── helpers ── */
const uuid = () => crypto.randomUUID();
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const hoursAgo = (n) => new Date(Date.now() - n * 3_600_000);
const minutesAgo = (n) => new Date(Date.now() - n * 60_000);

async function main() {
  console.log("🌱  Starting seed…");

  /* ── 1. Find the existing owner account ── */
  const owner = await db.user.findUnique({ where: { email: "abhay@abcretail.in" }, include: { memberships: { include: { organization: true } } } });
  if (!owner) { console.error("❌  Owner account not found. Register first at /login."); process.exit(1); }
  const org = owner.memberships[0].organization;
  const orgId = org.id;
  console.log(`✅  Org: ${org.name} (${orgId})`);

  /* ── 2. Update org plan label ── */
  await db.organization.update({ where: { id: orgId }, data: { plan: "GROWTH", name: "ABC Retail Pvt Ltd" } });

  /* ── 3. Team members ── */
  const teamData = [
    { email: "neha@abcretail.in",  name: "Neha Kulkarni", role: "ADMIN" },
    { email: "imran@abcretail.in", name: "Imran Shaikh",  role: "STAFF" },
    { email: "priya@abcretail.in", name: "Priya Nair",    role: "VIEWER" },
    { email: "ravi@abcretail.in",  name: "Ravi Menon",    role: "STAFF" },
  ];
  const ph = hashSync("Sellersgrid@123", 10);
  for (const t of teamData) {
    const u = await db.user.upsert({
      where: { email: t.email },
      create: { name: t.name, email: t.email, passwordHash: ph },
      update: { name: t.name },
    });
    await db.membership.upsert({
      where: { userId_organizationId: { userId: u.id, organizationId: orgId } },
      create: { userId: u.id, organizationId: orgId, role: t.role },
      update: { role: t.role },
    });
  }
  console.log("✅  Team members created");

  /* ── 4. Stores ── */
  const storeData = [
    { marketplace: "AMAZON",   name: "Amazon India",   extId: "ABC_RETAIL_IN",   lastSync: minutesAgo(2) },
    { marketplace: "FLIPKART", name: "Flipkart",        extId: "ABC_ENTERPRISES", lastSync: minutesAgo(4) },
    { marketplace: "FLIPKART", name: "Myntra",          extId: "MERCHANT_41872",  lastSync: minutesAgo(6) }, // using FLIPKART enum as MYNTRA not in enum
  ];

  // Use AMAZON, FLIPKART only (schema constraint); simulate Myntra as a second FLIPKART store
  const storeRows = [];
  for (const s of [
    { marketplace: "AMAZON",   name: "Amazon India",   extId: "ABC-RETAIL-IN",   lastSync: minutesAgo(2) },
    { marketplace: "FLIPKART", name: "Flipkart",        extId: "ABC-ENTERPRISES", lastSync: minutesAgo(4) },
    { marketplace: "FLIPKART", name: "Myntra",          extId: "MERCHANT-41872",  lastSync: minutesAgo(6) },
  ]) {
    try {
      const store = await db.store.upsert({
        where: { marketplace_externalAccountId: { marketplace: s.marketplace, externalAccountId: s.extId } },
        create: {
          organizationId: orgId,
          marketplace: s.marketplace,
          name: s.name,
          externalAccountId: s.extId,
          status: "CONNECTED",
          encryptedCredentials: "seed-placeholder",
          lastSyncAt: s.lastSync,
        },
        update: { status: "CONNECTED", lastSyncAt: s.lastSync, name: s.name },
      });
      storeRows.push(store);
    } catch (e) {
      console.warn(`  Store ${s.name} skip: ${e.message}`);
    }
  }
  const [storeAZ, storeFK, storeMY] = storeRows;
  console.log(`✅  Stores: ${storeRows.map(s => s.name).join(", ")}`);

  /* ── 5. Products ── */
  const products = [
    {
      sku: "MF-APP-108", name: "Organic Cotton Kurta – Indigo",
      category: "Apparel", brand: "Heritage India Crafts",
      description: "Handwoven on traditional looms, this straight-fit kurta is light and breathable for everyday wear. Natural indigo dye, mandarin collar and side slits.",
      price: "849.00", compareAtPrice: "1899.00", stock: 140, status: "ACTIVE",
      attributes: { hsn: "6204", gst: 5, sizes: ["S","M","L","XL","XXL"], color: "Indigo" },
    },
    {
      sku: "MF-BEA-301", name: "Ayurvedic Kumkumadi Face Oil",
      category: "Beauty", brand: "Veda Essentials",
      description: "Cold-pressed blend of saffron, sandalwood and lotus extracts. Reduces dark spots and brightens skin tone in 4–6 weeks.",
      price: "1450.00", compareAtPrice: "2200.00", stock: 62, status: "ACTIVE",
      attributes: { hsn: "3304", gst: 18, volume: "30ml", skin_type: "All" },
    },
    {
      sku: "MF-HOM-042", name: "Handcrafted Brass Diya Set",
      category: "Home decor", brand: "Dhokra Artisans",
      description: "Set of 5 intricately cast brass diyas in antique and polished finishes. Each piece is hand-finished by tribal artisans in Bastar, Chhattisgarh.",
      price: "1299.00", compareAtPrice: "2999.00", stock: 84, status: "ACTIVE",
      attributes: { hsn: "7419", gst: 12, finish: ["Antique", "Polished"], pieces: 5 },
    },
    {
      sku: "MF-BRS-702", name: "Brass Dhokra Elephant Figurine",
      category: "Home decor", brand: "Dhokra Artisans",
      description: "Lost-wax cast brass elephant in traditional Dhokra style. Each piece is unique. Approx 15 cm tall.",
      price: "2499.00", compareAtPrice: "3999.00", stock: 140, status: "ACTIVE",
      attributes: { hsn: "7419", gst: 12, height_cm: 15 },
    },
    {
      sku: "TX-SLK-IND-01", name: "Raw Mulberry Silk Stole",
      category: "Apparel", brand: "Sutra Silks",
      description: "Hand-woven pure mulberry silk stole in ivory, rose and indigo. 72 × 200 cm. Machine-washable on gentle cycle.",
      price: "4500.00", compareAtPrice: "6800.00", stock: 38, status: "ACTIVE",
      attributes: { hsn: "6214", gst: 5, colors: ["Ivory","Rose","Indigo"], size_cm: "72x200" },
    },
    {
      sku: "TEX-PASH-88", name: "Pashmina Weave Throw – Plum",
      category: "Home textiles", brand: "Himalayan Looms",
      description: "140-count pashmina-blend throw in deep plum with a subtle herringbone weave. 130 × 170 cm. Dry-clean only.",
      price: "8990.00", compareAtPrice: "12500.00", stock: 12, status: "ACTIVE",
      attributes: { hsn: "6301", gst: 12, color: "Plum", size_cm: "130x170" },
    },
    {
      sku: "MF-ELE-552", name: "Wireless Earbuds TWS 5.3",
      category: "Electronics", brand: "SoundPulse",
      description: "Bluetooth 5.3 earbuds with 32-hour total battery, active noise cancellation and IPX5 water resistance. USB-C charging case.",
      price: "1999.00", compareAtPrice: "4999.00", stock: 0, status: "ACTIVE",
      attributes: { hsn: "8518", gst: 18, battery_hrs: 32, bluetooth: "5.3", waterproof: "IPX5" },
    },
    {
      sku: "MF-FUR-019", name: "Ergonomic Mesh Chair Pro",
      category: "Furniture", brand: "WorkNest",
      description: "Full-mesh ergonomic chair with 4D armrests, lumbar support and tilt-lock. Supports up to 120 kg. Assembly required.",
      price: "7499.00", compareAtPrice: "14999.00", stock: 26, status: "ACTIVE",
      attributes: { hsn: "9401", gst: 18, max_load_kg: 120, colors: ["Grey","Black"] },
    },
    {
      sku: "MF-KIT-220", name: "Copper Hammered Water Bottle – 1L",
      category: "Kitchenware", brand: "PureCopper",
      description: "Hand-hammered pure copper water bottle with leak-proof lid. Ayurvedic tradition of storing water overnight in copper. 1-litre capacity.",
      price: "699.00", compareAtPrice: "1299.00", stock: 215, status: "ACTIVE",
      attributes: { hsn: "7418", gst: 12, volume_ml: 1000, material: "Pure copper" },
    },
    {
      sku: "MF-ART-005", name: "Madhubani Painting – Forest Motif",
      category: "Art", brand: "Mithila Arts",
      description: "Hand-painted Madhubani artwork on handmade paper by certified artisans from Mithila, Bihar. 40 × 60 cm, unframed. Certificate of authenticity included.",
      price: "3200.00", compareAtPrice: "5000.00", stock: 8, status: "ACTIVE",
      attributes: { hsn: "9701", gst: 12, size_cm: "40x60", framed: false },
    },
    {
      sku: "MF-SPA-011", name: "Sandal & Rose Body Scrub",
      category: "Beauty", brand: "Veda Essentials",
      description: "Exfoliating body scrub with Mysore sandalwood powder, rose petal extract and coconut oil. Sulfate-free and vegan.",
      price: "549.00", compareAtPrice: "899.00", stock: 180, status: "ACTIVE",
      attributes: { hsn: "3304", gst: 18, weight_g: 200, vegan: true },
    },
    {
      sku: "MF-APP-200", name: "Khadi Linen Shirt – Ecru",
      category: "Apparel", brand: "Heritage India Crafts",
      description: "Hand-spun khadi linen shirt in natural ecru. Regular fit, mandarin collar, wooden buttons. Sizes S–XXL.",
      price: "1150.00", compareAtPrice: "2200.00", stock: 55, status: "DRAFT",
      attributes: { hsn: "6205", gst: 5, sizes: ["S","M","L","XL","XXL"], color: "Ecru" },
    },
  ];

  const createdProducts = [];
  for (const p of products) {
    try {
      const prod = await db.product.upsert({
        where: { organizationId_sku: { organizationId: orgId, sku: p.sku } },
        create: { ...p, attributes: p.attributes, organizationId: orgId },
        update: { ...p, attributes: p.attributes },
      });
      createdProducts.push(prod);
    } catch (e) {
      console.warn(`  Product ${p.sku}: ${e.message}`);
    }
  }
  console.log(`✅  Products: ${createdProducts.length} upserted`);

  /* ── 6. Listings ── */
  const listingMatrix = [
    // [productIndex, storeIndex, status, externalId, errorMessage]
    [0, 0, "PUBLISHED", "ASIN-B0001CK108", null],
    [0, 1, "PUBLISHED", "FSN-APP108001",   null],
    [0, 2, "PUBLISHED", "STYLE-28471801",  null],
    [1, 0, "PUBLISHED", "ASIN-B0001KF301", null],
    [1, 1, "PUBLISHED", "FSN-BEA301001",   null],
    [1, 2, "PUBLISHED", "STYLE-28471802",  null],
    [2, 0, "PUBLISHED", "ASIN-B0001BD042", null],
    [2, 1, "FAILED",    "FSN-HOM042001",   "HSN tax code is missing"],
    [2, 2, "PUBLISHED", "STYLE-28471803",  null],
    [3, 0, "PUBLISHED", "ASIN-B0001BR702", null],
    [3, 1, "FAILED",    "FSN-BRS702001",   "HSN tax code is missing"],
    [3, 2, "DRAFT",     null,              null],
    [4, 0, "PUBLISHED", "ASIN-B0001SS101", null],
    [4, 1, "DRAFT",     null,              null],
    [4, 2, "PUBLISHED", "STYLE-28471804",  null],
    [5, 0, "DRAFT",     null,              null],
    [5, 1, "PUBLISHED", "FSN-TEX088001",   null],
    [5, 2, "PUBLISHED", "STYLE-28471805",  null],
    [6, 0, "PUBLISHED", "ASIN-B0001EL552", null],
    [6, 1, "FAILED",    "FSN-ELE552001",   "Price differs — changed on Flipkart directly"],
    [6, 2, "DRAFT",     null,              null],
    [7, 0, "FAILED",    "ASIN-B0001CH019", "Missing brand authorization — suppressed"],
    [7, 1, "DRAFT",     null,              null],
    [7, 2, "DRAFT",     null,              null],
    [8, 0, "PUBLISHED", "ASIN-B0001CP220", null],
    [8, 1, "PUBLISHED", "FSN-KIT220001",   null],
    [8, 2, "PUBLISHED", "STYLE-28471806",  null],
    [9, 0, "PUBLISHED", "ASIN-B0001ART05", null],
    [9, 1, "DRAFT",     null,              null],
    [9, 2, "PUBLISHED", "STYLE-28471807",  null],
    [10, 0, "PUBLISHED", "ASIN-B0001SP011", null],
    [10, 1, "PUBLISHED", "FSN-SPA011001",   null],
    [10, 2, "PUBLISHED", "STYLE-28471808",  null],
  ];

  for (const [pi, si, status, extId, errMsg] of listingMatrix) {
    if (!createdProducts[pi] || !storeRows[si]) continue;
    try {
      await db.listing.upsert({
        where: { productId_storeId: { productId: createdProducts[pi].id, storeId: storeRows[si].id } },
        create: {
          productId: createdProducts[pi].id,
          storeId: storeRows[si].id,
          status,
          externalId: extId,
          errorMessage: errMsg,
          publishedAt: status === "PUBLISHED" ? daysAgo(Math.floor(Math.random() * 30) + 1) : null,
        },
        update: { status, externalId: extId, errorMessage: errMsg },
      });
    } catch (e) {
      console.warn(`  Listing skip: ${e.message}`);
    }
  }
  console.log("✅  Listings created");

  /* ── 7. Publish jobs ── */
  const jobData = [
    { pi: 2, si: 1, status: "FAILED",    err: "HSN tax code is missing. Resubmit after fixing in catalog." },
    { pi: 3, si: 1, status: "FAILED",    err: "HSN tax code is missing." },
    { pi: 6, si: 1, status: "FAILED",    err: "Price differs — Flipkart price was changed directly." },
    { pi: 7, si: 0, status: "FAILED",    err: "Brand authorization missing — listing suppressed by Amazon." },
    { pi: 0, si: 0, status: "COMPLETED", err: null },
    { pi: 1, si: 0, status: "COMPLETED", err: null },
    { pi: 8, si: 1, status: "COMPLETED", err: null },
    { pi: 9, si: 2, status: "QUEUED",    err: null },
  ];

  for (const j of jobData) {
    if (!createdProducts[j.pi] || !storeRows[j.si]) continue;
    try {
      await db.publishJob.create({
        data: {
          organizationId: orgId,
          productId: createdProducts[j.pi].id,
          storeId: storeRows[j.si].id,
          status: j.status,
          attempt: j.status === "FAILED" ? 3 : 1,
          errorMessage: j.err,
          bullJobId: `seed-job-${uuid()}`,
          createdAt: hoursAgo(Math.floor(Math.random() * 6) + 1),
        },
      });
    } catch (e) {
      console.warn(`  Job skip: ${e.message}`);
    }
  }
  console.log("✅  Publish jobs created");

  /* ── 8. Orders ── */
  const customers = [
    ["Pooja Iyer",      "Amazon India"],
    ["Rohit Malhotra",  "Flipkart"],
    ["Ananya Sen",      "Myntra"],
    ["Vikram Rao",      "Amazon India"],
    ["Kaveri Joshi",    "Flipkart"],
    ["Meera Sen",       "Myntra"],
    ["Tariq Mansoor",   "Amazon India"],
    ["Sunita Krishnan", "Flipkart"],
    ["Arjun Mehta",     "Amazon India"],
    ["Divya Nair",      "Myntra"],
    ["Rahul Gupta",     "Amazon India"],
    ["Preethi Sharma",  "Flipkart"],
    ["Kiran Reddy",     "Amazon India"],
    ["Fatima Sheikh",   "Flipkart"],
    ["Deepak Patel",    "Myntra"],
  ];

  const orderStatuses = [
    "UNFULFILLED","UNFULFILLED","UNFULFILLED","UNFULFILLED","UNFULFILLED",
    "UNFULFILLED","UNFULFILLED","UNFULFILLED","PROCESSING","PROCESSING",
    "PROCESSING","PROCESSING","FULFILLED","FULFILLED","FULFILLED",
    "FULFILLED","FULFILLED","FULFILLED","FULFILLED","FULFILLED",
    "FULFILLED","FULFILLED","FULFILLED","FULFILLED","FULFILLED",
    "FULFILLED","FULFILLED","FULFILLED","FULFILLED","FULFILLED",
    "FULFILLED","FULFILLED","FULFILLED","FULFILLED","FULFILLED",
    "FULFILLED","FULFILLED","FULFILLED","FULFILLED","FULFILLED",
    "FULFILLED","FULFILLED","FULFILLED","FULFILLED","FULFILLED",
    "FULFILLED","FULFILLED","FULFILLED","FULFILLED","FULFILLED",
    "CANCELLED","CANCELLED","CANCELLED","CANCELLED","CANCELLED",
    "CANCELLED","CANCELLED","CANCELLED",
  ];

  const orderTotals = [1849,3299,4500,849,1698,8990,1450,2499,1299,699,1150,4500,3200,549,2499,849,1450,1999,8990,1299,849,4500,699,1299,2499,849,1450,8990,3200,549,4500,1999,699,1299,849,1150,4500,3200,549,2499,849,1450,8990,1299,699,1150,4500,3200,549,2499,849,4500,699,1299,2499,849,1450,8990];

  const storeByName = { "Amazon India": storeAZ, "Flipkart": storeFK, "Myntra": storeMY };

  for (let i = 0; i < 58; i++) {
    const [customerName, storeName] = customers[i % customers.length];
    const store = storeByName[storeName];
    if (!store) continue;
    const externalId = `SEED-${storeName.slice(0,2).toUpperCase()}-${String(10000 + i).padStart(5, "0")}`;
    try {
      await db.order.upsert({
        where: { storeId_externalId: { storeId: store.id, externalId } },
        create: {
          organizationId: orgId,
          storeId: store.id,
          externalId,
          status: orderStatuses[i],
          customerName,
          total: String(orderTotals[i % orderTotals.length]),
          currency: "INR",
          orderedAt: daysAgo(Math.floor(Math.random() * 30)),
        },
        update: { status: orderStatuses[i], total: String(orderTotals[i % orderTotals.length]) },
      });
    } catch (e) {
      console.warn(`  Order ${externalId}: ${e.message}`);
    }
  }
  console.log("✅  58 orders created");

  /* ── 9. Audit log ── */
  const auditEntries = [
    { action: "store.connected",       entityType: "Store",   meta: { marketplace: "AMAZON" } },
    { action: "store.connected",       entityType: "Store",   meta: { marketplace: "FLIPKART" } },
    { action: "product.created",       entityType: "Product", meta: { sku: "MF-APP-108" } },
    { action: "product.created",       entityType: "Product", meta: { sku: "MF-BEA-301" } },
    { action: "product.publish_queued",entityType: "Product", meta: { stores: 3 } },
    { action: "inventory.updated",     entityType: "Product", meta: { stock: 140 } },
    { action: "product.archived",      entityType: "Product", meta: { sku: "OLD-SKU-999" } },
  ];
  for (const e of auditEntries) {
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        userId: owner.id,
        action: e.action,
        entityType: e.entityType,
        metadata: e.meta,
        createdAt: daysAgo(Math.floor(Math.random() * 14)),
      },
    });
  }
  console.log("✅  Audit log entries created");

  /* ── Summary ── */
  const counts = await Promise.all([
    db.product.count({ where: { organizationId: orgId } }),
    db.store.count({ where: { organizationId: orgId } }),
    db.order.count({ where: { organizationId: orgId } }),
    db.publishJob.count({ where: { organizationId: orgId } }),
    db.listing.count({ where: { product: { organizationId: orgId } } }),
    db.membership.count({ where: { organizationId: orgId } }),
  ]);
  console.log(`\n📊  Final counts:`);
  console.log(`    Products : ${counts[0]}`);
  console.log(`    Stores   : ${counts[1]}`);
  console.log(`    Orders   : ${counts[2]}`);
  console.log(`    Jobs     : ${counts[3]}`);
  console.log(`    Listings : ${counts[4]}`);
  console.log(`    Members  : ${counts[5]}`);
  console.log(`\n🎉  Seed complete!`);
  console.log(`    Login: abhay@abcretail.in / Sellersgrid@123`);
}

main().catch(e => { console.error("❌ Seed failed:", e); process.exit(1); }).finally(() => db.$disconnect());
