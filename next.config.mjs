/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['deck.gl', '@deck.gl/core', '@deck.gl/layers', '@deck.gl/react'],
};

export default nextConfig;
