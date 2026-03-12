import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const isDev = process.env.NODE_ENV !== 'production';

loadEnvConfig(repoRoot, isDev);

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
