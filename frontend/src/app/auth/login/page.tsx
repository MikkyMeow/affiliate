'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = useMemo(() => {
    const next = searchParams.get('next');
    if (next && next.startsWith('/')) {
      return next;
    }
    return '/';
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      router.push(redirectTo);
    } catch (err) {
      setError((err as Error).message ?? 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-zinc-950">
      <main className="flex w-full max-w-xl flex-col gap-6 rounded-2xl bg-white p-10 shadow-xl dark:bg-black">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Вход
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Используй email и пароль, чтобы авторизоваться.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Пароль
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
            {loading ? 'Входим…' : 'Войти'}
          </button>
        </form>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Нет аккаунта?{' '}
          <Link
            href={`/auth/register?next=${encodeURIComponent(redirectTo)}`}
            className="font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
          >
            Зарегистрируйтесь
          </Link>
        </p>
      </main>
    </div>
  );
}
