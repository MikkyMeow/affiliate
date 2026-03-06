export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000';

type RequestOptions = RequestInit & {
  token?: string;
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

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // ignore JSON parse errors and fall through
  }

  if (!response.ok) {
    const message =
      (data as { message?: string } | null)?.message ??
      'Не удалось выполнить запрос';
    throw new Error(message);
  }

  return data as TResponse;
}
