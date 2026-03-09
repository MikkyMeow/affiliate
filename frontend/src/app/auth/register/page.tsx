'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, user, loading: authLoading } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = useMemo(() => {
    const next = searchParams.get('next');
    if (next && next.startsWith('/')) {
      return next;
    }
    return '/';
  }, [searchParams]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      router.push(redirectTo);
    } catch (err) {
      setError((err as Error).message ?? 'Не удалось создать аккаунт');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [authLoading, router, user]);

  if (!authLoading && user) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-zinc-950">
      <main className="flex w-full max-w-xl flex-col gap-6 rounded-2xl bg-white p-10 shadow-xl dark:bg-black">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Регистрация
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Создай аккаунт, чтобы продолжить работу в панели.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Имя (необязательно)
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
            <input
              type="email"
              name="email"
              required
              value={form.email}
              onChange={handleChange}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Пароль
            <input
              type="password"
              name="password"
              minLength={8}
              required
              value={form.password}
              onChange={handleChange}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          {error ? (
            <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-black"
          >
            {loading ? 'Создаём...' : 'Создать аккаунт'}
          </button>
        </form>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Уже есть аккаунт?{' '}
          <Link
            href={`/auth/login?next=${encodeURIComponent(redirectTo)}`}
            className="font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
          >
            Войдите
          </Link>
        </p>
      </main>
    </div>
  );
}
