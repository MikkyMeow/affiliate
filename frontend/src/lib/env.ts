const getRequiredEnvVar = (name: string): string => {
  const rawValue = process.env[name];

  if (!rawValue || rawValue.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return rawValue.trim();
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

export const API_BASE_URL = normalizeBaseUrl(
  getRequiredEnvVar('NEXT_PUBLIC_API_BASE'),
);

export const TRACKING_BASE_URL = normalizeBaseUrl(
  getRequiredEnvVar('NEXT_PUBLIC_TRACKING_BASE'),
);
