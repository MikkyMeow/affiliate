import { CONVERSION_STATUSES } from '../services/postback/conversions.service.js';

const MAX_CLICK_ID_LENGTH = 255;

function buildError(field, message) {
  return { field, message };
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parsePayout(value) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, error: null };
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    return { value: undefined, error: 'Некорректная сумма выплаты' };
  }

  if (num < 0) {
    return { value: undefined, error: 'Выплата не может быть отрицательной' };
  }

  return { value: num, error: null };
}

export function validatePostbackParams(source) {
  const errors = [];
  const dto = { status: 'approved' };

  const rawClickId = source.clickId ?? source.click_id;

  if (rawClickId === undefined || rawClickId === null) {
    errors.push(buildError('clickId', 'clickId обязателен'));
  } else if (typeof rawClickId !== 'string') {
    errors.push(buildError('clickId', 'clickId должен быть строкой'));
  } else {
    const clickId = rawClickId.trim();

    if (!clickId) {
      errors.push(buildError('clickId', 'clickId обязателен'));
    } else if (clickId.length > MAX_CLICK_ID_LENGTH) {
      errors.push(
        buildError('clickId', `clickId не должен превышать ${MAX_CLICK_ID_LENGTH} символов`),
      );
    } else {
      dto.clickId = clickId;
    }
  }

  if (Object.hasOwn(source, 'status')) {
    const status = normalizeString(source.status);

    if (!status) {
      errors.push(buildError('status', 'status не может быть пустым'));
    } else {
      const normalized = status.toLowerCase();

      if (!CONVERSION_STATUSES.includes(normalized)) {
        errors.push(
          buildError(
            'status',
            `status должен быть одним из: ${CONVERSION_STATUSES.join(', ')}`,
          ),
        );
      } else {
        dto.status = normalized;
      }
    }
  }

  const rawPayoutSource =
    source.payoutRub ?? source.payout_rub ?? source.payout ?? undefined;

  const { value: payoutRub, error: payoutError } = parsePayout(rawPayoutSource);

  if (payoutError) {
    errors.push(buildError('payoutRub', payoutError));
  } else if (typeof payoutRub === 'number') {
    dto.payoutRub = payoutRub;
  }

  return { dto, errors };
}
