/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['mongoose'],
  },
  images: {
    domains: [
      // Not Valid
      // 's13emagst.akamaized.net',
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
