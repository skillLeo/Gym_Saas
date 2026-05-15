import type { NextConfig } from "next";

const LARAVEL_URL = process.env.LARAVEL_URL ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${LARAVEL_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
