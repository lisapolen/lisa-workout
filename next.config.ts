import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/plans', destination: '/recipes', permanent: true },
      { source: '/plans/new', destination: '/recipes/new', permanent: true },
      { source: '/plans/audit', destination: '/recipes/rate', permanent: true },
      { source: '/plans/:id', destination: '/recipes/:id', permanent: true },
      { source: '/plans/:id/exercise/:exerciseId', destination: '/recipes/:id/cook', permanent: true },
      { source: '/generate-plan', destination: '/generate-recipe', permanent: true },
    ]
  },
};

export default nextConfig;
