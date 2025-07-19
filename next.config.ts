import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Ignore Handlebars require.extensions warning
    config.ignoreWarnings = [
      {
        module: /handlebars/,
        message: /require\.extensions/,
      },
    ];

    // Configure externals for server-side
    if (isServer) {
      config.externals.push({
        'puppeteer': 'commonjs puppeteer',
        'puppeteer-core': 'commonjs puppeteer-core',
      });
    }

    return config;
  },
};

export default nextConfig;
