import type { Metadata } from "next";
import DashboardShell from "./DashboardShell";

export const metadata: Metadata = {
  title: "Commerce workspace",
  robots: { index: false, follow: false, noarchive: true },
};

export default function DashboardPage() {
  return <DashboardShell />;
}
