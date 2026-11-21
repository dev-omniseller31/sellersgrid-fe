"use client";

import dynamic from "next/dynamic";

// ssr: false is only valid in Client Components.
// This shell is the client boundary that lets DashboardClient
// (which uses hooks including useMemo inside conditional paths)
// load exclusively in the browser, skipping SSR prerender entirely.
const DashboardClient = dynamic(() => import("./DashboardClient"), { ssr: false });

export default function DashboardShell() {
  return <DashboardClient />;
}
