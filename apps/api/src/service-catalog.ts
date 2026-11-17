export const serviceCatalog = [
  { id: "ACCOUNT", group: "Seller operations", name: "Account onboarding", description: "Request help setting up a seller account and preparing required documents." },
  { id: "CATALOG", group: "Creative studio", name: "Catalog creation", description: "Share SKUs, product facts and the target marketplace for a listing brief." },
  { id: "IMAGE", group: "Creative studio", name: "Image editing", description: "Request retouching, background cleanup or marketplace-ready product images." },
  { id: "BANNER", group: "Creative studio", name: "Banners & rich product design", description: "Describe banner dimensions, placement and brand direction. Confirm RPD scope with your team." },
  { id: "BRAND_STORE", group: "Seller operations", name: "Brand store creation", description: "Plan a storefront with your team, subject to marketplace eligibility." },
  { id: "VISIBILITY", group: "Growth", name: "Organic visibility", description: "Request listing copy, keywords and discoverability improvements." },
  { id: "CAMPAIGN", group: "Growth", name: "Advertising campaigns", description: "Brief your team on goals and budget. Ad spend requires separate approval." },
  { id: "HEALTH", group: "Seller operations", name: "Account health review", description: "Have your team review supplied marketplace performance and policy notices." },
  { id: "RETURN", group: "Seller operations", name: "Wrong return claims", description: "Prepare order references, evidence and claim details for your team to review." },
  { id: "FULFILLMENT", group: "Seller operations", name: "FBA / FBF preparation", description: "Coordinate product preparation, labels, packing and shipment requirements." },
  { id: "REPORT", group: "Reports", name: "Marketplace reports", description: "Request a report with a date range, marketplace and desired metrics." },
  { id: "VIDEO", group: "Creative studio", name: "AI video production", description: "Submit a storyboard brief for team-produced video. Generation is not automatic." },
  { id: "INFOGRAPHIC", group: "Creative studio", name: "Infographic callouts", description: "Request product benefit graphics using verified facts and brand assets." },
  { id: "ACCOUNT_MANAGER", group: "Support", name: "Account manager", description: "Request an account contact. An existing workspace member can be assigned by an admin." },
  { id: "CATALOG_MANAGER", group: "Support", name: "Catalog manager", description: "Request a catalog specialist to coordinate your listing work." },
  { id: "PROMOTION", group: "Growth", name: "Organic promotions", description: "Plan promotional content and a calendar with your team." },
  { id: "WEBINAR", group: "Support", name: "Webinar support", description: "Request a session topic and preferred time. Your team confirms availability." },
  { id: "CALL", group: "Support", name: "Callback requests", description: "Provide a preferred time and timezone. Hours and availability require confirmation." },
  { id: "CHAT", group: "Support", name: "Chat support", description: "Start a tracked support conversation here; this does not connect Google Chat." },
  { id: "WHATSAPP", group: "Support", name: "WhatsApp support request", description: "Ask your team to arrange WhatsApp contact. No message is sent automatically." },
  { id: "PACKAGE", group: "Plans", name: "Package consultation", description: "Request a service package quote; no subscription or charge is created." },
] as const;
export const serviceMarkets = ["GENERAL", "FLIPKART", "SHOPSY", "MEESHO", "AMAZON", "SHOPIFY", "EBAY"] as const;
export const serviceStatuses = ["SUBMITTED", "IN_PROGRESS", "NEEDS_INPUT", "DELIVERED", "CLOSED", "CANCELLED"] as const;
export const servicePackages = [
  { name: "Silver", markets: "Flipkart & Shopsy", catalog: 50, images: 25, banners: 5, videos: 0, infographics: 5 },
  { name: "Gold", markets: "Flipkart, Shopsy & Meesho", catalog: 75, images: 33, banners: 7, videos: 5, infographics: 10 },
  { name: "Platinum", markets: "Flipkart, Shopsy, Meesho & Amazon", catalog: 100, images: 50, banners: 10, videos: 10, infographics: 15 },
];
