export function normalizeTelegramHandle(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//i, "");
  const withoutDomain = withoutProtocol.replace(/^t\.me\//i, "");
  const withoutAt = withoutDomain.replace(/^@/, "");

  return withoutAt.replace(/^\/+/, "").trim();
}

export function buildTelegramHref(value: string | null | undefined): string | null {
  const handle = normalizeTelegramHandle(value);

  if (!handle) {
    return null;
  }

  return `https://t.me/${handle}`;
}
