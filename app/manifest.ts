import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "MarketFlow", short_name: "MarketFlow", description: "Multichannel commerce, simplified.", start_url: "/dashboard", display: "standalone", background_color: "#F8FAFC", theme_color: "#5B2A86", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }] };
}
