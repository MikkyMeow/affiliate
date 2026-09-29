const CONVERSION_STATUS_LABELS: Record<string, string> = {
  approved: "Подтверждено",
  pending: "На проверке",
  rejected: "Отклонено",
};

const OFFER_STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  inactive: "Неактивен",
  paused: "На паузе",
  archived: "В архиве",
};

const POSTBACK_STATUS_LABELS: Record<string, string> = {
  received: "Получен",
  processed: "Обработан",
  rejected: "Отклонён",
  duplicate: "Дубликат",
  failed: "Ошибка",
};

export function conversionStatusLabel(status?: string | null) {
  return status ? CONVERSION_STATUS_LABELS[status] ?? status : "—";
}

export function offerStatusLabel(status?: string | null) {
  return status ? OFFER_STATUS_LABELS[status] ?? status : "—";
}

export function postbackStatusLabel(status?: string | null) {
  return status ? POSTBACK_STATUS_LABELS[status] ?? status : "—";
}
