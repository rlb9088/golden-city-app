import type { NextConfig } from "next";

const productionBackendUrl = 'https://backend-production-bd77.up.railway.app';
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
