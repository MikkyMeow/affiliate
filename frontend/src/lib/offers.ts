import { apiFetch } from './api';

export const OFFER_GOAL_TYPES = ['cpl', 'cpa', 'cpc'] as const;

export type OfferGoalType = (typeof OFFER_GOAL_TYPES)[number];

export type OfferGoal = {
  id: string;
  offerId: string;
  name: string;
  type: OfferGoalType;
  revenue: number;
  payout: number;
  currency: string | null;
  isDefault: boolean;
  isActive: boolean;
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
  currency: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OfferGoalPayload = {
  name: string;
  type: OfferGoalType;
  revenue: number;
  payout: number;
  isDefault: boolean;
  isActive: boolean;
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
    currency: goal.currency ?? null,
    isDefault: goal.isDefault,
    isActive: goal.isActive,
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
