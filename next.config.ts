import type { NextConfig } from "next";

// Baseline security headers for every route (hub + the static game files under public/).
// Notable for this site because the hub embeds each game in a same-origin <iframe> and the
// games pull ESM from CDNs (Three.js, Cesium) — so we lock framing to same-origin and add the
// cheap, non-breaking hardening headers. A full Content-Security-Policy is deliberately left out
// for now: the games use inline <script> + cross-origin CDN imports, so a strict CSP needs
// per-game testing (track separately); the headers below are safe to ship as-is.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
