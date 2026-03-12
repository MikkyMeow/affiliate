import type { ApiError } from './api';
import { TRACKING_BASE_URL as RAW_TRACKING_BASE_URL } from './env';

const TRACKING_BASE = RAW_TRACKING_BASE_URL;

const withLeadingSlash = (path: string): string =>
  path.startsWith('/') ? path : `/${path}`;

type TrackingSuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: unknown | null;
};

type TrackingErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type TrackingEnvelope<T> = TrackingSuccessEnvelope<T> | TrackingErrorEnvelope;

export const TRACKING_BASE_URL = TRACKING_BASE;

export const buildTrackingUrl = (path: string): string =>
  `${TRACKING_BASE_URL}${withLeadingSlash(path)}`;

export async function trackingFetch<TResponse>(
  path: string,
  options: RequestInit = {},
): Promise<TResponse> {
  const { headers, ...rest } = options;

  const response = await fetch(buildTrackingUrl(path), {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
  });

  let payload: TrackingEnvelope<TResponse> | null = null;
  try {
    payload = (await response.json()) as TrackingEnvelope<TResponse>;
  } catch {
    // ignore JSON parse errors and fall through
  }

  if (!response.ok || !payload) {
    const error = new Error('Не удалось выполнить запрос') as ApiError;
    error.status = response.status;
    throw error;
  }

  if (!payload.success) {
    const error = new Error(payload.error.message) as ApiError;
    error.status = response.status;
    error.code = payload.error.code;
    error.details = payload.error.details;
    throw error;
  }

  return payload.data;
}
