const MOBILE_REGEX =
  /android.+mobile|iphone|ipod|windows phone|blackberry|bb10|symbian|mobile/i;
const TABLET_REGEX = /ipad|android(?!.*mobile)|tablet|playbook|silk/i;
const BOT_REGEX = /(bot|crawler|spider|httpclient|bingpreview|curl|wget)/i;

export function detectDevice(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') {
    return null;
  }

  if (BOT_REGEX.test(userAgent)) {
    return 'bot';
  }

  if (TABLET_REGEX.test(userAgent)) {
    return 'tablet';
  }

  if (MOBILE_REGEX.test(userAgent)) {
    return 'mobile';
  }

  return 'desktop';
}
