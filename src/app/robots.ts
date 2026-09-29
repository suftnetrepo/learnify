import { MetadataRoute } from "next";

const APP = process.env.NEXT_PUBLIC_APP_URL || "https://edquis.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/courses", "/courses/*"],
        disallow: [
          "/admin/",
          "/dashboard/",
          "/instructor/",
          "/api/",
          "/checkout/",
        ],
      },
    ],
    sitemap: `${APP}/sitemap.xml`,
    host:    APP,
  };
}
