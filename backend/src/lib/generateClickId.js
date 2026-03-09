import { randomUUID } from 'crypto';

export function generateClickId() {
  return randomUUID();
}
