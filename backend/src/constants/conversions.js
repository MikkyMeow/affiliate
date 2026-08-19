export const CONVERSION_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

export const CONVERSION_STATUS_VALUES = Object.values(CONVERSION_STATUSES);
export const COUNTED_CONVERSION_STATUSES = Object.freeze([
  CONVERSION_STATUSES.PENDING,
  CONVERSION_STATUSES.APPROVED,
]);

export function isValidConversionStatus(status) {
  if (typeof status !== 'string') {
    return false;
  }

  return CONVERSION_STATUS_VALUES.includes(status);
}

export function isCountedConversionStatus(status) {
  if (typeof status !== 'string') {
    return false;
  }

  return COUNTED_CONVERSION_STATUSES.includes(status);
}
