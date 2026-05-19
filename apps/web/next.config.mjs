/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@dm-instamap/core",
    "@dm-instamap/assets",
    "@dm-instamap/generator",
    "@dm-instamap/exporters",
    "@dm-instamap/ai-bridge"
  ]
};

export default nextConfig;
