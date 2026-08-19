import { apiFetch } from './api';

export const OFFER_GOAL_TYPES = ['cpl', 'cpa', 'cpc'] as const;
export const OFFER_GOAL_LIMIT_TYPES = ['conversions_count'] as const;
export const OFFER_AVAILABILITY_VALUES = [
  'public',
  'on_request',
  'private',
] as const;

export type OfferGoalType = (typeof OFFER_GOAL_TYPES)[number];
export type OfferGoalLimitType = (typeof OFFER_GOAL_LIMIT_TYPES)[number];
export type OfferAvailability = (typeof OFFER_AVAILABILITY_VALUES)[number];

export type OfferGoal = {
  id: string;
  offerId: string;
  name: string;
  type: OfferGoalType;
  revenue: number;
  payout: number;
  profit: number;
  currency: string | null;
  isDefault: boolean;
  limitEnabled: boolean;
  limitType: OfferGoalLimitType | null;
  limitValue: number | null;
  limitUsed: number;
  limitRemaining: number | null;
  limitReached: boolean;
  createdAt: string;
  updatedAt: string;
};

type OfferGoalResponse = {
  id: string;
  offerId: string;
  name: string;
  type: string;
  revenue: number;
  payout: number;
  profit: number;
  currency: string | null;
  isDefault: boolean;
  limitEnabled: boolean;
  limitType: string | null;
  limitValue: number | null;
  limitUsed: number;
  limitRemaining: number | null;
  limitReached: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OfferGoalPayload = {
  name: string;
  type: OfferGoalType;
  revenue: number;
  payout: number;
  limitEnabled: boolean;
  limitType: OfferGoalLimitType | null;
  limitValue: number | null;
  isDefault: boolean;
};

const apiTypeByGoalType: Record<OfferGoalType, string> = {
  cpl: 'CPL',
  cpa: 'CPA',
  cpc: 'CPC',
};

function normalizeGoalType(type: string): OfferGoalType {
  const normalized = type.trim().toLowerCase();
  if (normalized === 'cpa' || normalized === 'cpl' || normalized === 'cpc') {
    return normalized;
  }
  return 'cpl';
}

function mapGoalResponse(goal: OfferGoalResponse): OfferGoal {
  return {
    id: goal.id,
    offerId: goal.offerId,
    name: goal.name,
    type: normalizeGoalType(goal.type ?? 'cpl'),
    revenue: goal.revenue,
    payout: goal.payout,
    profit: goal.profit,
    currency: goal.currency ?? null,
    isDefault: goal.isDefault,
    limitEnabled: Boolean(goal.limitEnabled),
    limitType:
      goal.limitType === 'conversions_count' ? 'conversions_count' : null,
    limitValue:
      typeof goal.limitValue === 'number' ? goal.limitValue : null,
    limitUsed:
      typeof goal.limitUsed === 'number' ? goal.limitUsed : 0,
    limitRemaining:
      typeof goal.limitRemaining === 'number' ? goal.limitRemaining : null,
    limitReached: Boolean(goal.limitReached),
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

export async function fetchOfferGoals(token: string, offerId: string) {
  const { data } = await apiFetch<OfferGoalResponse[], { total?: number }>(
    `/admin/offers/${offerId}/goals`,
    {
      token,
      withMeta: true,
    },
  );

  return data.map(mapGoalResponse);
}

export async function createOfferGoal(
  token: string,
  offerId: string,
  payload: OfferGoalPayload,
) {
  const response = await apiFetch<{ goal: OfferGoalResponse }>(
    `/admin/offers/${offerId}/goals`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        ...payload,
        type: apiTypeByGoalType[payload.type],
      }),
    },
  );

  return mapGoalResponse(response.goal);
}

type UpdatePayload = Partial<OfferGoalPayload>;

export async function updateOfferGoal(
  token: string,
  offerId: string,
  goalId: string,
  payload: UpdatePayload,
) {
  const response = await apiFetch<{ goal: OfferGoalResponse }>(
    `/admin/offers/${offerId}/goals/${goalId}`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        ...payload,
        type: payload.type ? apiTypeByGoalType[payload.type] : undefined,
      }),
    },
  );

  return mapGoalResponse(response.goal);
}

