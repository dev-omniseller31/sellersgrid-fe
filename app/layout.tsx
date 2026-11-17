import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";
import "./live.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: "MarketFlow — Multichannel commerce, simplified", template: "%s · MarketFlow" },
  description: "Connect seller accounts, publish products across marketplaces, and manage inventory and orders from one secure workspace.",
  applicationName: "MarketFlow",
  keywords: ["multichannel ecommerce", "marketplace listing software", "inventory sync", "seller management"],
  alternates: { canonical: "/" },
  openGraph: { title: "MarketFlow — Create once. Sell everywhere.", description: "A secure multichannel commerce workspace for ambitious sellers.", url: "/", siteName: "MarketFlow", type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image", title: "MarketFlow — Create once. Sell everywhere.", description: "A secure multichannel commerce workspace for ambitious sellers." },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
