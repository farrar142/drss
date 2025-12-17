import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

const withAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // isServer가 false인 경우에만 (클라이언트 측) 설정을 적용하거나
    // 필요에 따라 조건 없이 적용할 수 있습니다.

    // Webpack watchOptions 설정 (대부분의 경우 이것으로 충분합니다.)if (!isServer && process.env.NODE_ENV === 'development') {
    config.watchOptions = {
      poll: 300, // 300ms 간격으로 파일 변경을 확인합니다.
      aggregateTimeout: 300, // 변경 사항이 감지되면 300ms 후에 빌드를 시작합니다.
    };

    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://${process.env.BACKEND_HOST || "localhost"}:8000/api/:path*`,
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
