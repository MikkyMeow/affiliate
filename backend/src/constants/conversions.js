export const CONVERSION_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const CONVERSION_STATUS_VALUES = Object.values(CONVERSION_STATUSES);

export function isValidConversionStatus(status) {
  if (typeof status !== 'string') {
    return false;
  }

  return CONVERSION_STATUS_VALUES.includes(status);
}
