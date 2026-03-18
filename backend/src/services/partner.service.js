import { findUserById } from '../models/userModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { requireAffiliateForUser } from './affiliates.service.js';
import {
  getSummary,
  listClicks,
  listConversions,
} from './stats/stats.service.js';
import { listOffers, getOfferById } from './offers.service.js';
import { OFFER_STATUSES } from '../constants/offers.js';
import {
  findAffiliateAccessForOffers,
  findAffiliateAccessForOffer,
} from '../models/offerAffiliateAccess.model.js';
import {
  AFFILIATE_OFFER_ACCESS_LEVELS,
  resolveAffiliateOfferAccess,
} from './offers/affiliate-visibility.js';

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

  return {
    user: {
      ...user,
      affiliateId: affiliate.id,
    },
    affiliate,
  };
}

export async function getPartnerStatsSummary(userId) {
  const { affiliate } = await getPartnerProfile(userId);
  return getSummary({ affiliateId: affiliate.id });
}

function buildAccessMap(records = []) {
  const map = new Map();

  records.forEach((record) => {
    map.set(record.offerId, record);
  });

  return map;
}

function buildRestrictedView(offer) {
  return {
    type: 'restricted',
    previewUrl: offer.previewUrl ?? null,
  };
}

function buildFullView(offer) {
  return {
    type: 'full',
    advertiserId: offer.advertiserId,
    targetUrl: offer.targetUrl,
    fallbackUrl: offer.fallbackUrl ?? null,
    previewUrl: offer.previewUrl ?? null,
    payoutRub: offer.payoutRub,
  };
}

function serializeAffiliateOffer(offer, accessResolution) {
  const base = {
    id: offer.id,
    title: offer.title,
    advertiserId: offer.advertiserId,
    status: offer.status,
    visibilityMode: offer.visibilityMode ?? 'public',
    targetingStrict: Boolean(offer.targetingStrict),
    accessLevel: accessResolution.accessLevel,
    canRequestAccess: Boolean(accessResolution.canRequestAccess),
    denyReason: accessResolution.denyReason ?? null,
    requestStatus: null,
  };

  if (accessResolution.accessLevel === AFFILIATE_OFFER_ACCESS_LEVELS.FULL) {
    return {
      ...base,
      view: buildFullView(offer),
    };
  }

  return {
    ...base,
    view: buildRestrictedView(offer),
  };
}

export async function listPartnerOffers(userId) {
  const affiliate = await requireAffiliateForUser(userId);
  const { items } = await listOffers(
    { status: OFFER_STATUSES.ACTIVE },
    { limit: 200, offset: 0 },
  );

  if (items.length === 0) {
    return [];
  }

  const accessRecords = await findAffiliateAccessForOffers(
    affiliate.id,
    items.map((offer) => offer.id),
  );
  const accessMap = buildAccessMap(accessRecords);

  return items
    .map((offer) => {
      const accessRecord = accessMap.get(offer.id) ?? null;
      const accessResolution = resolveAffiliateOfferAccess(offer, accessRecord);
      return { offer, accessResolution };
    })
    .filter(({ accessResolution }) => accessResolution.isVisible)
    .map(({ offer, accessResolution }) =>
      serializeAffiliateOffer(offer, accessResolution),
    );
}

export async function getPartnerOfferDetails(userId, offerId) {
  const affiliate = await requireAffiliateForUser(userId);
  const offer = await getOfferById(offerId);
  const accessRecord = await findAffiliateAccessForOffer(offerId, affiliate.id);
  const accessResolution = resolveAffiliateOfferAccess(offer, accessRecord);

  if (!accessResolution.isVisible) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
      offerId,
    });
  }

  return serializeAffiliateOffer(offer, accessResolution);
}

export async function listPartnerClicks(userId, pagination) {
  const affiliate = await requireAffiliateForUser(userId);

  return listClicks({ affiliateId: affiliate.id }, pagination);
}

export async function listPartnerConversions(userId, filter, pagination) {
  const affiliate = await requireAffiliateForUser(userId);

  return listConversions({ affiliateId: affiliate.id, ...filter }, pagination);
}
