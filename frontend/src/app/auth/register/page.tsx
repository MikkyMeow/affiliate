"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/toast";
import { getHomePathByRole } from "@/lib/auth/routes";

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthPageFallback title="Регистрация" />}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, user, loading: authLoading } = useAuth();
  const toast = useToast();
  type RegisterFormState = {
    email: string;
    password: string;
    name: string;
    accountType: "affiliate" | "advertiser";
  };
  const [form, setForm] = useState<RegisterFormState>({
    email: "",
    password: "",
    name: "",
    accountType: "affiliate",
  });
  const [loading, setLoading] = useState(false);

  const redirectParam = useMemo(() => {
    const next = searchParams.get("next");
    if (next && next.startsWith("/")) {
      return next;
    }
    return null;
  }, [searchParams]);
  const redirectParamOrRoot = redirectParam ?? "/";

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ): void => {
    const { name, value } = event.target;

    if (name === "accountType") {
      const typedValue = value === "advertiser" ? "advertiser" : "affiliate";
      setForm((prev) => ({ ...prev, accountType: typedValue }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const registeredUser = await register(form);
      const target = redirectParam ?? getHomePathByRole(registeredUser);
      toast.success({ title: "Аккаунт создан", description: "Переходим в кабинет." });
      router.push(target);
    } catch (err) {
      toast.error({
        title: "Не удалось создать аккаунт",
        description: (err as Error).message ?? "Попробуйте ещё раз.",
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
            Регистрация
          </h1>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Выберите тип аккаунта и заполните данные для входа.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Имя
            <input
              type="text"
              autoComplete="name"
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              className="mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base font-normal text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Тип аккаунта
            <select
              name="accountType"
              required
              value={form.accountType}
              onChange={handleChange}
              className="mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base font-normal text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800"
            >
              <option value="affiliate">Партнёр</option>
              <option value="advertiser">Рекламодатель</option>
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              name="email"
              required
              value={form.email}
              onChange={handleChange}
              className="mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base font-normal text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Пароль
            <input
              type="password"
              autoComplete="new-password"
              aria-describedby="password-hint"
              name="password"
              minLength={8}
              required
              value={form.password}
              onChange={handleChange}
              className="mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base font-normal text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800"
            />
            <span id="password-hint" className="mt-2 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
              Не менее 8 символов.
            </span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            {loading ? "Создаём аккаунт…" : "Создать аккаунт"}
          </button>
        </form>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Уже есть аккаунт?{" "}
          <Link
            href={`/auth/login?next=${encodeURIComponent(redirectParamOrRoot)}`}
            className="font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
          >
            Войдите
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
