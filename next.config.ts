import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/ukelonn",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
