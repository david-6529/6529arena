import type { NextConfig } from "next";

function contentSecurityPolicy() {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    isDevelopment ? "'unsafe-eval'" : "",
  ].filter(Boolean);
  const connectSrc = [
    "'self'",
    "https://api.6529.io",
    "https://*.posthog.com",
    "https://app.posthog.com",
    "https://*.sentry.io",
    isDevelopment ? "http://localhost:*" : "",
    isDevelopment ? "ws://localhost:*" : "",
  ].filter(Boolean);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    isDevelopment ? "" : "upgrade-insecure-requests",
  ].filter(Boolean).join("; ");
}

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
