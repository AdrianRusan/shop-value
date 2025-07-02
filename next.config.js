const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features
  experimental: {
    instrumentationHook: true,
    // Enable optimizations for performance
    optimizePackageImports: [
      '@react-email/components',
      '@upstash/redis'
    ],
  },

  // Optimize compilation for better performance
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Enhanced image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'cdn.flip.ro',
      },
      {
        protocol: 'https',
        hostname: 'shop-value.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'shop-value-feature1.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'shop-value-develop.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'shop-value-release.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'shop-value-hotfix.vercel.app',
      }
    ],
    // Optimize image formats and sizes
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    forceSwcTransforms: true,
  },
  
  // Simplified webpack configuration
  webpack: (config, { isServer, dev, webpack }) => {
    // Optimize for production
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }

    // Prevent build-time execution of Redis/BullMQ code
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.BUILDING': JSON.stringify('true'),
      })
    );

    // Ignore BullMQ and Redis during build for client-side
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'bullmq': false,
        'ioredis': false,
      };
    }

    // External dependencies for server-side to prevent bundling issues
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'sharp': 'commonjs sharp',
        'canvas': 'commonjs canvas',
      });
    }

    // Bundle analyzer for production builds (optional) - only in development
    if (process.env.ANALYZE === 'true' && dev) {
      try {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
          })
        );
      } catch (error) {
        console.warn('Bundle analyzer not available:', error.message);
      }
    }
    
    return config;
  },
  
  // Enhanced security headers with performance considerations
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/assets/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Cache API routes with shorter duration
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=300',
          },
        ],
      },
    ];
  },

  // Environment variables for build time
  env: {
    BUILDING: 'true',
  },

  // Enable compression
  compress: true,

  // Optimize page extensions
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  reactComponentAnnotation: {
    enabled: true,
  },
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },
});
