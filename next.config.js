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
  },
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
    ]
  },
  
  // Webpack configuration for better optimization
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
        'bullmq': 'commonjs bullmq',
        'ioredis': 'commonjs ioredis',
      });
    }
    
    return config;
  },
  
  // SWC minification is enabled by default in Next.js 13+
  
  // Security headers
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
        ],
      },
    ];
  },

  // Environment variables for build time
  env: {
    BUILDING: 'true',
  },
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
