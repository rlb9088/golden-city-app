import type { NextConfig } from "next";

// Canonical production API for this repository. It lives in the GitHub-linked
// Railway service `skillful-empathy / golden-city-app`.
const productionBackendUrl = 'https://golden-city-app-production.up.railway.app';
const backendInternalUrl = process.env.NODE_ENV === 'production'
  ? productionBackendUrl
  : process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
