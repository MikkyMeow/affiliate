const MAX_MESSAGE_LENGTH = 1000;
const MAX_NOTE_LENGTH = 1000;
const ALLOWED_DECISIONS = new Set(['approved', 'rejected']);

function buildError(field, message) {
  return { field, message };
}

function validateRequestMessage(value) {
  if (value === undefined || value === null) {
    return { value: null, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError('message', 'message должен быть строкой')],
    };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { value: null, errors: [] };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      value: undefined,
      errors: [
        buildError(
          'message',
          `message не должен превышать ${MAX_MESSAGE_LENGTH} символов`,
        ),
      ],
    };
  }

  return { value: trimmed, errors: [] };
}

export function validateOfferRequestPayload(payload) {
  const source = payload ?? {};
  const errors = [];
  const dto = {};

  const { value: message, errors: messageErrors } = validateRequestMessage(
    source.message,
  );
  errors.push(...messageErrors);
  if (message !== undefined) {
    dto.message = message;
  }

  return { dto, errors };
}

function validateDecision(value) {
  if (value === undefined || value === null) {
    return {
      value: undefined,
      errors: [buildError('decision', 'decision обязателен')],
    };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError('decision', 'decision должен быть строкой')],
    };
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return {
      value: undefined,
      errors: [buildError('decision', 'decision не может быть пустым')],
    };
  }

  if (!ALLOWED_DECISIONS.has(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError('decision', 'decision должен быть approved или rejected'),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

function validateNote(value) {
  if (value === undefined || value === null) {
    return { value: null, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError('note', 'note должен быть строкой')],
    };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { value: null, errors: [] };
  }

  if (trimmed.length > MAX_NOTE_LENGTH) {
    return {
      value: undefined,
      errors: [
        buildError(
          'note',
          `note не должен превышать ${MAX_NOTE_LENGTH} символов`,
        ),
      ],
    };
  }

  return { value: trimmed, errors: [] };
}

export function validateOfferRequestDecisionPayload(payload) {
  const source = payload ?? {};
  const errors = [];
  const dto = {};

  const { value: decision, errors: decisionErrors } = validateDecision(
    source.decision,
  );
  errors.push(...decisionErrors);
  if (decision !== undefined) {
    dto.decision = decision;
  }

  const { value: note, errors: noteErrors } = validateNote(source.note);
  errors.push(...noteErrors);
  if (note !== undefined) {
    dto.note = note;
  }

  return { dto, errors };
}
