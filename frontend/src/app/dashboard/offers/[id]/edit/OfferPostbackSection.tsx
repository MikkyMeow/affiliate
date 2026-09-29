'use client';

import { useMemo, useState } from 'react';
import { buildTrackingUrl } from '@/lib/tracking';
import {
  buildPostbackExamples,
  DEFAULT_POSTBACK_MACROS,
  type PostbackGoal,
} from './postback-examples';

type CopyState = 'idle' | 'copied' | 'error';

type OfferPostbackSectionProps = {
  offerPublicId: string | null;
  postbackToken: string | null;
  goals: PostbackGoal[];
};

export function OfferPostbackSection({
  offerPublicId,
  postbackToken,
  goals,
}: OfferPostbackSectionProps) {
  const [copyStates, setCopyStates] = useState<Record<string, CopyState>>({});
  const endpointUrl = useMemo(() => buildTrackingUrl('/track/postback'), []);

  const examples = useMemo(() => {
    if (!postbackToken) {
      return [];
    }

    return buildPostbackExamples({
      token: postbackToken,
      goals,
    });
  }, [goals, postbackToken]);

  const handleCopy = async (goalId: string, code: string) => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }

      await navigator.clipboard.writeText(code);
      setCopyStates((current) => ({ ...current, [goalId]: 'copied' }));
    } catch {
      setCopyStates((current) => ({ ...current, [goalId]: 'error' }));
    }
  };

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Постбек</p>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Постбек
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Скопируйте пример запроса для нужной цели и отправляйте его с сервера рекламодателя при конверсии.
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
        <p>
          Адрес: <code className="text-xs">{endpointUrl}</code>
        </p>
        {offerPublicId && (
          <p className="mt-1">
            Оффер: <span className="font-medium">{offerPublicId}</span>
          </p>
        )}
        <p className="mt-3">
          Передавайте реальный <code>{DEFAULT_POSTBACK_MACROS.clickId}</code>, при
          наличии <code>{DEFAULT_POSTBACK_MACROS.externalId}</code> и оставляйте{' '}
          <code>status</code> со значением <code>&quot;approved&quot;</code>, если не
          нужен другой статус.
        </p>
        <p className="mt-2">
          Не меняйте <code>token</code> и <code>goal_id</code>. Подпись должна
          вычисляться на стороне рекламодателя. Начисления, выплаты и прибыль платформа рассчитывает автоматически.
        </p>
      </div>

      {!postbackToken ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Токен постбека недоступен.
        </div>
      ) : goals.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Добавьте цель, чтобы получить примеры постбеков.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {examples.map((example) => {
            const copyState = copyStates[example.goalId] ?? 'idle';

            return (
              <article
                key={example.goalId}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Цель: {example.goalName}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      goal_id: {example.goalId}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Запрос: <code>{example.requestTitle}</code>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCopy(example.goalId, example.code)}
                    className="ui-button rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {copyState === 'copied'
                      ? 'Скопировано'
                      : copyState === 'error'
                        ? 'Ошибка копирования'
                        : 'Скопировать код'}
                  </button>
                </div>

                <pre className="overflow-x-auto bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
                  <code>{example.code}</code>
                </pre>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
