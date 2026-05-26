"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  publicDocsHome,
  publicDocsSections,
} from "@/features/docs/public-docs-manifest";

interface PublicDocsShellProps {
  activeHref: string;
  title: string;
  children: React.ReactNode;
}

function navItemClassName(active: boolean): string {
  return active
    ? "bg-black text-white dark:bg-white dark:text-black"
    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900";
}

export function PublicDocsShell({
  activeHref,
  title,
  children,
}: PublicDocsShellProps) {
  const router = useRouter();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-zinc-200 bg-white/95 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="border-b border-zinc-200 px-6 py-6 dark:border-zinc-800 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <span aria-hidden="true">←</span>
                На сайт
              </Link>
              <div>
                <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
                  Документация
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                  Справочник по работе с CPA-платформой
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                Текущий раздел:
              </span>{" "}
              {title}
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800 lg:border-b-0 lg:border-r lg:px-5">
            <div className="mb-4 lg:hidden">
              <label
                htmlFor="docs-nav"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400"
              >
                Навигация
              </label>
              <select
                id="docs-nav"
                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={activeHref}
                onChange={(event) => {
                  router.push(event.target.value);
                }}
              >
                <option value={publicDocsHome.href}>{publicDocsHome.title}</option>
                {publicDocsSections.map((section) =>
                  section.items.map((item) => (
                    <option key={item.href} value={item.href}>
                      {section.title}: {item.title}
                    </option>
                  )),
                )}
              </select>
            </div>

            <nav className="hidden lg:block">
              <Link
                href={publicDocsHome.href}
                className={`mb-5 block rounded-2xl px-4 py-3 text-sm font-medium transition ${navItemClassName(
                  activeHref === publicDocsHome.href,
                )}`}
              >
                {publicDocsHome.title}
              </Link>

              <div className="space-y-6">
                {publicDocsSections.map((section) => (
                  <section key={section.id}>
                    <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                      {section.title}
                    </h2>
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`block rounded-2xl px-4 py-3 text-sm font-medium transition ${navItemClassName(
                            activeHref === item.href,
                          )}`}
                        >
                          {item.title}
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </nav>
          </aside>

          <section className="min-w-0 px-6 py-6 sm:px-8 sm:py-8">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
