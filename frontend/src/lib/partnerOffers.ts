import { apiFetch } from "./api";
import type { OfferGoalType } from "./offers";
import type { OfferCategoryValue } from "./offerCategories";

export type PartnerOfferViewRestricted = {
  type: "restricted";
};

export type PartnerOfferViewFull = {
  type: "full";
  targetUrl: string;
  fallbackUrl: string | null;
  previewUrl: string | null;
};

export type PartnerOffer = {
  id: string;
  publicId: string | null;
  publicIdNumber: number | null;
  title: string;
  category: OfferCategoryValue | null;
  status: "active" | "inactive" | string;
  availability: "public" | "on_request" | "private" | string;
  visibilityMode: string;
  accessLevel: "none" | "restricted" | "full" | string;
  accessStatus: string;
  canRequestAccess: boolean;
  denyReason: string | null;
  requestStatus: string | null;
  targetingStrict?: boolean;
  view: PartnerOfferViewRestricted | PartnerOfferViewFull;
  description?: string | null;
};

type PartnerOfferGoalResponse = {
  id: string;
  offerId: string;
  name: string;
  type: string | null;
  payout: number;
  currency: string | null;
  isDefault: boolean;
  limitReached: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PartnerOfferGoal = {
  id: string;
  offerId: string;
  name: string;
  type: OfferGoalType;
  payout: number;
  currency: string | null;
  isDefault: boolean;
  limitReached: boolean;
  createdAt: string;
  updatedAt: string;
};

type PartnerOfferResponse = PartnerOffer & {
  goals?: PartnerOfferGoalResponse[] | null;
};

export type PartnerOfferDetail = PartnerOffer & {
  description: string | null;
  goals?: PartnerOfferGoal[];
};

function normalizeGoalType(value?: string | null): OfferGoalType {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "cpa" || normalized === "cpc" || normalized === "cpl") {
    return normalized;
  }
  return "cpl";
}

function mapGoal(goal: PartnerOfferGoalResponse): PartnerOfferGoal {
  return {
    id: goal.id,
    offerId: goal.offerId,
    name: goal.name,
    type: normalizeGoalType(goal.type),
    payout: goal.payout,
    currency: goal.currency ?? null,
    isDefault: Boolean(goal.isDefault),
    limitReached: Boolean(goal.limitReached),
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

function mapOfferResponse(offer: PartnerOfferResponse): PartnerOfferDetail {
  const goals = Array.isArray(offer.goals)
    ? offer.goals.map(mapGoal)
    : undefined;
  return { ...offer, description: offer.description ?? null, goals };
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

export async function requestPartnerOfferAccess(
  token: string,
  offerId: string,
  message?: string,
) {
  return apiFetch<{ request: { id: string; status: string } }>(
    `/partner/offers/${offerId}/request`,
    {
      method: "POST",
      token,
      body: JSON.stringify({
        message: message?.trim() ? message.trim() : undefined,
      }),
    },
  );
}
