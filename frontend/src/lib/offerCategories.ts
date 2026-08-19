export type OfferCategoryValue =
  | 'finance_mfo'
  | 'services'
  | 'finance'
  | 'sports_betting'
  | 'education'
  | 'surveys'
  | 'hr_jobs'
  | 'automotive'
  | 'b2b'
  | 'travel'
  | 'other'
  | 'games'
  | 'ecommerce'
  | 'real_estate';

export type OfferCategoryOption = {
  value: OfferCategoryValue;
  label: string;
};

export const OFFER_CATEGORY_OPTIONS: OfferCategoryOption[] = [
  { value: 'finance_mfo', label: 'Финансы и МФО' },
  { value: 'services', label: 'Сервисы и услуги' },
  { value: 'finance', label: 'Финансы' },
  { value: 'sports_betting', label: 'Ставки на спорт' },
  { value: 'education', label: 'Образование' },
  { value: 'surveys', label: 'Опросы' },
  { value: 'hr_jobs', label: 'Работа (HR, подбор персонала)' },
  { value: 'automotive', label: 'Автомобильная тематика' },
  { value: 'b2b', label: 'B2B' },
  { value: 'travel', label: 'Путешествия' },
  { value: 'other', label: 'Другое' },
  { value: 'games', label: 'Игры' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'real_estate', label: 'Недвижимость' },
];

const labelByCategory = OFFER_CATEGORY_OPTIONS.reduce<Record<OfferCategoryValue, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<OfferCategoryValue, string>,
);

export function getOfferCategoryLabel(value: OfferCategoryValue | null | undefined) {
  if (!value) {
    return 'Без категории';
  }
  return labelByCategory[value] ?? 'Без категории';
}
