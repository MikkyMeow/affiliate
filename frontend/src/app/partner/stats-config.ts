import type { PartnerStats } from '@/lib/stats';

export type PartnerStatsSummary = Pick<
  PartnerStats,
  | 'clicksTotal'
  | 'conversionsPending'
  | 'conversionsApproved'
  | 'conversionsRejected'
  | 'pendingPayout'
  | 'approvedPayout'
>;

export const PARTNER_STATS_CARDS: Array<{
  key: keyof PartnerStatsSummary;
  label: string;
  hint: string;
  accent: string;
  currency?: boolean;
}> = [
  {
    key: 'approvedPayout',
    label: 'Подтв. выплаты, ₽',
    hint: 'Approved payout — можно платить',
    accent:
      'from-emerald-500/10 to-emerald-500/5 text-emerald-900 dark:text-emerald-100',
    currency: true,
  },
  {
    key: 'pendingPayout',
    label: 'Ожидают выплату, ₽',
    hint: 'Pending payout — ещё проверяем',
    accent: 'from-amber-500/10 to-amber-500/5 text-amber-900 dark:text-amber-100',
    currency: true,
  },
  {
    key: 'conversionsApproved',
    label: 'Approved conversions',
    hint: 'Все заявки в статусе Approved',
    accent:
      'from-emerald-500/10 to-emerald-500/5 text-emerald-900 dark:text-emerald-100',
  },
  {
    key: 'conversionsPending',
    label: 'Pending conversions',
    hint: 'Ждут проверки',
    accent: 'from-amber-500/10 to-amber-500/5 text-amber-900 dark:text-amber-100',
  },
  {
    key: 'conversionsRejected',
    label: 'Rejected conversions',
    hint: 'Отклонённые заявки',
    accent: 'from-rose-500/10 to-rose-500/5 text-rose-900 dark:text-rose-100',
  },
  {
    key: 'clicksTotal',
    label: 'Клики',
    hint: 'Сколько раз жали на ваши ссылки',
    accent: 'from-blue-500/10 to-blue-500/5 text-blue-900 dark:text-blue-100',
  },
];
