import { BadGatewayException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { send } from "@vercel/queue";
import { compare, hash } from "bcryptjs";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { JwtService } from "@nestjs/jwt";
import type { Response } from "express";
import { PrismaService } from "./prisma.service";
import { Prisma } from "@prisma/client";
import { ProductDto, RegisterDto, SettingsDto, StoreCredentialsDto } from "./api.dto";
import { encryptJson, safeEqual, SessionUser } from "./security";
import { ConnectorsService } from "./connectors";

@Injectable()
export class AppService {
  constructor(
  private readonly db: PrismaService,
  private readonly jwt: JwtService,
  private readonly connectors: ConnectorsService
) {}
  private assertEditor(session: SessionUser) { if (session.role === "VIEWER") throw new ForbiddenException("This role has read-only access"); }

  async register(dto: RegisterDto, response: Response) {
    if (await this.db.user.findUnique({ where: { email: dto.email } })) throw new ConflictException("Email is already registered");
    const passwordHash = await hash(dto.password, 12);
    const user = await this.db.user.create({ data: { name: dto.name, email: dto.email, passwordHash, memberships: { create: { role: "OWNER", organization: { create: { name: dto.organizationName } } } } }, include: { memberships: true } });
    return this.issueSession(response, { userId: user.id, organizationId: user.memberships[0].organizationId, role: user.memberships[0].role });
  }

  async login(email: string, password: string, response: Response) {
    const user = await this.db.user.findUnique({ where: { email }, include: { memberships: { take: 1 } } });
    if (!user || !await compare(password, user.passwordHash) || !user.memberships[0]) throw new UnauthorizedException("Invalid email or password");
    return this.issueSession(response, { userId: user.id, organizationId: user.memberships[0].organizationId, role: user.memberships[0].role });
  }

  logout(response: Response) { response.clearCookie("marketflow_session", this.cookieOptions()); return { ok: true }; }
  private issueSession(response: Response, session: SessionUser) {
    response.cookie("marketflow_session", this.jwt.sign(session, { expiresIn: "8h" }), { ...this.cookieOptions(), maxAge: 8 * 60 * 60 * 1000 });
    return this.me(session);
  }
  private cookieOptions() { return { httpOnly: true, sameSite: "lax" as const, secure: process.env.SESSION_COOKIE_SECURE === "true", path: "/" }; }

  async me(session: SessionUser) {
    const membership = await this.db.membership.findUnique({ where: { userId_organizationId: { userId: session.userId, organizationId: session.organizationId } }, include: { user: { select: { id: true, name: true, email: true } }, organization: true } });
    if (!membership) throw new UnauthorizedException();
    return { user: membership.user, organization: membership.organization, role: membership.role };
  }

  async dashboard(session: SessionUser) {
    const [products, stores, orders, jobs, sales] = await Promise.all([
      this.db.product.count({ where: { organizationId: session.organizationId, status: { not: "ARCHIVED" } } }),
      this.db.store.count({ where: { organizationId: session.organizationId, status: "CONNECTED" } }),
      this.db.order.count({ where: { organizationId: session.organizationId } }),
      this.db.publishJob.count({ where: { organizationId: session.organizationId, status: "FAILED" } }),
      this.db.order.aggregate({ where: { organizationId: session.organizationId, status: { not: "CANCELLED" } }, _sum: { total: true } }),
    ]);
    const listings = await this.db.listing.count({ where: { product: { organizationId: session.organizationId }, status: "PUBLISHED" } });
    return { sales: Number(sales._sum.total ?? 0), orders, products, listings, stores, needsAttention: jobs };
  }

  listProducts(session: SessionUser, query = "") { return this.db.product.findMany({ where: { organizationId: session.organizationId, status: { not: "ARCHIVED" }, ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { sku: { contains: query, mode: "insensitive" } }] } : {}) }, include: { images: true, listings: { include: { store: { select: { id: true, name: true, marketplace: true } } } } }, orderBy: { updatedAt: "desc" }, take: 100 }); }
  async getProduct(session: SessionUser, id: string) { const product = await this.db.product.findFirst({ where: { id, organizationId: session.organizationId }, include: { images: true, listings: { include: { store: true } } } }); if (!product) throw new NotFoundException("Product not found"); return product; }
  async createProduct(session: SessionUser, dto: ProductDto) { this.assertEditor(session); const product = await this.db.product.create({ data: { ...dto, attributes: dto.attributes as Prisma.InputJsonValue | undefined, organizationId: session.organizationId, status: "ACTIVE" } }); await this.audit(session, "product.created", "Product", product.id); return product; }
  async updateProduct(session: SessionUser, id: string, dto: ProductDto) { this.assertEditor(session); await this.getProduct(session, id); const product = await this.db.product.update({ where: { id }, data: { ...dto, attributes: dto.attributes as Prisma.InputJsonValue | undefined } }); await this.audit(session, "product.updated", "Product", id); return product; }
  async archiveProduct(session: SessionUser, id: string) { this.assertEditor(session); await this.getProduct(session, id); await this.db.product.update({ where: { id }, data: { status: "ARCHIVED" } }); await this.audit(session, "product.archived", "Product", id); return { ok: true }; }
  async updateInventory(session: SessionUser, id: string, stock: number) { this.assertEditor(session); await this.getProduct(session, id); const product = await this.db.product.update({ where: { id }, data: { stock } }); await this.audit(session, "inventory.updated", "Product", id, { stock }); return product; }

  async updateProductCost(session: SessionUser, id: string, costPerUnit: number) {
    this.assertEditor(session);
    const product = await this.getProduct(session, id);
    const attrs = (product.attributes as Record<string, unknown> | null) ?? {};
    const updated = await this.db.product.update({ where: { id }, data: { attributes: { ...attrs, costPerUnit } as Prisma.InputJsonValue } });
    await this.audit(session, "product.cost_updated", "Product", id, { costPerUnit });
    return updated;
  }

  async uploadImage(session: SessionUser, productId: string, file: Express.Multer.File) {
    this.assertEditor(session);
    await this.getProduct(session, productId);
    if (!file || file.size > 10 * 1024 * 1024) throw new ConflictException("Image must be 10 MB or smaller");
    const valid = file.mimetype === "image/png" && file.buffer.subarray(0, 4).equals(Buffer.from([0x89,0x50,0x4e,0x47]))
      || file.mimetype === "image/jpeg" && file.buffer.subarray(0, 3).equals(Buffer.from([0xff,0xd8,0xff]))
      || file.mimetype === "image/webp" && file.buffer.subarray(0, 4).toString("ascii") === "RIFF" && file.buffer.subarray(8, 12).toString("ascii") === "WEBP";
    if (!valid) throw new ConflictException("Only valid PNG, JPEG and WEBP images are accepted");
    const base = resolve(process.env.STORAGE_PATH ?? "./storage"); await mkdir(base, { recursive: true });
    const objectKey = randomUUID(); await writeFile(resolve(base, objectKey), file.buffer, { flag: "wx" });
    return this.db.productImage.create({ data: { productId, objectKey, mimeType: file.mimetype, size: file.size } });
  }
  async image(session: SessionUser, imageId: string) { const image = await this.db.productImage.findFirst({ where: { id: imageId, product: { organizationId: session.organizationId } } }); if (!image) throw new NotFoundException(); return { image, data: await readFile(resolve(process.env.STORAGE_PATH ?? "./storage", image.objectKey)) }; }

  listStores(session: SessionUser) { return this.db.store.findMany({ where: { organizationId: session.organizationId }, select: { id: true, marketplace: true, name: true, externalAccountId: true, status: true, settings: true, lastSyncAt: true, createdAt: true, _count: { select: { listings: true, orders: true } } }, orderBy: { createdAt: "asc" } }); }
  async connectStore(session: SessionUser, dto: StoreCredentialsDto) {
    this.assertEditor(session);
    const credentialValues = Object.values(dto.credentials);
    if (!credentialValues.length || credentialValues.length > 12 || credentialValues.some(value => typeof value !== "string" || !value.trim() || value.length > 4096)) throw new ConflictException("Complete marketplace credentials are required");
    const externalAccountId = dto.externalAccountId || (dto.marketplace === "SHOPIFY" ? dto.credentials.shop : undefined);
    const store = await this.db.store.create({ data: { organizationId: session.organizationId, marketplace: dto.marketplace, name: dto.name, externalAccountId, encryptedCredentials: encryptJson(dto.credentials), settings: dto.settings as Prisma.InputJsonValue | undefined, status: "CONNECTED", lastSyncAt: new Date() } });
    await this.audit(session, "store.connected", "Store", store.id, { marketplace: store.marketplace }); return { ...store, encryptedCredentials: undefined };
  }
  async disconnectStore(session: SessionUser, id: string) { this.assertEditor(session); const store = await this.db.store.findFirst({ where: { id, organizationId: session.organizationId } }); if (!store) throw new NotFoundException(); await this.db.store.update({ where: { id }, data: { status: "DISCONNECTED", encryptedCredentials: null } }); await this.audit(session, "store.disconnected", "Store", id); return { ok: true }; }
  shopifyOAuthStart(session: SessionUser, shop: string) {
    this.assertEditor(session);
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    if (!clientId) throw new ConflictException("Shopify OAuth is not configured");
    const state = this.jwt.sign({ kind: "shopify-oauth", ...session, shop }, { expiresIn: "10m" });
    const redirectUri = `${process.env.APP_ORIGIN ?? "http://localhost:3000"}/api/stores/oauth/shopify/callback`;
    const params = new URLSearchParams({ client_id: clientId, scope: process.env.SHOPIFY_SCOPES ?? "write_products,read_orders", redirect_uri: redirectUri, state });
    return { url: `https://${shop}/admin/oauth/authorize?${params}` };
  }
  async shopifyOAuthCallback(input: Record<string, unknown>) {
    if (Object.keys(input).length > 20 || Object.values(input).some(value => typeof value !== "string" || value.length > 8192)) throw new UnauthorizedException("Invalid Shopify authorization parameters");
    const query = input as Record<string, string>;
    const secret = process.env.SHOPIFY_CLIENT_SECRET;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    if (!secret || !clientId || !query.code || !query.state || !query.hmac || !query.shop) throw new UnauthorizedException("Incomplete Shopify authorization");
    const message = Object.keys(query).filter(key => key !== "hmac").sort().map(key => `${key}=${query[key]}`).join("&");
    if (!safeEqual(query.hmac, createHmac("sha256", secret).update(message).digest("hex"))) throw new UnauthorizedException("Invalid Shopify authorization signature");
    const session = this.jwt.verify<SessionUser & { kind: string; shop: string }>(query.state);
    if (session.kind !== "shopify-oauth" || session.shop !== query.shop) throw new UnauthorizedException("Invalid Shopify authorization state");
    const response = await fetch(`https://${session.shop}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ client_id: clientId, client_secret: secret, code: query.code }), signal: AbortSignal.timeout(20_000) });
    const result = await response.json() as { access_token?: string; scope?: string; error_description?: string };
    if (!response.ok || !result.access_token) throw new BadGatewayException(result.error_description ?? "Shopify token exchange failed");
    const existing = await this.db.store.findUnique({ where: { marketplace_externalAccountId: { marketplace: "SHOPIFY", externalAccountId: session.shop } } });
    if (existing && existing.organizationId !== session.organizationId) throw new ConflictException("This Shopify store is already connected to another organization");
    const store = await this.db.store.upsert({ where: { marketplace_externalAccountId: { marketplace: "SHOPIFY", externalAccountId: session.shop } }, create: { organizationId: session.organizationId, marketplace: "SHOPIFY", name: session.shop.replace(".myshopify.com", ""), externalAccountId: session.shop, encryptedCredentials: encryptJson({ accessToken: result.access_token, shop: session.shop }), settings: { scopes: result.scope }, status: "CONNECTED", lastSyncAt: new Date() }, update: { encryptedCredentials: encryptJson({ accessToken: result.access_token, shop: session.shop }), settings: { scopes: result.scope }, status: "CONNECTED", lastSyncAt: new Date() } });
    await this.audit(session, "store.oauth_connected", "Store", store.id, { marketplace: "SHOPIFY" });
    return store;
  }

  async validatePublish(session: SessionUser, productId: string, storeIds: string[]) {
    const product = await this.getProduct(session, productId);
    const stores = await this.db.store.findMany({ where: { id: { in: storeIds }, organizationId: session.organizationId } });
    return stores.map(store => ({ storeId: store.id, marketplace: store.marketplace, ...this.connectors.validate(product, store) }));
  }
  async publish(session: SessionUser, productId: string, storeIds: string[]) {
    this.assertEditor(session);
    await this.getProduct(session, productId);
    const stores = await this.db.store.findMany({ where: { id: { in: storeIds }, organizationId: session.organizationId, status: "CONNECTED" } });
    if (stores.length !== storeIds.length) throw new ConflictException("One or more selected stores are unavailable");
    const records = [];
    for (const store of stores) {
      const record = await this.db.publishJob.create({ data: { organizationId: session.organizationId, productId, storeId: store.id } });
      await this.db.listing.upsert({ where: { productId_storeId: { productId, storeId: store.id } }, create: { productId, storeId: store.id, status: "QUEUED" }, update: { status: "QUEUED", errorMessage: null } });
      const { messageId } = await send("marketplace-publishing", { publishJobId: record.id }, { idempotencyKey: record.id });
      records.push(await this.db.publishJob.update({ where: { id: record.id }, data: { bullJobId: messageId ?? record.id } }));
    }
    await this.audit(session, "product.publish_queued", "Product", productId, { stores: storeIds.length }); return records;
  }
  listJobs(session: SessionUser) { return this.db.publishJob.findMany({ where: { organizationId: session.organizationId }, include: { product: { select: { name: true, sku: true } }, store: { select: { name: true, marketplace: true } } }, orderBy: { createdAt: "desc" }, take: 100 }); }
  async retryJob(session: SessionUser, id: string) {
    this.assertEditor(session);

    const record = await this.db.publishJob.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!record) {
      throw new NotFoundException();
    }

    await this.db.publishJob.update({
      where: { id },
      data: {
        status: "QUEUED",
        errorMessage: null,
      },
    });

    const { messageId } = await send(
      "marketplace-publishing",
      { publishJobId: id },
      {
        idempotencyKey: `${id}-${Date.now()}`,
      },
    );

    await this.db.publishJob.update({
      where: { id },
      data: {
        bullJobId: messageId ?? id,
      },
    });

    return { ok: true };
  }

  listOrders(session: SessionUser) { return this.db.order.findMany({ where: { organizationId: session.organizationId }, include: { store: { select: { name: true, marketplace: true } } }, orderBy: { orderedAt: "desc" }, take: 200 }); }
  async setOrderStatus(session: SessionUser, id: string, status: "UNFULFILLED"|"PROCESSING"|"FULFILLED"|"CANCELLED") { this.assertEditor(session); const order = await this.db.order.findFirst({ where: { id, organizationId: session.organizationId } }); if (!order) throw new NotFoundException(); return this.db.order.update({ where: { id }, data: { status } }); }
  async shopifyWebhook(rawBody: Buffer | undefined, headers: Record<string, string | string[] | undefined>) {
    const secret = process.env.SHOPIFY_CLIENT_SECRET;
    const signature = String(headers["x-shopify-hmac-sha256"] ?? "");
    if (!secret || !rawBody || !signature || !safeEqual(signature, createHmac("sha256", secret).update(rawBody).digest("base64"))) throw new UnauthorizedException("Invalid Shopify webhook signature");
    const shop = String(headers["x-shopify-shop-domain"] ?? "").toLowerCase();
    const topic = String(headers["x-shopify-topic"] ?? "");
    const externalId = String(headers["x-shopify-webhook-id"] ?? "");
    if (!shop || !topic || !externalId) throw new ConflictException("Missing Shopify webhook headers");
    const store = await this.db.store.findUnique({ where: { marketplace_externalAccountId: { marketplace: "SHOPIFY", externalAccountId: shop } } });
    if (!store || store.status !== "CONNECTED") throw new NotFoundException("Shopify store is not connected");
    const previous = await this.db.webhookEvent.findUnique({ where: { marketplace_externalId: { marketplace: "SHOPIFY", externalId } } });
    if (previous?.processedAt) return { ok: true, duplicate: true };
    const event = previous ?? await this.db.webhookEvent.create({ data: { marketplace: "SHOPIFY", externalId, topic } });
    const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    if (topic === "orders/create" || topic === "orders/updated") {
      const id = String(payload.id ?? "");
      if (!id) throw new ConflictException("Shopify order ID is missing");
      const customer = payload.customer && typeof payload.customer === "object" ? payload.customer as Record<string, unknown> : {};
      const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || String(payload.email ?? "Guest customer");
      const status = payload.cancelled_at ? "CANCELLED" : payload.fulfillment_status === "fulfilled" ? "FULFILLED" : "UNFULFILLED";
      await this.db.order.upsert({ where: { storeId_externalId: { storeId: store.id, externalId: id } }, create: { organizationId: store.organizationId, storeId: store.id, externalId: id, customerName: name, total: String(payload.total_price ?? "0"), currency: String(payload.currency ?? "INR"), orderedAt: new Date(String(payload.created_at ?? new Date().toISOString())), status }, update: { customerName: name, total: String(payload.total_price ?? "0"), status } });
    }
    await this.db.$transaction([this.db.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } }), this.db.store.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } })]);
    return { ok: true };
  }
  async analytics(session: SessionUser) { const orders = await this.db.order.groupBy({ by: ["status"], where: { organizationId: session.organizationId }, _count: true, _sum: { total: true } }); const channels = await this.db.order.groupBy({ by: ["storeId"], where: { organizationId: session.organizationId }, _count: true, _sum: { total: true } }); return { orders, channels }; }

  async profitability(session: SessionUser, days: number) {
    const since = new Date(Date.now() - days * 86_400_000);

    // All non-cancelled orders in period
    const orders = await this.db.order.findMany({
      where: { organizationId: session.organizationId, status: { not: "CANCELLED" }, orderedAt: { gte: since } },
      include: { store: { select: { id: true, name: true, marketplace: true } } },
      orderBy: { orderedAt: "asc" },
    });

    // Stores
    const stores = await this.db.store.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true, marketplace: true, _count: { select: { listings: true, orders: true } } },
    });

    // Products with listings
    const products = await this.db.product.findMany({
      where: { organizationId: session.organizationId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, sku: true, price: true, stock: true, attributes: true, listings: { select: { storeId: true, status: true } } },
    });

    // ── Marketplace fee rates (industry standard approximations) ──
    const feeRates: Record<string, number> = { AMAZON: 0.15, FLIPKART: 0.16, MYNTRA: 0.22, SHOPIFY: 0.03, EBAY: 0.13 };
    // ── Shipping cost per order (flat approx) ──
    const shippingPerOrder: Record<string, number> = { AMAZON: 98, FLIPKART: 105, MYNTRA: 0, SHOPIFY: 60, EBAY: 80 };

    const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const totalOrders = orders.length;

    // ── By channel ──
    const byChannel = stores.map(store => {
      const storeOrders = orders.filter(o => o.storeId === store.id);
      const revenue = storeOrders.reduce((s, o) => s + Number(o.total), 0);
      const feeRate = feeRates[store.marketplace] ?? 0.15;
      const shipRate = shippingPerOrder[store.marketplace] ?? 90;
      const fees = revenue * feeRate;
      const shipping = storeOrders.length * shipRate;
      const productCost = revenue * 0.46; // 46% COGS estimate
      const returns = revenue * 0.045;
      const netProfit = revenue - fees - shipping - productCost - returns;
      const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
      return {
        storeId: store.id,
        name: store.name,
        marketplace: store.marketplace,
        revenue,
        orders: storeOrders.length,
        fees,
        feeRate: feeRate * 100,
        shippingTotal: shipping,
        shippingPerOrder: shipRate,
        productCost,
        returns,
        netProfit,
        netMargin: margin,
        listings: store._count.listings,
      };
    }).filter(c => c.orders > 0).sort((a, b) => b.revenue - a.revenue);

    // ── By product (estimated, using price × estimated sold qty) ──
    const byProduct = products.map(p => {
      const price = Number(p.price);
      const attrs = p.attributes as Record<string, unknown> | null;
      const costPerUnit = attrs?.costPerUnit ? Number(attrs.costPerUnit) : price * 0.46;
      const publishedChannels = p.listings.filter(l => l.status === "PUBLISHED").length;
      // Estimate units sold from orders (use total orders split evenly across published products)
      const estimatedUnits = publishedChannels > 0
        ? Math.max(1, Math.round(totalOrders / Math.max(products.filter(x => x.listings.some(l => l.status === "PUBLISHED")).length, 1)))
        : 0;
      const revenue = estimatedUnits * price;
      const fees = revenue * 0.16;
      const shipping = estimatedUnits * 100;
      const productCost = estimatedUnits * costPerUnit;
      const profitPerUnit = price - costPerUnit - (price * 0.16) - 100;
      const totalProfit = profitPerUnit * estimatedUnits;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        price,
        costPerUnit,
        estimatedUnits,
        revenue,
        fees,
        shipping,
        productCost,
        profitPerUnit,
        totalProfit,
        margin: price > 0 ? (profitPerUnit / price) * 100 : 0,
        publishedChannels,
        stock: p.stock,
      };
    }).sort((a, b) => b.totalProfit - a.totalProfit);

    // ── Overall waterfall ──
    const totalFees = byChannel.reduce((s, c) => s + c.fees, 0);
    const totalShipping = byChannel.reduce((s, c) => s + c.shippingTotal, 0);
    const totalProductCost = totalRevenue * 0.46;
    const totalReturns = totalRevenue * 0.045;
    const totalNetProfit = totalRevenue - totalFees - totalShipping - totalProductCost - totalReturns;

    // ── Weekly revenue trend (last 8 weeks) ──
    const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
      const weekStart = new Date(since.getTime() + i * 7 * 86_400_000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
      const weekOrders = orders.filter(o => {
        const d = new Date(o.orderedAt);
        return d >= weekStart && d < weekEnd;
      });
      const breakdown: Record<string, number> = {};
      stores.forEach(s => {
        breakdown[s.name] = weekOrders.filter(o => o.storeId === s.id).reduce((sum, o) => sum + Number(o.total), 0);
      });
      return {
        week: `W${i + 1}`,
        label: weekStart.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        total: weekOrders.reduce((s, o) => s + Number(o.total), 0),
        orders: weekOrders.length,
        breakdown,
      };
    });

    // ── Return / RTO rate ──
    const cancelledOrders = await this.db.order.count({ where: { organizationId: session.organizationId, status: "CANCELLED", orderedAt: { gte: since } } });
    const totalOrdersInPeriod = orders.length + cancelledOrders;
    const returnRate = totalOrdersInPeriod > 0 ? (cancelledOrders / totalOrdersInPeriod) * 100 : 0;

    return {
      period: days,
      summary: {
        revenue: totalRevenue,
        netProfit: totalNetProfit,
        fees: totalFees,
        shipping: totalShipping,
        productCost: totalProductCost,
        returns: totalReturns,
        orders: totalOrders,
        margin: totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        returnRate,
      },
      byChannel,
      byProduct,
      weeklyTrend,
      storeNames: stores.reduce((m, s) => { m[s.id] = s.name; return m; }, {} as Record<string, string>),
    };
  }
  async updateSettings(session: SessionUser, dto: SettingsDto) { if (!(["OWNER","ADMIN"] as string[]).includes(session.role)) throw new UnauthorizedException(); return this.db.organization.update({ where: { id: session.organizationId }, data: { name: dto.organizationName } }); }
  audit(session: SessionUser, action: string, entityType: string, entityId?: string, metadata?: Record<string, unknown>) { return this.db.auditLog.create({ data: { organizationId: session.organizationId, userId: session.userId, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue | undefined } }); }
}
