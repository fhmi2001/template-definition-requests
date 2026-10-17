import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // مكتبات تعمل على الخادم فقط ولا تُحزَّم (تشفير كلمات المرور وقراءة ملفات الإكسل)
  serverExternalPackages: ["@node-rs/argon2", "exceljs"],
  experimental: {
    serverActions: {
      // ملف الإكسل حتى 10MB + هامش لترويسات الرفع
      bodySizeLimit: "11mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
