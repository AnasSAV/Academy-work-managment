import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native module: load from node_modules at runtime instead of bundling.
  serverExternalPackages: ["better-sqlite3"],
  // The desktop build (scripts/build-desktop.mjs) ships the server as a self-contained folder.
  // Only that build asks for it, so `npm start` keeps working as usual.
  ...(process.env.DESKTOP_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
