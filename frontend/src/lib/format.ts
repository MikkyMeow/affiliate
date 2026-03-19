const countFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string) {
  if (currencyFormatterCache.has(currency)) {
    return currencyFormatterCache.get(currency)!;
  }

  const formatter = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  });

  currencyFormatterCache.set(currency, formatter);
  return formatter;
}

function toNumeric(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function formatCount(value: unknown): string {
  return countFormatter.format(toNumeric(value));
}

export function formatMoney(value: unknown, currency = 'RUB'): string {
  const formatter = getCurrencyFormatter(currency);
  return formatter.format(toNumeric(value));
}
