export type PartnerStatsSummary = {
  clicksTotal: number;
  conversionsTotal: number;
  conversionsPending: number;
  conversionsApproved: number;
  conversionsRejected: number;
  pendingPayout: number;
  approvedPayout: number;
};

export const PARTNER_STATS_CARDS: Array<{
  key: keyof PartnerStatsSummary;
  label: string;
  hint: string;
  accent: string;
  currency?: boolean;
}> = [
  {
    key: 'clicksTotal',
    label: 'Клики',
    hint: 'Все переходы по вашим ссылкам',
    accent: 'from-blue-500/10 to-blue-500/5 text-blue-900 dark:text-blue-100',
  },
  {
    key: 'conversionsTotal',
    label: 'Конверсии',
    hint: 'Все заявки и заказы',
    accent: 'from-indigo-500/10 to-indigo-500/5 text-indigo-900 dark:text-indigo-100',
  },
  {
    key: 'conversionsPending',
    label: 'Ожидают',
    hint: 'Статус Pending',
    accent: 'from-amber-500/10 to-amber-500/5 text-amber-900 dark:text-amber-100',
  },
  {
    key: 'conversionsApproved',
    label: 'Одобренные',
    hint: 'Статус Approved',
    accent:
      'from-emerald-500/10 to-emerald-500/5 text-emerald-900 dark:text-emerald-100',
  },
  {
    key: 'conversionsRejected',
    label: 'Отклонённые',
    hint: 'Статус Rejected',
    accent: 'from-rose-500/10 to-rose-500/5 text-rose-900 dark:text-rose-100',
  },
  {
    key: 'approvedPayout',
    label: 'Подтв. выплаты, ₽',
    hint: 'Сумма к выплате',
    accent:
      'from-emerald-500/10 to-emerald-500/5 text-emerald-900 dark:text-emerald-100',
    currency: true,
  },
  {
    key: 'pendingPayout',
    label: 'Ожидают выплату, ₽',
    hint: 'Pending выплаты',
    accent: 'from-amber-500/10 to-amber-500/5 text-amber-900 dark:text-amber-100',
    currency: true,
  },
];
