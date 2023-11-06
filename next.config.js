/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
  },
  images: {
    domains: [
      'cdn.flip.ro',
      'localhost',
      'shop-value.vercel.app',
      'shop-value-develop.vercel.app',
      'shop-value-feature.vercel.app',
      'shop-value-release.vercel.app',
      'shop-value-hotfix.vercel.app',
      'shopvalue-seven.vercel.app',
    ],
  },
};

module.exports = nextConfig;
