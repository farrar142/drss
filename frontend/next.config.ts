import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

const withAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://django:8000/api/:path*',
      },
    ];
  },
  images: {
    // Allow images from any external domain (RSS feeds can have various sources)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  // Enable standalone output for production Docker builds
  // This creates a minimal production bundle in .next/standalone
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  // trailingSlash: true,
  // Ensure Turbopack can be used by providing an (empty) turbopack config.
  // This silences the build error when a webpack config is present and
  // allows Next 16's default Turbopack optimizations to run.
  turbopack: {},
  // Disable automatic trailing slash handling to avoid slash/no-slash
  // redirect behavior that can conflict with proxied backend endpoints.
  trailingSlash: false,
};

export default withAnalyzer(nextConfig);
