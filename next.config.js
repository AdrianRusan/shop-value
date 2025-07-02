const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features
  experimental: {
    instrumentationHook: true,
    forceSwcTransforms: true,
  },
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // External packages for server-side to prevent bundling issues
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'sharp': 'commonjs sharp',
        'canvas': 'commonjs canvas',
      });
    }

    return config;
  },

  // Environment variables
  env: {
    SENTRY_SUPPRESS_GLOBAL_ERROR_HANDLER_FILE_WARNING: '1',
    BUILDING: 'true',
  },

  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Headers for security
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
        ],
      },
    ];
  },
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
