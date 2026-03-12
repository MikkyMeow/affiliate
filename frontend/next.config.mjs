import env from '@next/env';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const isDev = process.env.NODE_ENV !== 'production';

const { loadEnvConfig } = env;
loadEnvConfig(repoRoot, isDev);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    /**
     * Allow importing dependencies from the workspace root node_modules.
     */
    externalDir: true,
  },
  transpilePackages: ['@noble/hashes'],
};

export default nextConfig;
