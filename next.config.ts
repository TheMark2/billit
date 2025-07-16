import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignorar errores de ESLint durante el build en producción
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ignorar errores de TypeScript durante el build en producción
  typescript: {
    ignoreBuildErrors: true,
  },
  // Configuración para Vercel
  experimental: {
    serverComponentsExternalPackages: ['handlebars'],
  },
};

export default nextConfig;
