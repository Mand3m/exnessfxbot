import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.100.160"],
  async headers() {
    return [
      {
        source: "/download/forex-trading-consultants.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          {
            key: "Content-Disposition",
            value: 'attachment; filename="forex-trading-consultants.apk"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
