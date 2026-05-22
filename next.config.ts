import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const localOrigins = Array.from(
  new Set(
    Object.values(networkInterfaces())
      .flat()
      .filter((item): item is NonNullable<(typeof item)> => Boolean(item))
      .filter((item) => item.family === "IPv4" && !item.internal)
      .map((item) => item.address),
  ),
);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", ...localOrigins],
  devIndicators: false,
  output: "standalone",
};

export default nextConfig;
