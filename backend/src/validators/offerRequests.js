const MAX_MESSAGE_LENGTH = 1000;

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
