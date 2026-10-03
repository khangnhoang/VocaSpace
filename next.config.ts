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
  // Link xác minh auth local dùng site_url http://127.0.0.1:3000; thiếu dòng này next dev chặn HMR và trang không hydrate.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
