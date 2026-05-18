import { findUserById } from '../models/userModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { requireAffiliateForUser } from './affiliates.service.js';
import {
  getAffiliateStats,
  listClicks,
  listConversions,
} from './stats/stats.service.js';
import { listOffers, getOfferById } from './offers.service.js';
import { listPartnerOfferGoals } from './offer-goals.service.js';
import { OFFER_STATUSES } from '../constants/offers.js';
import {
  AFFILIATE_OFFER_ACCESS_LEVELS,
} from './offers/affiliate-visibility.js';
import { getQuestionnaireAnswerItemsForUser } from './questionnaires.service.js';
import {
  getPartnerOfferVisibilityState,
  mapPartnerOfferVisibilityStates,
} from './offer-visibility.service.js';

export async function getPartnerProfile(userId) {
  const user = await findUserById(userId);

  if (!user) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Пользователь не найден', {
      userId,
    });
  }

  if (user.role !== 'affiliate') {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      403,
      'Доступ разрешен только аффилиатам',
      {
        userRole: user.role,
      },
    );
  }

  const affiliate = await requireAffiliateForUser(user.id);
  const questionnaireAnswers = await getQuestionnaireAnswerItemsForUser(
    user.id,
    'affiliate',
  );

  return {
    user: {
      ...user,
      affiliateId: affiliate.id,
    },
    affiliate: {
      id: affiliate.id,
      publicId: affiliate.publicId ?? null,
      publicIdNumber: affiliate.publicIdNumber ?? null,
      name: affiliate.name,
      email: affiliate.email,
      status: affiliate.status,
      telegram: affiliate.telegram ?? null,
      createdAt: affiliate.createdAt,
      updatedAt: affiliate.updatedAt,
      questionnaireAnswers,
      manager: affiliate.manager
        ? {
            name: affiliate.manager.displayName ?? null,
            email: affiliate.manager.email ?? null,
          }
        : null,
    },
  };
}

export async function getPartnerStatsSummary(userId) {
  const { affiliate } = await getPartnerProfile(userId);
  return getAffiliateStats(affiliate.id);
}

function buildRestrictedView(offer) {
  return {
    type: 'restricted',
  };
}

function buildFullView(offer) {
  return {
    type: 'full',
    publicIdNumber: offer.publicIdNumber ?? null,
    publicId: offer.publicId ?? null,
    targetUrl: offer.targetUrl,
    fallbackUrl: offer.fallbackUrl ?? null,
    previewUrl: offer.previewUrl ?? null,
  };
}

function serializeAffiliateOffer(
  offer,
  accessResolution,
  { includeDescription = false } = {},
) {
  const base = {
    id: offer.id,
    publicIdNumber: offer.publicIdNumber ?? null,
    publicId: offer.publicId ?? null,
    title: offer.title,
    category: offer.category ?? null,
    status: offer.status,
    availability: offer.availability ?? offer.visibilityMode ?? 'public',
    visibilityMode: offer.visibilityMode ?? 'public',
    accessLevel: accessResolution.accessLevel,
    accessStatus: accessResolution.accessStatus ?? 'not_requested',
    canRequestAccess: Boolean(accessResolution.canRequestAccess),
    denyReason: accessResolution.denyReason ?? null,
    requestStatus: accessResolution.requestStatus ?? null,
  };

  if (includeDescription) {
    base.description =
      typeof offer.description === 'string' && offer.description.trim()
        ? offer.description
        : null;
  }

  if (accessResolution.accessLevel === AFFILIATE_OFFER_ACCESS_LEVELS.FULL) {
    return {
      ...base,
      targetingStrict: Boolean(offer.targetingStrict),
      view: buildFullView(offer),
    };
  }

  return {
    ...base,
    view: buildRestrictedView(offer),
  };
}

export async function listPartnerOffers(userId, { category } = {}) {
  const affiliate = await requireAffiliateForUser(userId);
  const filter = { status: OFFER_STATUSES.ACTIVE };
  if (category) {
    filter.category = category;
  }
  const { items } = await listOffers(filter, { limit: 200, offset: 0 });

  if (items.length === 0) {
    return [];
  }

  const visibilityMap = await mapPartnerOfferVisibilityStates(affiliate.id, items);

  return items
    .map((offer) => {
      const accessResolution = visibilityMap.get(offer.id);
      return { offer, accessResolution };
    })
    .filter(({ accessResolution }) => accessResolution.isVisible)
    .map(({ offer, accessResolution }) =>
      serializeAffiliateOffer(offer, accessResolution, {
        includeDescription: true,
      }),
    );
}

export async function getPartnerOfferDetails(userId, offerId) {
  const affiliate = await requireAffiliateForUser(userId);
  const offer = await getOfferById(offerId, { includeGoals: true });
  const accessResolution = await getPartnerOfferVisibilityState(
    affiliate.id,
    offerId,
    { offer },
  );

  if (!accessResolution.isVisible) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
      offerId,
    });
  }

  const serialized = serializeAffiliateOffer(offer, accessResolution, {
    includeDescription: true,
  });

  if (accessResolution.accessLevel === AFFILIATE_OFFER_ACCESS_LEVELS.FULL) {
    serialized.goals = await listPartnerOfferGoals(offer.id, affiliate.id);
  }

  return serialized;
}

export async function listPartnerClicks(userId, pagination) {
  const affiliate = await requireAffiliateForUser(userId);

  return listClicks({ affiliateId: affiliate.id }, pagination);
}

export async function listPartnerConversions(userId, filter, pagination) {
  const affiliate = await requireAffiliateForUser(userId);

  return listConversions(
    { affiliateId: affiliate.id, isTest: false, ...filter },
    pagination,
  );
}
