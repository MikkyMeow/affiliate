export function getClientIp(req) {
  const forwardedFor = req.get?.('x-forwarded-for');

  if (forwardedFor) {
    const [first] = forwardedFor.split(',');

    if (first && first.trim()) {
      return first.trim();
    }
  }

  return req.ip ?? null;
}
