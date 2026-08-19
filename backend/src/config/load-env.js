import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const envFileName =
  process.env.ENV_FILE ??
  (process.env.NODE_ENV === 'test' ? '.env.test' : '.env');

const explicitEnvPath = path.resolve(repoRoot, envFileName);
const defaultEnvPath = path.resolve(repoRoot, '.env');

if (fs.existsSync(explicitEnvPath)) {
  dotenv.config({ path: explicitEnvPath });
} else if (envFileName !== '.env' && fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath });
} else {
  dotenv.config();
}
