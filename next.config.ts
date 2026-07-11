import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // Chấp nhận mọi tên miền dùng HTTPS
      },
      {
        protocol: "http",
        hostname: "**", // Chấp nhận luôn mọi tên miền dùng HTTP (phòng hờ)
      },
    ],
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
  },
  reactCompiler: true,
};

export default nextConfig;
