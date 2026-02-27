import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // TODO: Supabase Storage - hostname을 본인 프로젝트 ref로 변경
    // 예: "abcdefghijklmnop.supabase.co"
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placeholder.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
