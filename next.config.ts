import type { NextConfig } from "next";
import { cabecerasSeguridad } from "./server/http/cabeceras";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Sin X-Powered-By (seguridad-mvp).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: cabecerasSeguridad({
          produccion: process.env.NODE_ENV === "production",
          s3Endpoint: process.env.S3_ENDPOINT,
        }),
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
