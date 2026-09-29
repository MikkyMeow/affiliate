"use client";

import { formatCount, formatMoney } from '@/lib/format';
import type { PartnerOfferBreakdown } from '@/lib/stats';

type PartnerOfferBreakdownTableProps = {
  rows: PartnerOfferBreakdown[];
  loading: boolean;
  emptyMessage?: string;
  resolveOfferName?: (offerId: string | null) => string;
};

export function PartnerOfferBreakdownTable({
  rows,
  loading,
  emptyMessage = 'По вашим офферам пока нет данных.',
  resolveOfferName,
}: PartnerOfferBreakdownTableProps) {
  if (loading && rows.length === 0) {
    return <p className="text-sm text-zinc-500">Загружаем разбивку по офферам…</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMessage}</p>;
  }

  const getOfferName = (offerId: string | null) => {
    if (resolveOfferName) {
      return resolveOfferName(offerId);
    }
    return offerId ?? '—';
  };

  return (
    <div className="space-y-3">
      {loading && (
        <span className="break-words text-xs text-zinc-500">
          Обновляем данные…
        </span>
      )}
      <div className="ui-table-wrap overflow-x-auto">
        <table className="min-w-[860px] w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Оффер</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Клики</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Всего</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Подтверждено</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">На проверке</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Отклонено</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Подтверждённые выплаты</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Выплаты на проверке</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((row, index) => (
              <tr key={row.offerId ?? `offer-${index}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">
                    {getOfferName(row.offerId)}
                  </div>
                  <div className="break-words text-xs text-zinc-500">
                    {row.offerId ? `ID: ${row.offerId}` : 'Оффер не указан'}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">{formatCount(row.clicks)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">{formatCount(row.conversionsTotal)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-600 dark:text-emerald-300">
                  {formatCount(row.conversionsApproved)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-amber-600 dark:text-amber-300">
                  {formatCount(row.conversionsPending)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-rose-600 dark:text-rose-300">
                  {formatCount(row.conversionsRejected)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">{formatMoney(row.approvedPayout)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">{formatMoney(row.pendingPayout)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
