const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TRACKING_BASE = process.env.NEXT_PUBLIC_TRACKING_BASE;

if (!API_BASE) {
  throw new Error("Missing NEXT_PUBLIC_API_BASE");
}

if (!TRACKING_BASE) {
  throw new Error("Missing NEXT_PUBLIC_TRACKING_BASE");
}

export const API_BASE_URL = normalizeBaseUrl(API_BASE);
export const TRACKING_BASE_URL = normalizeBaseUrl(TRACKING_BASE);
