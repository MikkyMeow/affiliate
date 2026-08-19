import { apiFetch } from './api';

export type PaginationMeta = {
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
};

type RawPaginationMeta = {
  total?: number | null;
  limit?: number | null;
  offset?: number | null;
  page?: number | null;
  totalPages?: number | null;
} | null;

export type LookupOption = {
  id: string;
  publicId: string | null;
  name: string;
};

export type TransactionItem = {
  id: string;
  clickId: string;
  offerId: string;
  offer: LookupOption;
  affiliateId: string;
  affiliate: LookupOption;
  advertiserId: string | null;
  advertiser: LookupOption | null;
  source: string;
  countryCode: string | null;
  redirectOutcome: string | null;
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  sub4: string | null;
  sub5: string | null;
  ip: string | null;
  device: string | null;
  canonicalClickId: string | null;
  isDuplicate: boolean;
  createdAt: string;
};

export type TransactionFilters = {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
  offerId?: string;
  affiliateId?: string;
  advertiserId?: string;
  countryCode?: string;
  redirectOutcome?: string;
  clickId?: string;
  sub1?: string;
  sub2?: string;
  sub3?: string;
  sub4?: string;
  sub5?: string;
  ip?: string;
};

export type ConversionItem = {
  id: string;
  clickId: string | null;
  offerId: string;
  offer: LookupOption;
  goalId: string | null;
  goal: {
    id: string;
    name: string | null;
  } | null;
  affiliateId: string;
  affiliate: LookupOption;
  advertiserId: string | null;
  advertiser: LookupOption | null;
  source: string;
  manualAdjustmentBatchId: string | null;
  status: string;
  isTest: boolean;
  externalTransactionId: string | null;
  revenue: number | null;
  payout: number | null;
  profit: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversionFilters = {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
  offerId?: string;
  goalId?: string;
  affiliateId?: string;
  advertiserId?: string;
  status?: string;
  source?: string;
  isTest?: boolean;
  clickId?: string;
  conversionId?: string;
  externalTransactionId?: string;
  revenueMin?: string;
  revenueMax?: string;
  payoutMin?: string;
  payoutMax?: string;
};

export type ConversionStatusHistoryItem = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  changedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  changedAt: string;
};

export type UpdateConversionStatusPayload = {
  status: string;
  reason?: string | null;
};

export type UpdateConversionStatusResponse = {
  conversion: ConversionItem;
  historyEntry: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    changedAt: string;
  } | null;
};

export const CLICK_RESULT_OPTIONS = [
  {
    value: 'allowed_target_redirect',
    label: 'Allowed target redirect',
  },
  {
    value: 'fallback_redirect',
    label: 'Fallback redirect',
  },
  {
    value: 'internal_unavailable_redirect',
    label: 'Internal unavailable redirect',
  },
] as const;

export const CONVERSION_STATUS_OPTIONS = [
  {
    value: 'pending',
    label: 'Pending',
  },
  {
    value: 'approved',
    label: 'Approved',
  },
  {
    value: 'rejected',
    label: 'Rejected',
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
  },
] as const;

export const CONVERSION_SOURCE_OPTIONS = [
  {
    value: 'tracking',
    label: 'Tracking',
  },
  {
    value: 'manual',
    label: 'Manual',
  },
] as const;

function normalizePaginationMeta(
  meta: RawPaginationMeta,
  { limit, page }: { limit: number; page: number },
): PaginationMeta {
  const resolvedLimit =
    typeof meta?.limit === 'number' && Number.isFinite(meta.limit)
      ? meta.limit
      : limit;
  const resolvedOffset =
    typeof meta?.offset === 'number' && Number.isFinite(meta.offset)
      ? meta.offset
      : Math.max(page - 1, 0) * resolvedLimit;
  const resolvedTotal =
    typeof meta?.total === 'number' && Number.isFinite(meta.total)
      ? meta.total
      : 0;
  const resolvedPage =
    typeof meta?.page === 'number' && Number.isFinite(meta.page)
      ? meta.page
      : page;
  const resolvedTotalPages =
    typeof meta?.totalPages === 'number' && Number.isFinite(meta.totalPages)
      ? meta.totalPages
      : Math.max(1, Math.ceil(resolvedTotal / Math.max(resolvedLimit, 1)));

  return {
    total: resolvedTotal,
    limit: resolvedLimit,
    offset: resolvedOffset,
    page: resolvedPage,
    totalPages: resolvedTotalPages,
  };
}

