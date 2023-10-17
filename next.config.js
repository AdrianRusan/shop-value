/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['mongoose'],
  },
  images: {
    // domains: ['s13emagst.akamaized.net'],
    domains: ['cdn.flip.ro'],
  },
};

https: module.exports = nextConfig;
