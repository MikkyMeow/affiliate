import crypto from 'node:crypto';

export function buildPostbackSignature({
  token,
  clickId,
  status = 'pending',
  payoutRub,
}) {
  if (!token) {
    throw new Error('token is required to build signature');
  }

  if (!clickId) {
    throw new Error('clickId is required to build signature');
  }

  const payout = typeof payoutRub === 'number' ? payoutRub.toString(10) : '';
  const payload = `${clickId}|${status}|${payout}`;

  return crypto.createHmac('sha256', token).update(payload).digest('hex');
}