function appendDefinedParam(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined,
) {
  if (value === undefined) {
    return;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return;
  }

  params.set(key, normalized);
}

export function buildTransactionsQuery(filters: TransactionFilters) {
  const params = new URLSearchParams();

  appendDefinedParam(params, 'page', filters.page);
  appendDefinedParam(params, 'limit', filters.limit);
  appendDefinedParam(params, 'search', filters.search);
  appendDefinedParam(params, 'sort', filters.sort);
  appendDefinedParam(params, 'order', filters.order);
  appendDefinedParam(params, 'dateFrom', filters.dateFrom);
  appendDefinedParam(params, 'dateTo', filters.dateTo);
  appendDefinedParam(params, 'offerId', filters.offerId);
  appendDefinedParam(params, 'affiliateId', filters.affiliateId);
  appendDefinedParam(params, 'advertiserId', filters.advertiserId);
  appendDefinedParam(params, 'countryCode', filters.countryCode?.toUpperCase());
  appendDefinedParam(params, 'redirectOutcome', filters.redirectOutcome);
  appendDefinedParam(params, 'clickId', filters.clickId);
  appendDefinedParam(params, 'sub1', filters.sub1);
  appendDefinedParam(params, 'sub2', filters.sub2);
  appendDefinedParam(params, 'sub3', filters.sub3);
  appendDefinedParam(params, 'sub4', filters.sub4);
  appendDefinedParam(params, 'sub5', filters.sub5);
  appendDefinedParam(params, 'ip', filters.ip);

  return params.toString();
}

export function buildConversionsQuery(filters: ConversionFilters) {
  const params = new URLSearchParams();

  appendDefinedParam(params, 'page', filters.page);
  appendDefinedParam(params, 'limit', filters.limit);
  appendDefinedParam(params, 'search', filters.search);
  appendDefinedParam(params, 'sort', filters.sort);
  appendDefinedParam(params, 'order', filters.order);
  appendDefinedParam(params, 'dateFrom', filters.dateFrom);
  appendDefinedParam(params, 'dateTo', filters.dateTo);
  appendDefinedParam(params, 'offerId', filters.offerId);
  appendDefinedParam(params, 'goalId', filters.goalId);
  appendDefinedParam(params, 'affiliateId', filters.affiliateId);
  appendDefinedParam(params, 'advertiserId', filters.advertiserId);
  appendDefinedParam(params, 'status', filters.status);
  appendDefinedParam(params, 'source', filters.source);
  if (typeof filters.isTest === 'boolean') {
    appendDefinedParam(params, 'isTest', filters.isTest ? 'true' : 'false');
  }
  appendDefinedParam(params, 'clickId', filters.clickId);
  appendDefinedParam(params, 'conversionId', filters.conversionId);
  appendDefinedParam(
    params,
    'externalTransactionId',
    filters.externalTransactionId,
  );
  appendDefinedParam(params, 'revenueMin', filters.revenueMin);
  appendDefinedParam(params, 'revenueMax', filters.revenueMax);
  appendDefinedParam(params, 'payoutMin', filters.payoutMin);
  appendDefinedParam(params, 'payoutMax', filters.payoutMax);

  return params.toString();
}

export async function fetchTransactions(
  token: string,
  filters: TransactionFilters,
) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const query = buildTransactionsQuery({ ...filters, page, limit });
  const { data, meta } = await apiFetch<TransactionItem[], RawPaginationMeta>(
    `/clicks?${query}`,
    {
      token,
      withMeta: true,
    },
  );

  return {
    items: data,
    meta: normalizePaginationMeta(meta, { limit, page }),
  };
}

export async function fetchConversions(
  token: string,
  filters: ConversionFilters,
) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const query = buildConversionsQuery({ ...filters, page, limit });
  const { data, meta } = await apiFetch<ConversionItem[], RawPaginationMeta>(
    `/conversions?${query}`,
    {
      token,
      withMeta: true,
    },
  );

  return {
    items: data,
    meta: normalizePaginationMeta(meta, { limit, page }),
  };
}

export async function updateConversionStatus(
  token: string,
  conversionId: string,
  payload: UpdateConversionStatusPayload,
) {
  return apiFetch<UpdateConversionStatusResponse>(
    `/conversions/${conversionId}/status`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchConversionStatusHistory(
  token: string,
  conversionId: string,
) {
  return apiFetch<{ items: ConversionStatusHistoryItem[] }>(
    `/conversions/${conversionId}/status-history`,
    { token },
  );
}
