/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['mongoose'],
  },
  images: {
    domains: ['s13emagst.akamaized.net', 'cdn.flip.ro'],
  },
};

module.exports = nextConfig;
