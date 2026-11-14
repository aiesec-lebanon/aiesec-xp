import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Read by path at request time, which the tracer can't see.
  outputFileTracingIncludes: {
    "/api/models/\\[name\\]": ["./assets/sealed/**/*"],
  },
};

export default nextConfig;
