import { findAffiliateAccessForOffer, findAffiliateAccessForOffers } from '../models/offerAffiliateAccess.model.js';
import {
  findHiddenAffiliateForOffer,
  findHiddenAffiliateForOffers,
} from '../models/offerAffiliateHidden.model.js';
import {
  findPendingOfferRequest,
  findPendingOfferRequestsForOffers,
} from '../models/offerRequests.model.js';
import { getOfferById } from './offers.service.js';
import { resolveAffiliateOfferAccess } from './offers/affiliate-visibility.js';

function buildMap(records = [], keyField = 'offerId') {
  const map = new Map();

  records.forEach((record) => {
    if (record?.[keyField]) {
      map.set(record[keyField], record);
    }
  });

  return map;
}

export async function getPartnerOfferVisibilityState(
  affiliateId,
  offerId,
  { offer = null, client = null } = {},
) {
  if (!affiliateId || !offerId) {
    throw new Error('affiliateId and offerId are required to resolve visibility');
  }

  const resolvedOffer =
    offer ?? (await getOfferById(offerId, { includeGoals: false }));

  const [accessRecord, hiddenRecord, pendingRequest] = await Promise.all([
    findAffiliateAccessForOffer(offerId, affiliateId, { client }),
    findHiddenAffiliateForOffer(offerId, affiliateId, { client }),
    findPendingOfferRequest(offerId, affiliateId, { client }),
  ]);

  return resolveAffiliateOfferAccess(resolvedOffer, {
    accessRecord,
    hiddenRecord,
    pendingRequest,
  });
}

export async function mapPartnerOfferVisibilityStates(
  affiliateId,
  offers = [],
  { client = null } = {},
) {
  if (!affiliateId) {
    throw new Error('affiliateId is required to resolve visibility states');
  }

  if (!Array.isArray(offers) || offers.length === 0) {
    return new Map();
  }

  const offerIds = offers.map((offer) => offer.id);
  const [accessRecords, hiddenRecords, pendingRequests] = await Promise.all([
    findAffiliateAccessForOffers(affiliateId, offerIds, { client }),
    findHiddenAffiliateForOffers(affiliateId, offerIds, { client }),
    findPendingOfferRequestsForOffers(affiliateId, offerIds, { client }),
  ]);

  const accessMap = buildMap(accessRecords);
  const hiddenMap = buildMap(hiddenRecords);
  const pendingMap = buildMap(pendingRequests);
  const result = new Map();

  offers.forEach((offer) => {
    result.set(
      offer.id,
      resolveAffiliateOfferAccess(offer, {
        accessRecord: accessMap.get(offer.id) ?? null,
        hiddenRecord: hiddenMap.get(offer.id) ?? null,
        pendingRequest: pendingMap.get(offer.id) ?? null,
      }),
    );
  });

  return result;
}
