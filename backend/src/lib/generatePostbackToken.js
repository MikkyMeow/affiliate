import crypto from 'crypto';

export function generatePostbackToken() {
  // 24 bytes -> 48 hex chars; enough entropy, easy to store/display
  return crypto.randomBytes(24).toString('hex');
}
