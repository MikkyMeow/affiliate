import {
  createOffer as createOfferModel,
  listOffers as listOffersModel,
  findOfferById as findOfferByIdModel,
  updateOffer as updateOfferModel,
} from '../models/offers.model.js';
import { findAdvertiserById } from '../models/advertiserModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { generatePostbackToken } from '../lib/generatePostbackToken.js';
import { invalidateOfferCache } from './tracking/cache-invalidation.service.js';
import { listOfferGoals as listOfferGoalsService } from './offer-goals.service.js';
import { writeAuditEvent } from './audit.service.js';
import { OFFER_CATEGORY_VALUES } from '../constants/offers.js';

function throwValidationError(errors) {
  throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'Ошибка валидации', {
    errors,
  });
}

function assertValidTargetUrl(targetUrl) {
  if (typeof targetUrl !== 'string' || targetUrl.trim().length === 0) {
    throwValidationError([
      {
        field: 'targetUrl',
        message: 'URL обязателен и не может быть пустым',
      },
    ]);
  }

  let parsed;
  try {
    parsed = new URL(targetUrl.trim());
  } catch {
    throwValidationError([
      {
        field: 'targetUrl',
        message: 'Некорректный URL',
      },
    ]);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throwValidationError([
      {
        field: 'targetUrl',
        message: 'URL должен начинаться с http или https',
      },
    ]);
  }
}

const allowedCategories = new Set(OFFER_CATEGORY_VALUES);

function assertValidCategory(category) {
  if (typeof category !== 'string' || !category.trim()) {
    throwValidationError([
      {
        field: 'category',
        message: 'Категория обязательна',
      },
    ]);
  }

  if (!allowedCategories.has(category.trim().toLowerCase())) {
    throwValidationError([
      {
        field: 'category',
        message: 'Недопустимая категория',
      },
    ]);
  }
}

async function ensureAdvertiserExists(advertiserId) {
  if (!advertiserId) {
    return;
  }

  const advertiser = await findAdvertiserById(advertiserId);

  if (!advertiser) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Рекламодатель не найден', {
      advertiserId,
    });
  }
}

function buildOfferSnapshot(offer) {
  if (!offer) {
    return null;
  }

  return {
    title: offer.title ?? null,
    category: offer.category ?? null,
    advertiserId: offer.advertiserId ?? null,
    status: offer.status ?? null,
    availability: offer.availability ?? offer.visibilityMode ?? null,
    visibilityMode: offer.visibilityMode ?? null,
    targetingStrict: offer.targetingStrict ?? null,
    fallbackUrl: offer.fallbackUrl ?? null,
    targetUrl: offer.targetUrl ?? null,
    description: offer.description ?? null,
    allowDuplicateClicks:
      typeof offer.allowDuplicateClicks === 'boolean'
        ? offer.allowDuplicateClicks
        : offer.allowDuplicateClicks == null
          ? null
          : Boolean(offer.allowDuplicateClicks),
    duplicateClickWindowSeconds: (() => {
      const raw = offer.duplicateClickWindowSeconds;
      if (raw === null || raw === undefined) {
        return null;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
  };
}

function getOfferActorMeta(actor) {
  if (!actor) {
    return { actorUserId: null, actorRole: null };
  }

  return {
    actorUserId: actor.userId ?? null,
    actorRole: actor.role ?? null,
  };
}

function diffOfferSnapshots(previous, next) {
  const trackedFields = [
    'title',
    'category',
    'status',
    'availability',
    'advertiserId',
    'targetUrl',
    'visibilityMode',
    'targetingStrict',
    'fallbackUrl',
    'description',
    'allowDuplicateClicks',
    'duplicateClickWindowSeconds',
  ];

  const changes = {};

  for (const field of trackedFields) {
    const before = previous?.[field] ?? null;
    const after = next?.[field] ?? null;

    if (before !== after) {
      changes[field] = { old: before, new: after };
    }
  }

  return changes;
}

export async function createOffer(dto, { actor = null, requestId = null } = {}) {
  await ensureAdvertiserExists(dto.advertiserId);
  assertValidTargetUrl(dto.targetUrl);
  assertValidCategory(dto.category);

  const offer = await createOfferModel({
    ...dto,
    visibilityMode: dto.visibilityMode ?? dto.availability ?? 'public',
    postbackToken: generatePostbackToken(),
  });

  const { actorUserId, actorRole } = getOfferActorMeta(actor);
  await writeAuditEvent({
    entityType: 'offer',
    entityId: offer.id,
    action: 'created',
    actorUserId,
    actorRole,
    requestId,
    context: buildOfferSnapshot(offer),
  });

  return offer;
}

export async function listOffers(filter, pagination, options = {}) {
  return listOffersModel(filter, pagination, options);
}

export async function getOfferById(
  id,
  { includeGoals = false, includePostbackToken = false } = {},
) {
  const offer = await findOfferByIdModel(id, { includePostbackToken });

  if (!offer) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
      offerId: id,
    });
  }

  if (!includeGoals) {
    return offer;
  }

  const goals = await listOfferGoalsService(id, { skipOfferValidation: true });
  return { ...offer, goals };
}

export async function getAdminOfferById(id, { includeGoals = false } = {}) {
  const offer = await getOfferById(id, {
    includeGoals,
    includePostbackToken: true,
  });
  const advertiser = offer.advertiserId
    ? await findAdvertiserById(offer.advertiserId)
    : null;

  return {
    ...offer,
    advertiser: advertiser
      ? {
          id: advertiser.id,
          publicId: advertiser.publicId ?? null,
          publicIdNumber: advertiser.publicIdNumber ?? null,
          name: advertiser.name,
        }
      : null,
  };
}

export async function updateOffer(id, dto, { actor = null, requestId = null } = {}) {
  if (dto.advertiserId) {
    await ensureAdvertiserExists(dto.advertiserId);
  }

  if (Object.hasOwn(dto, 'targetUrl')) {
    assertValidTargetUrl(dto.targetUrl);
  }

  if (Object.hasOwn(dto, 'category')) {
    if (dto.category === null) {
      throwValidationError([
        {
          field: 'category',
          message: 'Категория не может быть пустой',
        },
      ]);
    }
    assertValidCategory(dto.category);
  }

  const existing = await findOfferByIdModel(id);

  if (!existing) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
      offerId: id,
    });
  }

  const offer = await updateOfferModel(id, {
    ...dto,
    visibilityMode: dto.visibilityMode ?? dto.availability,
  });

  if (!offer) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
      offerId: id,
    });
  }

  await invalidateOfferCache(id);

  const { actorUserId, actorRole } = getOfferActorMeta(actor);
  const changes = diffOfferSnapshots(buildOfferSnapshot(existing), buildOfferSnapshot(offer));

  if (Object.keys(changes).length > 0) {
    await writeAuditEvent({
      entityType: 'offer',
      entityId: offer.id,
      action: 'updated',
      actorUserId,
      actorRole,
      requestId,
      context: {
        changes,
      },
    });
  }

  const previousAvailability =
    existing.availability ?? existing.visibilityMode ?? null;
  const nextAvailability = offer.availability ?? offer.visibilityMode ?? null;

  if (previousAvailability !== nextAvailability) {
    await writeAuditEvent({
      entityType: 'offer',
      entityId: offer.id,
      action: 'availability_changed',
      actorUserId,
      actorRole,
      requestId,
      context: {
        oldValue: previousAvailability,
        newValue: nextAvailability,
        metadata: {
          offerId: offer.id,
          availability: nextAvailability,
        },
      },
    });
  }

  return offer;
}
