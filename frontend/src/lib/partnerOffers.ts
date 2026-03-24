import { apiFetch } from "./api";
import type { OfferGoal, OfferGoalType } from "./offers";
import type { OfferCategoryValue } from "./offerCategories";

export type PartnerOfferViewRestricted = {
  type: "restricted";
  previewUrl: string | null;
};

export type PartnerOfferViewFull = {
  type: "full";
  advertiserId: string;
  targetUrl: string;
  fallbackUrl: string | null;
  previewUrl: string | null;
  payoutRub: number;
};

export type PartnerOffer = {
  id: string;
  title: string;
  category: OfferCategoryValue | null;
  advertiserId: string;
  status: "active" | "inactive";
  visibilityMode: string;
  targetingStrict: boolean;
  accessLevel: "none" | "restricted" | "full" | string;
  canRequestAccess: boolean;
  denyReason: string | null;
  requestStatus: string | null;
  view: PartnerOfferViewRestricted | PartnerOfferViewFull;
};

type PartnerOfferGoalResponse = {
  id: string;
  offerId: string;
  name: string;
  type: string | null;
  revenue: number;
  payout: number;
  currency: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PartnerOfferResponse = PartnerOffer & {
  goals?: PartnerOfferGoalResponse[] | null;
};

export type PartnerOfferDetail = PartnerOffer & {
  goals?: OfferGoal[];
};

function normalizeGoalType(value?: string | null): OfferGoalType {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "cpa" || normalized === "cpc" || normalized === "cpl") {
    return normalized;
  }
  return "cpl";
}

function mapGoal(goal: PartnerOfferGoalResponse): OfferGoal {
  return {
    id: goal.id,
    offerId: goal.offerId,
    name: goal.name,
    type: normalizeGoalType(goal.type),
    revenue: goal.revenue,
    payout: goal.payout,
    currency: goal.currency ?? null,
    isDefault: Boolean(goal.isDefault),
    isActive: Boolean(goal.isActive),
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

function mapOfferResponse(offer: PartnerOfferResponse): PartnerOfferDetail {
  const goals = Array.isArray(offer.goals)
    ? offer.goals.map(mapGoal)
    : undefined;
  return { ...offer, goals };
}

export async function fetchPartnerOffer(
  token: string,
  offerId: string,
): Promise<PartnerOfferDetail> {
  const response = await apiFetch<{ offer: PartnerOfferResponse }>(
    `/partner/offers/${offerId}`,
    { token },
  );
  return mapOfferResponse(response.offer);
}