export type OfferGoalAffiliateRate = {
  id: string;
  offerGoalId: string;
  affiliateId: string;
  revenue: number;
  payout: number;
  profit: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  affiliate: OfferAffiliateSummary | null;
};

type OfferGoalAffiliateRateResponse = {
  id: string;
  offerGoalId: string;
  affiliateId: string;
  revenue: number;
  payout: number;
  profit: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  affiliate?: OfferAffiliateSummary | null;
};

function mapOfferGoalAffiliateRateResponse(
  rate: OfferGoalAffiliateRateResponse,
): OfferGoalAffiliateRate {
  return {
    id: rate.id,
    offerGoalId: rate.offerGoalId,
    affiliateId: rate.affiliateId,
    revenue: rate.revenue,
    payout: rate.payout,
    profit: rate.profit,
    currency: rate.currency,
    createdAt: rate.createdAt,
    updatedAt: rate.updatedAt,
    affiliate: rate.affiliate ?? null,
  };
}

export async function fetchOfferGoalAffiliateRates(
  token: string,
  offerId: string,
  goalId: string,
) {
  const response = await apiFetch<{ items: OfferGoalAffiliateRateResponse[] }>(
    `/admin/offers/${offerId}/goals/${goalId}/affiliate-rates`,
    { token },
  );

  return response.items.map(mapOfferGoalAffiliateRateResponse);
}

export async function upsertOfferGoalAffiliateRate(
  token: string,
  offerId: string,
  goalId: string,
  affiliateId: string,
  payload: {
    revenue: number;
    payout: number;
  },
) {
  const response = await apiFetch<{ rate: OfferGoalAffiliateRateResponse }>(
    `/admin/offers/${offerId}/goals/${goalId}/affiliate-rates/${affiliateId}`,
    {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    },
  );

  return mapOfferGoalAffiliateRateResponse(response.rate);
}

export async function deleteOfferGoalAffiliateRate(
  token: string,
  offerId: string,
  goalId: string,
  affiliateId: string,
) {
  return apiFetch<{ ok: boolean }>(
    `/admin/offers/${offerId}/goals/${goalId}/affiliate-rates/${affiliateId}`,
    {
      method: 'DELETE',
      token,
    },
  );
}

export type OfferGeoRuleType = 'allow' | 'deny';

export type OfferGeoRule = {
  id: string;
  offerId: string;
  ruleType: OfferGeoRuleType;
  countryCode: string;
  createdAt: string;
  updatedAt: string;
};

