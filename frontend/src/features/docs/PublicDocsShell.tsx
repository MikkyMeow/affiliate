"use client";

import Link from "next/link";
import { useState } from "react";
import {
  publicDocsHome,
  publicDocsSections,
} from "@/features/docs/public-docs-manifest";
import { PublicDocsSearch } from "@/features/docs/PublicDocsSearch";
import type { PublicDocSearchIndexItem } from "@/features/docs/public-docs-utils";

interface PublicDocsShellProps {
  activeHref: string;
  title: string;
  searchIndex: PublicDocSearchIndexItem[];
  toc?: React.ReactNode;
  children: React.ReactNode;
}

function navItemClassName(active: boolean): string {
  return active
    ? "bg-black text-white dark:bg-white dark:text-black"
    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900";
}

function SidebarNav({
  activeHref,
  onNavigate,
}: {
  activeHref: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Разделы документации">
      <Link
        href={publicDocsHome.href}
        onClick={onNavigate}
        aria-current={activeHref === publicDocsHome.href ? "page" : undefined}
        className={`mb-4 block rounded-xl px-3 py-2.5 text-sm font-medium transition ${navItemClassName(
          activeHref === publicDocsHome.href,
        )}`}
      >
        {publicDocsHome.title}
      </Link>

      <div className="space-y-6">
        {publicDocsSections.map((section) => (
          <section key={section.id}>
            <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {section.title}
            </h2>
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={activeHref === item.href ? "page" : undefined}
                  className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition ${navItemClassName(
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
  );
}

export function PublicDocsShell({
  activeHref,
  title,
  searchIndex,
  toc,
  children,
}: PublicDocsShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-zinc-200 bg-white/95 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800 sm:px-6">
          <div className="flex flex-col gap-5">
            <div>
              <Link href="/docs" className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                Документация
              </Link>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Справочник по работе с MikiLead
              </p>
            </div>

            <PublicDocsSearch index={searchIndex} />

            <div className="lg:hidden">
              <button
                type="button"
                aria-expanded={isMobileNavOpen}
                aria-controls="public-docs-mobile-nav"
                onClick={() => {
                  setIsMobileNavOpen((value) => !value);
                }}
                className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
              >
                {isMobileNavOpen ? "Скрыть разделы" : "Разделы документации"}
              </button>
            </div>
          </div>
        </div>

        {isMobileNavOpen ? (
          <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 lg:hidden">
            <div
              id="public-docs-mobile-nav"
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <SidebarNav
                activeHref={activeHref}
                onNavigate={() => {
                  setIsMobileNavOpen(false);
                }}
              />
            </div>
          </div>
        ) : null}

        <div className={`grid gap-0 lg:grid-cols-[240px_minmax(0,1fr)] ${toc ? "xl:grid-cols-[240px_minmax(0,1fr)_220px]" : ""}`}>
          <aside className="hidden border-r border-zinc-200 p-3 dark:border-zinc-800 lg:block">
            <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto py-2">
              <SidebarNav activeHref={activeHref} />
            </div>
          </aside>

          <section aria-label={title} className="min-w-0 px-4 py-6 sm:px-6 sm:py-8">{children}</section>

          {toc ? (
            <aside className="hidden border-l border-zinc-200 px-4 py-8 dark:border-zinc-800 xl:block">
              <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto">{toc}</div>
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}
