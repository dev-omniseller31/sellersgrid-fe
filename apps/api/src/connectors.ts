import { BadRequestException, Injectable } from "@nestjs/common";
import type { Marketplace, Product, Store } from "@prisma/client";
import { decryptJson } from "./security";

type Credentials = Record<string, string>;
type ProductWithImages = Product & { images: { id: string }[] };
type PublishResult = { externalId: string; raw?: unknown };

async function marketplaceFetch(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000), redirect: "error" });
  const body = await response.text();
  let data: any = {};
  try { data = body ? JSON.parse(body) : {}; } catch { data = { message: body.slice(0, 400) }; }
  if (!response.ok) throw new Error(`${response.status}: ${data?.message ?? data?.errors?.[0]?.message ?? body.slice(0, 400)}`);
  return data;
}

@Injectable()
export class ConnectorsService {
  validate(product: ProductWithImages, store: Store) {
    const missing: string[] = [];
    if (!product.name) missing.push("name");
    if (!product.sku) missing.push("sku");
    if (!product.description) missing.push("description");
    if (Number(product.price) <= 0) missing.push("price");
    if (product.images.length === 0) missing.push("image");
    const attributes = (product.attributes ?? {}) as Record<string, any>;
    if (store.marketplace === "EBAY" && !attributes.ebay) missing.push("attributes.ebay");
    if (store.marketplace === "AMAZON" && !attributes.amazon) missing.push("attributes.amazon");
    if (store.marketplace === "FLIPKART" && !attributes.flipkart) missing.push("attributes.flipkart");
    return { ready: missing.length === 0, missing };
  }

  async publish(product: ProductWithImages, store: Store): Promise<PublishResult> {
    const validation = this.validate(product, store);
    if (!validation.ready) throw new BadRequestException(`Missing required fields: ${validation.missing.join(", ")}`);
    if (!store.encryptedCredentials) throw new Error(`${store.marketplace} credentials are not configured`);
    const credentials = decryptJson<Credentials>(store.encryptedCredentials);
    if (store.marketplace === "SHOPIFY") return this.shopify(product, credentials);
    if (store.marketplace === "EBAY") return this.ebay(product, credentials, store.settings as Record<string, string>);
    if (store.marketplace === "FLIPKART") return this.flipkart(product, credentials);
    return this.amazon(product, credentials, store.settings as Record<string, string>);
  }

  private async shopify(product: ProductWithImages, credentials: Credentials) {
    const shop = credentials.shop?.toLowerCase();
    if (!shop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) throw new Error("Invalid Shopify shop domain");
    const query = `mutation CreateProduct($product: ProductCreateInput!) { productCreate(product: $product) { product { id handle } userErrors { field message } } }`;
    const data = await marketplaceFetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
      method: "POST", headers: { "content-type": "application/json", "x-shopify-access-token": credentials.accessToken },
      body: JSON.stringify({ query, variables: { product: { title: product.name, descriptionHtml: product.description, vendor: product.brand, status: "ACTIVE" } } }),
    });
    const errors = data.data?.productCreate?.userErrors;
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(", "));
    return { externalId: data.data.productCreate.product.id, raw: data.data.productCreate.product };
  }

  private async ebay(product: ProductWithImages, credentials: Credentials, settings: Record<string, string> = {}) {
    const base = credentials.sandbox === "true" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
    const headers = { authorization: `Bearer ${credentials.accessToken}`, "content-type": "application/json", "content-language": "en-US" };
    const attrs = (product.attributes as any).ebay;
    await marketplaceFetch(`${base}/sell/inventory/v1/inventory_item/${encodeURIComponent(product.sku)}`, { method: "PUT", headers, body: JSON.stringify({ availability: { shipToLocationAvailability: { quantity: product.stock } }, condition: attrs.condition ?? "NEW", product: { title: product.name, description: product.description, aspects: attrs.aspects, imageUrls: attrs.imageUrls } }) });
    const offer = await marketplaceFetch(`${base}/sell/inventory/v1/offer`, { method: "POST", headers, body: JSON.stringify({ sku: product.sku, marketplaceId: settings.marketplaceId ?? "EBAY_IN", format: "FIXED_PRICE", availableQuantity: product.stock, categoryId: attrs.categoryId, listingDescription: product.description, listingPolicies: { fulfillmentPolicyId: settings.fulfillmentPolicyId, paymentPolicyId: settings.paymentPolicyId, returnPolicyId: settings.returnPolicyId }, merchantLocationKey: settings.locationKey, pricingSummary: { price: { currency: settings.currency ?? "INR", value: String(product.price) } } }) });
    const published = await marketplaceFetch(`${base}/sell/inventory/v1/offer/${offer.offerId}/publish`, { method: "POST", headers });
    return { externalId: published.listingId, raw: published };
  }

  private async flipkart(product: ProductWithImages, credentials: Credentials) {
    const attrs = (product.attributes as any).flipkart;
    const data = await marketplaceFetch("https://api.flipkart.net/sellers/listings/v3", { method: "POST", headers: { authorization: `Bearer ${credentials.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ [product.sku]: { ...attrs, selling_price: Number(product.price), stock_count: product.stock } }) });
    return { externalId: data?.[product.sku]?.listingId ?? product.sku, raw: data };
  }

  private async amazon(product: ProductWithImages, credentials: Credentials, settings: Record<string, string> = {}) {
    // Amazon requests require AWS SigV4 in addition to LWA. A signed proxy/gateway URL is deliberately explicit.
    if (!settings.signedListingsEndpoint) throw new Error("Amazon signedListingsEndpoint is required; configure an SP-API SigV4 gateway after Amazon developer approval");
    const endpoint = new URL(settings.signedListingsEndpoint);
    if (endpoint.protocol !== "https:") throw new Error("Amazon gateway must use HTTPS");
    const allowedHosts = (process.env.AMAZON_SIGNING_GATEWAY_HOSTS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
    if (!allowedHosts.includes(endpoint.hostname.toLowerCase())) throw new Error("Amazon gateway host is not in AMAZON_SIGNING_GATEWAY_HOSTS");
    const attrs = (product.attributes as any).amazon;
    const data = await marketplaceFetch(endpoint.toString(), { method: "PUT", headers: { authorization: `Bearer ${credentials.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ sku: product.sku, marketplaceIds: [settings.marketplaceId], productType: attrs.productType, requirements: "LISTING", attributes: attrs.attributes }) });
    return { externalId: product.sku, raw: data };
  }
}
