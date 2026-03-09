export function buildRedirectUrl(targetUrl, clickId, paramName = 'click_id') {
  if (typeof targetUrl !== 'string' || targetUrl.trim().length === 0) {
    throw new Error('targetUrl is required to build redirect URL');
  }

  if (typeof clickId !== 'string' || clickId.length === 0) {
    throw new Error('clickId is required to build redirect URL');
  }

  const url = new URL(targetUrl);
  url.searchParams.append(paramName, clickId);

  return url.toString();
}
