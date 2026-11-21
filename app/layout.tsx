import type { Metadata } from "next";
import "./globals.css";
import "./live.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: "SellersGrid — List once. Sell everywhere.", template: "%s · SellersGrid" },
  description: "Connect Amazon, Flipkart and Myntra seller accounts, publish products across marketplaces, and manage inventory and orders from one workspace.",
  applicationName: "SellersGrid",
  keywords: ["multichannel ecommerce", "Amazon seller", "Flipkart seller", "Myntra", "inventory sync", "seller management"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "SellersGrid — List once. Sell everywhere.",
    description: "A multichannel commerce workspace for Indian sellers. Amazon, Flipkart, Myntra — one catalog.",
    url: "/",
    siteName: "SellersGrid",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "SellersGrid — List once. Sell everywhere.",
    description: "A multichannel commerce workspace for Indian sellers.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
