import { apiFetch } from './api';

export type AdvertiserOfferListItem = {
  id: string;
  name: string | null;
  status: string | null;
  payoutRub: number | null;
  revenueRub: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdvertiserOfferDetails = AdvertiserOfferListItem & {
  trackingType: string | null;
  category: string | null;
  previewUrl: string | null;
};

export type AdvertiserOfferListResponse = {
  items: AdvertiserOfferListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type AdvertiserOfferListParams = {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
};

export async function fetchAdvertiserOffers(
  token: string,
  params: AdvertiserOfferListParams = {},
) {
  const query = new URLSearchParams();

  if (params.page) {
    query.set('page', String(params.page));
  }

  if (params.pageSize) {
    query.set('pageSize', String(params.pageSize));
  }

  if (params.status) {
    query.set('status', params.status);
  }

  if (params.search) {
    query.set('search', params.search);
  }

  const queryString = query.toString();

  return apiFetch<AdvertiserOfferListResponse>(
    `/advertiser/offers${queryString ? `?${queryString}` : ''}`,
    { token },
  );
}

export async function fetchAdvertiserOfferDetails(token: string, offerId: string) {
  const { offer } = await apiFetch<{ offer: AdvertiserOfferDetails }>(
    `/advertiser/offers/${offerId}`,
    { token },
  );

  return offer;
}
