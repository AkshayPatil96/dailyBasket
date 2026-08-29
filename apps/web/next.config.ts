import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Product images (AWS S3, per grocery-delivery-product-catalog-architecture.md)
      { protocol: 'https', hostname: '*.s3.*.amazonaws.com' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
      // Served through CloudFront in front of the same bucket (see uploads module)
      { protocol: 'https', hostname: '*.cloudfront.net' },
      // Unsplash — used for placeholder/dev imagery until real product photos exist
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
