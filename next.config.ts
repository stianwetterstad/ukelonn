import type { NextConfig } from "next";
import { APP_BASE_PATH } from "./src/lib/appBasePath";

const nextConfig: NextConfig = {
  output: "export",
  basePath: APP_BASE_PATH,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
