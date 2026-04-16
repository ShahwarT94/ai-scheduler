import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",          // static export for S3 + CloudFront
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
