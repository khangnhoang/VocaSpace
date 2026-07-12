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
    // Chỉ bật rõ ràng khi QA ảnh từ Supabase local; mặc định giữ chặn private-IP.
    dangerouslyAllowLocalIP: process.env.ALLOW_LOCAL_IMAGE_IP === "true",
  },
  reactCompiler: true,
};

export default nextConfig;
