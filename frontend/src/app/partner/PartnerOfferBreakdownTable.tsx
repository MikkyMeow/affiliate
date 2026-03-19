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
        <span className="text-xs text-zinc-500">
          Обновляем данные…
        </span>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Offer</th>
              <th className="px-4 py-3 text-left font-medium">Clicks</th>
              <th className="px-4 py-3 text-left font-medium">Всего</th>
              <th className="px-4 py-3 text-left font-medium">Approved</th>
              <th className="px-4 py-3 text-left font-medium">Pending</th>
              <th className="px-4 py-3 text-left font-medium">Rejected</th>
              <th className="px-4 py-3 text-left font-medium">Approved payout</th>
              <th className="px-4 py-3 text-left font-medium">Pending payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((row, index) => (
              <tr key={row.offerId ?? `offer-${index}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">
                    {getOfferName(row.offerId)}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {row.offerId ?? 'offerId отсутствует'}
                  </div>
                </td>
                <td className="px-4 py-3">{formatCount(row.clicks)}</td>
                <td className="px-4 py-3">{formatCount(row.conversionsTotal)}</td>
                <td className="px-4 py-3 text-emerald-600 dark:text-emerald-300">
                  {formatCount(row.conversionsApproved)}
                </td>
                <td className="px-4 py-3 text-amber-600 dark:text-amber-300">
                  {formatCount(row.conversionsPending)}
                </td>
                <td className="px-4 py-3 text-rose-600 dark:text-rose-300">
                  {formatCount(row.conversionsRejected)}
                </td>
                <td className="px-4 py-3">{formatMoney(row.approvedPayout)}</td>
                <td className="px-4 py-3">{formatMoney(row.pendingPayout)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
