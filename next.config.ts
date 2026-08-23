import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  // Point to the Service Worker source file that we will create in the next step
  swSrc: "src/app/sw.ts",
  // Define where Serwist should output the generated Service Worker file
  swDest: "public/sw.js",
  // Disable PWA in development mode to prevent caching issues while coding
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSerwist(nextConfig);