import { apiFetch } from "./api";
import type { QuestionnaireAnswerItem } from "./questionnaires";
import type {
  BreakdownMetrics,
  GoalBreakdownEntry,
  StatsSummary,
} from "./stats";

export type AdvertiserProfile = {
  id: string;
  publicId: string | null;
  name: string | null;
  email: string | null;
  status: string | null;
  telegram: string | null;
  questionnaireAnswers: QuestionnaireAnswerItem[];
  createdAt: string | null;
  updatedAt: string | null;
  manager: {
    name: string | null;
    email: string | null;
  } | null;
};

export type AdvertiserPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdvertiserOfferListItem = {
  id: string;
  name: string | null;
  status: string | null;
  revenueRub: number | null;
  trackingType: string | null;
  category: string | null;
  previewUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdvertiserOfferDetails = AdvertiserOfferListItem;

export type AdvertiserOfferListResponse = {
  items: AdvertiserOfferListItem[];
  pagination: AdvertiserPagination;
};

export type AdvertiserOfferListFilters = {
  page?: number;
  pageSize?: number;
  status?: string | null;
  search?: string | null;
};

export type AdvertiserStatsFilters = {
  dateFrom?: string;
  dateTo?: string;
};

export type AdvertiserOfferStatsFilters = AdvertiserStatsFilters;

export type AdvertiserOfferBreakdown = BreakdownMetrics & {
  offerId: string | null;
  title: string | null;
};

export type AdvertiserStatusBreakdown = BreakdownMetrics & {
  status: string | null;
};

export type AdvertiserStatsBreakdowns = {
  offers: AdvertiserOfferBreakdown[];
  statuses: AdvertiserStatusBreakdown[];
};

export type AdvertiserOfferStats = {
  offer: {
    id: string;
    title: string | null;
  };
  summary: StatsSummary;
  goals: GoalBreakdownEntry[];
  statuses: AdvertiserStatusBreakdown[];
};

export type AdvertiserPostback = {
  id: string;
  offerId: string | null;
  conversionId: string | null;
  clickId: string | null;
  status: string | null;
  errorCode: string | null;
  responseStatusCode: number | null;
  sentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdvertiserPostbackListResponse = {
  items: AdvertiserPostback[];
  pagination: AdvertiserPagination;
};

export type AdvertiserPostbackFilters = {
  page?: number;
  pageSize?: number;
  status?: string | null;
  dateFrom?: string;
  dateTo?: string;
  offerId?: string | null;
};

export type AdvertiserFinanceSummary = {
  pendingRevenue: number;
  approvedRevenue: number;
  rejectedRevenue: number;
  cancelledRevenue: number;
  pendingPayout: number;
  approvedPayout: number;
  rejectedPayout: number;
  cancelledPayout: number;
  conversionsPending: number;
  conversionsApproved: number;
  conversionsRejected: number;
  conversionsCancelled: number;
};

export type AdvertiserFinanceOfferBreakdown = {
  offerId: string | null;
  title: string | null;
  approvedRevenue: number;
  approvedPayout: number;
  conversionsApproved: number;
};

export type AdvertiserFinanceStatusBreakdown = {
  status: string | null;
  revenue: number;
  payout: number;
  count: number;
};

export type AdvertiserFinanceBreakdowns = {
  offers: AdvertiserFinanceOfferBreakdown[];
  statuses: AdvertiserFinanceStatusBreakdown[];
};

export type AdvertiserFinanceFilters = {
  offerId?: string | null;
  dateFrom?: string;
  dateTo?: string;
};

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    ) {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export const advertiserApi = {
  getProfile: (token: string) =>
    apiFetch<AdvertiserProfile>("/advertiser/profile", { token }),

  updateProfile: (
    token: string,
    payload: { telegram?: string | null; timezone?: string | null },
  ) =>
    apiFetch<{ profile: { id: string; email: string | null; telegram: string | null } }>(
      "/profile",
      {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      },
    ),

  getOffers: (token: string, filters: AdvertiserOfferListFilters = {}) => {
    const query = buildQuery({
      page: filters.page,
      pageSize: filters.pageSize,
      status: filters.status,
      search: filters.search,
    });
    return apiFetch<AdvertiserOfferListResponse>(`/advertiser/offers${query}`, {
      token,
    });
  },

  getOfferById: (token: string, offerId: string) =>
    apiFetch<{ offer: AdvertiserOfferDetails }>(
      `/advertiser/offers/${offerId}`,
      { token },
    ),

  getStatsSummary: (token: string, filters: AdvertiserStatsFilters = {}) => {
    const query = buildQuery({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
    return apiFetch<StatsSummary>(`/advertiser/stats/summary${query}`, {
      token,
    });
  },

  getStatsBreakdowns: (token: string, filters: AdvertiserStatsFilters = {}) => {
    const query = buildQuery({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
    return apiFetch<AdvertiserStatsBreakdowns>(
      `/advertiser/stats/breakdowns${query}`,
      { token },
    );
  },

  getOfferStats: (
    token: string,
    offerId: string,
    filters: AdvertiserOfferStatsFilters = {},
  ) => {
    const query = buildQuery({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
    return apiFetch<AdvertiserOfferStats>(
      `/advertiser/stats/offers/${offerId}${query}`,
      { token },
    );
  },

  getPostbacks: (token: string, filters: AdvertiserPostbackFilters = {}) => {
    const query = buildQuery({
      page: filters.page,
      pageSize: filters.pageSize,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      offerId: filters.offerId,
    });
    return apiFetch<AdvertiserPostbackListResponse>(
      `/advertiser/postbacks${query}`,
      { token },
    );
  },

  getPostbackById: (token: string, postbackId: string) =>
    apiFetch<{ postback: AdvertiserPostback }>(
      `/advertiser/postbacks/${postbackId}`,
      { token },
    ),

  getFinanceSummary: (token: string, filters: AdvertiserFinanceFilters = {}) => {
    const query = buildQuery({
      offerId: filters.offerId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
    return apiFetch<AdvertiserFinanceSummary>(
      `/advertiser/finance/summary${query}`,
      { token },
    );
  },

  getFinanceBreakdowns: (
    token: string,
    filters: AdvertiserFinanceFilters = {},
  ) => {
    const query = buildQuery({
      offerId: filters.offerId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
    return apiFetch<AdvertiserFinanceBreakdowns>(
      `/advertiser/finance/breakdowns${query}`,
      { token },
    );
  },
};
