export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000';

type RequestOptions = RequestInit & {
  token?: string;
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
  options: RequestOptions = {},
): Promise<TResponse> {
  const { token, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
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
      payload && 'error' in payload
        ? payload.error.message
        : 'Не удалось выполнить запрос',
    ) as ApiError;
    error.status = response.status;
    if (payload && 'error' in payload) {
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

  return payload.data;
}
