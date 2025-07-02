let withSentryConfig;
try {
  ({ withSentryConfig } = require('@sentry/nextjs'));
} catch (error) {
  console.warn('Sentry not found, building without Sentry integration');
  withSentryConfig = (config) => config;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
    instrumentationHook: true,
    // Enable optimizations for performance
    optimizePackageImports: [
      '@react-email/components',
      '@upstash/redis',
      'react-chartjs-2',
      'chart.js'
    ],
    // Removed parallelServerCompiles and parallelServerBuildTraces - not compatible with Vercel
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
  },
  
  // Webpack configuration for better optimization
  webpack: (config, { isServer, dev, webpack }) => {
    // Production optimizations
    if (!dev) {
      // Enable aggressive splitting for better caching
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Framework chunk for React/Next.js
            framework: {
              chunks: 'all',
              name: 'framework',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            // Libraries chunk for other vendor code
            lib: {
              test(module) {
                return module.size() > 160000 && /node_modules[/\\]/.test(module.identifier());
              },
              name(module) {
                const hash = require('crypto').createHash('sha1');
                hash.update(module.libIdent ? module.libIdent({context: config.context}) : module.identifier());
                return hash.digest('hex').substring(0, 8);
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            // Commons chunk for shared code
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
              reuseExistingChunk: true,
            },
            // Shared chunk for components
            shared: {
              test: /[\\/]components[\\/]/,
              name: 'shared',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

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
        'bullmq': 'commonjs bullmq',
        'ioredis': 'commonjs ioredis',
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
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://api.stripe.com https://api.clerk.com https://api.sentry.io https://api.resend.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests"
            ].join('; ')
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
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
          // Performance headers
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
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

  // Production URL for optimized builds
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : undefined,
};

// Sentry configuration
const sentryConfig = {
  // Additional config options for the Sentry webpack plugin
  silent: true, // Suppresses source map uploading logs during build
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // Upload source maps in production only
  widenClientFileUpload: true,
  transpileClientSDK: true,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
};

// Export the configuration with Sentry wrapper
module.exports = process.env.NODE_ENV === 'production' 
  ? withSentryConfig(nextConfig, sentryConfig)
  : nextConfig;
