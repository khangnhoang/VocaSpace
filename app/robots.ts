import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/teacher",
        "/learn",
        "/profile",
        "/api/",
        "/auth/",
        "/login",
        "/register",
        "/forgot-password",
        "/payment/",
        "/courses/*/preview/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
