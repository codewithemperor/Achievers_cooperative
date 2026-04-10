/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@achievers/ui", "@achievers/types", "@achievers/utils"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
