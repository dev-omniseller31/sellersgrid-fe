import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your MarketFlow seller workspace.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false, noarchive: true },
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
