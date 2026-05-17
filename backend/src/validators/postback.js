import { CONVERSION_STATUS_VALUES } from '../constants/conversions.js';
import { ERROR_CODES } from '../utils/response.js';

const MAX_CLICK_ID_LENGTH = 255;
const MAX_TOKEN_LENGTH = 255;
const MAX_EXTERNAL_TRANSACTION_ID_LENGTH = 255;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildError(field, message, code = null) {
  return { field, message, code };
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

export function validatePostbackParams(source = {}) {
  const errors = [];
  const dto = { status: 'pending' };

  const rawToken = source.token;

  if (rawToken === undefined || rawToken === null) {
    errors.push(buildError('token', 'token обязателен'));
  } else if (typeof rawToken !== 'string') {
    errors.push(buildError('token', 'token должен быть строкой'));
  } else {
    const token = rawToken.trim();

    if (!token) {
      errors.push(buildError('token', 'token обязателен'));
    } else if (token.length > MAX_TOKEN_LENGTH) {
      errors.push(
        buildError('token', `token не должен превышать ${MAX_TOKEN_LENGTH} символов`),
      );
    } else {
      dto.token = token;
    }
  }

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

  const rawGoalId = source.goalId ?? source.goal_id ?? undefined;

  if (rawGoalId === undefined || rawGoalId === null) {
    errors.push(
      buildError('goalId', 'goalId обязателен', ERROR_CODES.GOAL_REQUIRED),
    );
  } else if (typeof rawGoalId !== 'string') {
    errors.push(buildError('goalId', 'goalId должен быть строкой'));
  } else {
    const goalId = rawGoalId.trim();

    if (!goalId) {
      errors.push(
        buildError('goalId', 'goalId обязателен', ERROR_CODES.GOAL_REQUIRED),
      );
    } else if (!UUID_REGEX.test(goalId)) {
      errors.push(buildError('goalId', 'goalId должен быть UUID'));
    } else {
      dto.goalId = goalId.toLowerCase();
    }
  }

  if (Object.hasOwn(source, 'status')) {
    const status = normalizeString(source.status);

    if (!status) {
      errors.push(buildError('status', 'status не может быть пустым'));
    } else {
      const normalized = status.toLowerCase();

      if (!CONVERSION_STATUS_VALUES.includes(normalized)) {
        errors.push(
          buildError(
            'status',
            `status должен быть одним из: ${CONVERSION_STATUS_VALUES.join(', ')}`,
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

  const rawExternalTransactionId =
    source.externalTransactionId ??
    source.externalTransactionID ??
    source.externalId ??
    source.external_id ??
    source.transactionId ??
    source.transaction_id ??
    undefined;

  if (
    rawExternalTransactionId !== undefined &&
    rawExternalTransactionId !== null &&
    rawExternalTransactionId !== ''
  ) {
    if (typeof rawExternalTransactionId !== 'string') {
      errors.push(
        buildError(
          'externalTransactionId',
          'externalTransactionId должен быть строкой',
        ),
      );
    } else {
      const externalTransactionId = rawExternalTransactionId.trim();

      if (!externalTransactionId) {
        errors.push(
          buildError(
            'externalTransactionId',
            'externalTransactionId не может быть пустым',
          ),
        );
      } else if (
        externalTransactionId.length > MAX_EXTERNAL_TRANSACTION_ID_LENGTH
      ) {
        errors.push(
          buildError(
            'externalTransactionId',
            `externalTransactionId не должен превышать ${MAX_EXTERNAL_TRANSACTION_ID_LENGTH} символов`,
          ),
        );
      } else {
        dto.externalTransactionId = externalTransactionId;
      }
    }
  }

  const rawSignature = source.signature ?? source.sig;

  if (rawSignature === undefined || rawSignature === null) {
    errors.push(buildError('signature', 'Подпись обязательна'));
  } else if (typeof rawSignature !== 'string') {
    errors.push(buildError('signature', 'Подпись должна быть строкой'));
  } else {
    const normalizedSignature = rawSignature.trim();

    if (!normalizedSignature) {
      errors.push(buildError('signature', 'Подпись обязательна'));
    } else {
      dto.signature = normalizedSignature;
    }
  }

  return { dto, errors };
}
