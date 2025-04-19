/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@hashgraph/hedera-wallet-connect',
    '@hashgraph/sdk'
  ]
};

module.exports = nextConfig; 