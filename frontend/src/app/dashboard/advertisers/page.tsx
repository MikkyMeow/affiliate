'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { canAccessAdminArea } from '@/lib/auth/roles';

type Advertiser = {
  id: string;
  publicId: string | null;
  publicIdNumber: number | null;
  name: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

export default function AdvertisersPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/advertisers');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  useEffect(() => {
    if (authLoading || !accessToken) {
      return;
    }

    let active = true;

    const fetchAdvertisers = async () => {
      setLoading(true);
      setError(null);

      try {
        const fetchedAdvertisers = await apiFetch<Advertiser[]>('/advertisers', {
          token: accessToken,
        });

        if (!active) {
          return;
        }
        setAdvertisers(fetchedAdvertisers);
      } catch (fetchError) {
        if (!active) {
          return;
        }
        setError((fetchError as Error).message);
        setAdvertisers([]);
      } finally {
        if (!active) {
          return;
        }
        setLoading(false);
      }
    };

    fetchAdvertisers();

    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  );

  if (authLoading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <p className="text-sm text-zinc-500">Проверяем авторизацию...</p>
      </section>
    );
  }

  if (!user || !accessToken) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нужна авторизация
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Войдите, чтобы увидеть список рекламодателей.
        </p>
        <div className="flex gap-3">
          <Link
            href={authLinks.login}
            className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
          >
            Войти
          </Link>
          <Link
            href={authLinks.register}
            className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Зарегистрироваться
          </Link>
        </div>
      </section>
    );
  }

  if (!canAccessAdminArea(user)) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нет доступа
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Этот раздел доступен только администраторам и менеджерам.
        </p>
        <Link
          href="/"
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          На главную
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="mb-8 space-y-2">
        <p className="text-sm uppercase tracking-wide text-zinc-500">
          Dashboard
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Рекламодатели
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Новые рекламодатели теперь проходят только через self-registration, поэтому
          админка отображает список без возможности ручного создания.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Список
          </h2>
          {loading ? (
            <span className="text-sm text-zinc-500">Загружаем...</span>
          ) : (
            <span className="text-sm text-zinc-500">
              {advertisers.length} шт.
            </span>
          )}
        </div>

        {error ? (
          <div className="px-6 py-10 text-center text-sm text-red-600 dark:text-red-400">
            Не удалось загрузить данные: {error}
          </div>
        ) : advertisers.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            Пока нет рекламодателей, зарегистрированных через self-service.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
                <tr>
                  <th className="px-6 py-3 font-medium">Название</th>
                  <th className="px-6 py-3 font-medium">Статус</th>
                  <th className="px-6 py-3 font-medium">Создан</th>
                  <th className="px-6 py-3 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {advertisers.map((advertiser) => (
                  <tr key={advertiser.id} className="text-zinc-900 dark:text-zinc-100">
                    <td className="px-6 py-4">
                      <div className="font-medium">
                        {advertiser.publicId
                          ? `${advertiser.publicId} · ${advertiser.name}`
                          : advertiser.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          advertiser.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {advertiser.status === 'active' ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                      {formatter.format(new Date(advertiser.createdAt))}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/advertisers/${advertiser.id}/edit`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-lg transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        title="Редактировать"
                        aria-label="Редактировать"
                      >
                        ✎
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
