import { API_BASE_URL } from './env';

const resolveApiPath = (path: string): string =>
  `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

type RequestOptions = RequestInit & {
  token?: string;
  withMeta?: boolean;
};

type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: unknown | null;
};

type ApiErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export type ApiError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
};

export async function apiFetch<TResponse>(
  path: string,
  options?: RequestOptions,
): Promise<TResponse>;
export async function apiFetch<TResponse, TMeta>(
  path: string,
  options: RequestOptions & { withMeta: true },
): Promise<{ data: TResponse; meta: TMeta }>;
export async function apiFetch<TResponse, TMeta = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse | { data: TResponse; meta: TMeta }> {
  const { token, headers, withMeta = false, ...rest } = options;

  const response = await fetch(resolveApiPath(path), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let payload: ApiEnvelope<TResponse> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<TResponse>;
  } catch {
    // ignore JSON parse errors and fall through
  }

  if (!response.ok || !payload) {
    const error = new Error(
      payload && "error" in payload
        ? payload.error.message
        : "Не удалось выполнить запрос",
    ) as ApiError;
    error.status = response.status;
    if (payload && "error" in payload) {
      error.code = payload.error.code;
      error.details = payload.error.details;
    }
    throw error;
  }

  if (!payload.success) {
    const error = new Error(payload.error.message) as ApiError;
    error.status = response.status;
    error.code = payload.error.code;
    error.details = payload.error.details;
    throw error;
  }

  if (withMeta) {
    return {
      data: payload.data,
      meta: payload.meta as TMeta,
    };
  }

  return payload.data;
}
