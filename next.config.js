/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
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
        hostname: 'stockwatch.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'stockwatch-feature1.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'stockwatch-develop.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'stockwatch-release.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'stockwatch-hotfix.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'images-na.ssl-images-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'i5.walmartimages.com',
      },
      {
        protocol: 'https',
        hostname: 'target.scene7.com',
      }
    ]
  }
};

module.exports = nextConfig;
