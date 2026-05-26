import Link from "next/link";
import { PublicDocsShell } from "@/features/docs/PublicDocsShell";
import { buildPublicDocsSearchIndex } from "@/features/docs/public-docs-search";

const popularDocs = [
  { title: "Обзор платформы", href: "/docs/platform-overview" },
  { title: "Роли", href: "/docs/roles" },
  { title: "Tracking-ссылки партнёра", href: "/docs/partner/tracking-links" },
  { title: "Postback рекламодателя", href: "/docs/advertiser/postbacks" },
];

export default async function DocsNotFoundPage() {
  const searchIndex = await buildPublicDocsSearchIndex();

  return (
    <PublicDocsShell
      activeHref="/docs"
      title="Страница не найдена"
      searchIndex={searchIndex}
    >
      <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 dark:border-zinc-700 dark:bg-zinc-900/70">
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          Документ не найден
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Для этого адреса нет публичного документа в whitelist manifest.
        </p>
        <Link
          href="/docs"
          className="mt-5 inline-flex rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Открыть документацию
        </Link>
        <div className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Популярные разделы
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {popularDocs.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm font-medium text-zinc-900 transition hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PublicDocsShell>
  );
}
