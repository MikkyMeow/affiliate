import { apiFetch } from './api';

export type PartnerListMeta = {
  total: number;
  limit: number;
  offset: number;
};

type RawListMeta = {
  total?: number | null;
  limit?: number | null;
  offset?: number | null;
} | null;

export type PartnerClick = {
  clickId: string;
  offerId: string | null;
  sub1: string | null;
  createdAt: string;
};

export async function fetchPartnerClicks(
  token: string,
  { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {},
) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  const { data, meta } = await apiFetch<PartnerClick[], RawListMeta>(
    `/partner/clicks?${params.toString()}`,
    {
      token,
      withMeta: true,
    },
  );

  const normalizedMeta: PartnerListMeta = {
    total:
      typeof meta?.total === 'number' && Number.isFinite(meta.total)
        ? meta.total
        : data.length,
    limit:
      typeof meta?.limit === 'number' && Number.isFinite(meta.limit)
        ? meta.limit
        : limit,
    offset:
      typeof meta?.offset === 'number' && Number.isFinite(meta.offset)
        ? meta.offset
        : offset,
  };

  return {
    items: data,
    meta: normalizedMeta,
  };
}

export type PartnerConversion = {
  clickId: string;
  status: string;
  payoutRub: number;
  createdAt: string;
};

export async function fetchPartnerConversions(
  token: string,
  {
    limit = 20,
    offset = 0,
    status,
  }: { limit?: number; offset?: number; status?: string } = {},
) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (status) {
    params.set('status', status);
  }

  const { data, meta } = await apiFetch<PartnerConversion[], RawListMeta>(
    `/partner/conversions?${params.toString()}`,
    {
      token,
      withMeta: true,
    },
  );

  const normalizedMeta: PartnerListMeta = {
    total:
      typeof meta?.total === 'number' && Number.isFinite(meta.total)
        ? meta.total
        : data.length,
    limit:
      typeof meta?.limit === 'number' && Number.isFinite(meta.limit)
        ? meta.limit
        : limit,
    offset:
      typeof meta?.offset === 'number' && Number.isFinite(meta.offset)
        ? meta.offset
        : offset,
  };

  return {
    items: data,
    meta: normalizedMeta,
  };
}
