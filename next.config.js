/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['mongoose'],
  },
  images: {
    domains: [
      's13emagst.akamaized.net',
      'cdn.flip.ro',
      'localhost',
      'shop-value.vercel.app',
      'shopvalue-seven.vercel.app',
    ],
  },
};

module.exports = nextConfig;
