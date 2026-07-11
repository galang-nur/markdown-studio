import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker is the deployment target (§4): emit a self-contained server bundle.
  output: "standalone",

  // Puppeteer resolves a Chromium binary at runtime and must not be bundled.
  serverExternalPackages: ["puppeteer", "puppeteer-core"],

  // lib/pdf.ts reads styles/pdf.css from disk at request time. File tracing only
  // follows imports, so the stylesheet has to be declared explicitly or it would
  // be missing from the standalone output.
  outputFileTracingIncludes: {
    "/api/export-pdf": ["./styles/pdf.css"],
  },
};

export default nextConfig;
