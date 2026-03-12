import { API_BASE_URL } from "./api";

const clean = (url: string) =>
  url
    .replace(/\/+$/, "")
    .replace(/\/track$/, "")
    .replace(/\/api(?:\/v\d+)?$/, "");

export const TRACKING_BASE_URL = clean(
  process.env.NEXT_PUBLIC_TRACKING_BASE ||
    process.env.NEXT_PUBLIC_API_BASE ||
    API_BASE_URL,
);
