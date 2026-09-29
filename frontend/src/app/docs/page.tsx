import type { Metadata } from "next";
import Link from "next/link";
import { PublicDocsShell } from "@/features/docs/PublicDocsShell";
import { buildPublicDocsSearchIndex } from "@/features/docs/public-docs-search";
import { publicDocsHome } from "@/features/docs/public-docs-manifest";

export const metadata: Metadata = {
  title: "Документация | MikiLead",
  description: "Инструкции по работе с CPA-платформой MikiLead",
};

const quickStarts = [
  {
    title: "Партнёрам",
    description: "Доступ к офферам, создание ссылок и первые конверсии.",
    href: "/docs/guides/quick-start-partner",
  },
  {
    title: "Рекламодателям",
    description: "Работа с офферами, настройка постбеков и учёт результатов.",
    href: "/docs/guides/quick-start-advertiser",
  },
  {
    title: "Команде сети",
    description: "Управление участниками, офферами и доступами.",
    href: "/docs/guides/quick-start-admin",
  },
];

const referenceLinks = [
  { title: "Обзор платформы", description: "Возможности и основные разделы", href: "/docs/platform-overview" },
  { title: "Роли и доступы", description: "Кто видит данные и управляет ими", href: "/docs/roles" },
  { title: "Глоссарий", description: "Термины партнёрского маркетинга", href: "/docs/guides/glossary" },
  { title: "Частые ошибки", description: "Как решить типичные проблемы", href: "/docs/guides/common-errors" },
];

export default async function DocsIndexPage() {
  const searchIndex = await buildPublicDocsSearchIndex();

  return (
    <PublicDocsShell
      activeHref={publicDocsHome.href}
      title="Начало работы"
      searchIndex={searchIndex}
    >
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl dark:text-zinc-50">
            Начало работы
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Выберите инструкцию для своей роли или найдите нужную тему через поиск.
          </p>
        </div>
        <section aria-labelledby="quick-start-title">
          <h2 id="quick-start-title" className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Быстрый старт
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {quickStarts.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
              >
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">{item.title}</h3>
                <p className="mb-4 mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{item.description}</p>
                <span className="mt-auto text-sm font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                  Открыть инструкцию <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section aria-labelledby="reference-title">
          <h2 id="reference-title" className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Справочник
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {referenceLinks.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl border border-zinc-200 p-5 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PublicDocsShell>
  );
}
