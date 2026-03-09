import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Позволяет импортировать зависимости из корневого node_modules
     * (мы используем npm workspaces, поэтому пакеты физически лежат выше).
     */
    externalDir: true,
  },
  transpilePackages: ['@noble/hashes'],
};

export default nextConfig;
