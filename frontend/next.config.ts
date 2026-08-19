import type { NextConfig } from "next";

// Production API for this repository. It lives in the isolated Railway project
// `golden-city-app-prod`, never in the unrelated `golden-city` project.
const productionBackendUrl = 'https://api-production-dc6e.up.railway.app';
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