type OfferGeoRuleResponse = {
  id: string;
  offerId: string;
  ruleType: string;
  countryCode: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeRuleType(value: string): OfferGeoRuleType {
  return value === 'deny' ? 'deny' : 'allow';
}

function mapGeoRuleResponse(rule: OfferGeoRuleResponse): OfferGeoRule {
  return {
    id: rule.id,
    offerId: rule.offerId,
    ruleType: normalizeRuleType(rule.ruleType),
    countryCode: rule.countryCode.toUpperCase(),
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

export async function fetchOfferGeoRules(token: string, offerId: string) {
  const { data } = await apiFetch<OfferGeoRuleResponse[], { total?: number }>(
    `/admin/offers/${offerId}/geo-rules`,
    {
      token,
      withMeta: true,
    },
  );

  return data.map(mapGeoRuleResponse);
}

type OfferGeoRulePayload = {
  ruleType: OfferGeoRuleType;
  countryCode: string;
};

export async function createOfferGeoRule(
  token: string,
  offerId: string,
  payload: OfferGeoRulePayload,
) {
  const response = await apiFetch<{ rule: OfferGeoRuleResponse }>(
    `/admin/offers/${offerId}/geo-rules`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    },
  );

  return mapGeoRuleResponse(response.rule);
}

export async function deleteOfferGeoRule(
  token: string,
  offerId: string,
  ruleId: string,
) {
  const response = await apiFetch<{ rule: OfferGeoRuleResponse }>(
    `/admin/offers/${offerId}/geo-rules/${ruleId}`,
    {
      method: 'DELETE',
      token,
    },
  );

  return mapGeoRuleResponse(response.rule);
}

type TargetingResponse = {
  offer: {
    id: string;
    targetingStrict: boolean;
    fallbackUrl: string | null;
  };
};

export async function updateOfferTargetingStrict(
  token: string,
  offerId: string,
  targetingStrict: boolean,
) {
  const response = await apiFetch<TargetingResponse>(
    `/admin/offers/${offerId}/targeting`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({ targetingStrict }),
    },
  );

  return response.offer;
}

export type OfferAffiliateSummary = {
  id: string;
  publicId: string | null;
  name: string | null;
  email: string | null;
};

export type OfferAccessRecord = {
  id: string;
  offerId: string;
  affiliateId: string;
  status: string;
  accessType: string;
  source: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  affiliate: OfferAffiliateSummary | null;
};

export type HiddenAffiliateRecord = {
  id: string;
  offerId: string;
  affiliateId: string;
  createdBy: string | null;
  createdAt: string;
  reason: string | null;
  affiliate: OfferAffiliateSummary | null;
};

export type OfferRequestRecord = {
  id: string;
  offerId: string;
  affiliateId: string;
  status: string;
  message: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  affiliate: OfferAffiliateSummary | null;
};

export async function updateOfferAvailability(
  token: string,
  offerId: string,
  availability: OfferAvailability,
) {
  const response = await apiFetch<{
    offer: {
      id: string;
      availability: OfferAvailability;
      visibilityMode: OfferAvailability;
    };
  }>(`/offers/${offerId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ availability }),
  });

  return response.offer;
}

export async function fetchOfferAccessList(token: string, offerId: string) {
  const response = await apiFetch<{ items: OfferAccessRecord[] }>(
    `/admin/offers/${offerId}/access`,
    { token },
  );

  return response.items;
}

export async function grantOfferAccess(
  token: string,
  offerId: string,
  affiliateId: string,
) {
  const response = await apiFetch<{
    access: OfferAccessRecord;
    visibilityWarning?: string | null;
  }>(`/admin/offers/${offerId}/access`, {
    method: 'POST',
    token,
    body: JSON.stringify({ affiliateId }),
  });

  return response;
}

export async function revokeOfferAccess(
  token: string,
  offerId: string,
  affiliateId: string,
) {
  const response = await apiFetch<{ ok: boolean }>(
    `/admin/offers/${offerId}/access/${affiliateId}`,
    {
      method: 'DELETE',
      token,
    },
  );

  return response.ok;
}

export async function fetchHiddenAffiliates(token: string, offerId: string) {
  const response = await apiFetch<{ items: HiddenAffiliateRecord[] }>(
    `/admin/offers/${offerId}/hidden-affiliates`,
    { token },
  );

  return response.items;
}

export async function hideOfferFromAffiliate(
  token: string,
  offerId: string,
  affiliateId: string,
  reason?: string,
) {
  const response = await apiFetch<{ hiddenAffiliate: HiddenAffiliateRecord }>(
    `/admin/offers/${offerId}/hidden-affiliates`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        affiliateId,
        reason: reason?.trim() ? reason.trim() : undefined,
      }),
    },
  );

  return response.hiddenAffiliate;
}

export async function unhideOfferFromAffiliate(
  token: string,
  offerId: string,
  affiliateId: string,
) {
  const response = await apiFetch<{ ok: boolean }>(
    `/admin/offers/${offerId}/hidden-affiliates/${affiliateId}`,
    {
      method: 'DELETE',
      token,
    },
  );

  return response.ok;
}

export async function fetchOfferPendingRequests(token: string, offerId: string) {
  const response = await apiFetch<{ items: OfferRequestRecord[] }>(
    `/admin/offers/${offerId}/requests`,
    { token },
  );

  return response.items;
}

export async function reviewOfferRequestDecision(
  token: string,
  offerId: string,
  requestId: string,
  decision: 'approved' | 'rejected',
) {
  return apiFetch<{
    request: OfferRequestRecord;
    access: OfferAccessRecord;
  }>(`/admin/offers/${offerId}/requests/${requestId}/decision`, {
    method: 'POST',
    token,
    body: JSON.stringify({ decision }),
  });
}
