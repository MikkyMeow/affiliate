import { readDateRange, readUuid } from './advertiserFilters.js';

export function validateAdvertiserFinanceFilters(query = {}) {
  const errors = [];
  const { dateFrom, dateTo } = readDateRange(query, errors);
  const offerId = readUuid(query.offerId, 'offerId', errors);

  return {
    filter: {
      dateFrom,
      dateTo,
      offerId,
    },
    errors,
  };
}
