/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Emit dashboard/tickets/index.html etc., so static hosts like Render serve clean URLs.
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
