import { getAffiliateById } from './affiliates.service.js';
import { getOfferById } from './offers.service.js';
import pool from '../db.js';
import {
  deleteOfferAffiliateHidden,
  findHiddenAffiliateForOffer,
  listOfferAffiliateHidden,
  upsertOfferAffiliateHidden,
} from '../models/offerAffiliateHidden.model.js';
import { writeAuditEvent } from './audit.service.js';

function buildHiddenResponse(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    offerId: record.offerId,
    affiliateId: record.affiliateId,
    createdBy: record.createdBy ?? null,
    createdAt: record.createdAt,
    reason: record.reason ?? null,
    affiliate: record.affiliate ?? null,
  };
}

export async function hideOfferFromAffiliate({
  offerId,
  affiliateId,
  actorId,
  actorRole = null,
  requestId = null,
  reason = null,
}) {
  if (!offerId || !affiliateId || !actorId) {
    throw new Error('offerId, affiliateId, and actorId are required to hide offer');
  }

  await getOfferById(offerId);
  await getAffiliateById(affiliateId);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const previous = await findHiddenAffiliateForOffer(offerId, affiliateId, {
      client,
      forUpdate: true,
    });
    const hidden = await upsertOfferAffiliateHidden(
      {
        offerId,
        affiliateId,
        createdBy: actorId,
        reason,
      },
      { client },
    );

    await writeAuditEvent({
      entityType: 'offer',
      entityId: offerId,
      action: 'offer.partner_hidden',
      actorUserId: actorId,
      actorRole,
      requestId,
      client,
      oldValue: previous
        ? {
            hiddenAt: previous.createdAt ?? null,
            reason: previous.reason ?? null,
          }
        : null,
      newValue: {
        hiddenAt: hidden.createdAt ?? null,
        reason: hidden.reason ?? null,
      },
      metadata: {
        offerId,
        affiliateId,
      },
    });

    await client.query('COMMIT');

    return buildHiddenResponse(hidden);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function unhideOfferFromAffiliate({
  offerId,
  affiliateId,
  actorId = null,
  actorRole = null,
  requestId = null,
}) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to unhide offer');
  }

  await getOfferById(offerId);
  await getAffiliateById(affiliateId);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const deleted = await deleteOfferAffiliateHidden(offerId, affiliateId, {
      client,
    });

    if (deleted) {
      await writeAuditEvent({
        entityType: 'offer',
        entityId: offerId,
        action: 'offer.partner_unhidden',
        actorUserId: actorId,
        actorRole,
        requestId,
        client,
        oldValue: {
          hiddenAt: deleted.createdAt ?? null,
          reason: deleted.reason ?? null,
        },
        newValue: null,
        metadata: {
          offerId,
          affiliateId,
        },
      });
    }

    await client.query('COMMIT');

    return deleted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listHiddenAffiliatesForOffer(offerId) {
  if (!offerId) {
    throw new Error('offerId is required to list hidden affiliates');
  }

  await getOfferById(offerId);
  const items = await listOfferAffiliateHidden(offerId);
  return items.map(buildHiddenResponse);
}
