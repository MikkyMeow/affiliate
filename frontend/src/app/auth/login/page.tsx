"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/toast";
import { getHomePathByRole } from "@/lib/auth/routes";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthPageFallback title="Вход" />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectParam = useMemo(() => {
    const next = searchParams.get("next");
    if (next && next.startsWith("/")) {
      return next;
    }
    return null;
  }, [searchParams]);

  const redirectParamOrRoot = redirectParam ?? "/";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const loggedInUser = await login({ email, password });
      const target = redirectParam ?? getHomePathByRole(loggedInUser);
      toast.success({ title: "Вход выполнен", description: "Перенаправляем в кабинет." });
      router.push(target);
    } catch (err) {
      toast.error({
        title: "Не удалось войти",
        description: (err as Error).message ?? "Проверьте email и пароль.",
        persistent: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectParam ?? getHomePathByRole(user));
    }
  }, [authLoading, redirectParam, router, user]);

  if (!authLoading && user) {
    return null;
  }

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] items-center justify-center bg-zinc-50 px-4 py-8 sm:px-6 sm:py-12 dark:bg-zinc-950">
      <main className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Вход
          </h1>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Введите email и пароль от вашего аккаунта.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base font-normal text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Пароль
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base font-normal text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            {loading ? "Входим…" : "Войти"}
          </button>
        </form>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Нет аккаунта?{" "}
          <Link
            href={`/auth/register?next=${encodeURIComponent(redirectParamOrRoot)}`}
            className="font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
          >
            Зарегистрируйтесь
          </Link>
        </p>
      </main>
    </div>
  );
}

function AuthPageFallback({ title }: { title: string }) {
  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] items-center justify-center bg-zinc-50 px-4 py-8 sm:px-6 sm:py-12 dark:bg-zinc-950">
      <main className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm uppercase tracking-wide text-zinc-400">
          Загрузка
        </p>
        <p className="text-base text-zinc-800 dark:text-zinc-100">
          Открываем страницу «{title}»…
        </p>
      </main>
    </div>
  );
}
