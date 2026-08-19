import type { Metadata } from "next";
import Link from "next/link";
import { PublicDocsBreadcrumbs } from "@/features/docs/PublicDocsBreadcrumbs";
import { PublicDocsPrevNext } from "@/features/docs/PublicDocsPrevNext";
import { PublicDocsShell } from "@/features/docs/PublicDocsShell";
import { PublicDocsToc } from "@/features/docs/PublicDocsToc";
import { PublicMarkdownContent } from "@/features/docs/PublicMarkdownContent";
import { getPrevNextPublicDocs } from "@/features/docs/public-docs-navigation";
import { buildPublicDocsSearchIndex } from "@/features/docs/public-docs-search";
import { publicDocsHome } from "@/features/docs/public-docs-manifest";
import {
  extractPublicDocHeadings,
  getDocBreadcrumbs,
} from "@/features/docs/public-docs-utils";
import { readPublicDocByHref } from "@/features/docs/read-public-doc";

export const metadata: Metadata = {
  title: "Документация | CPA Platform",
  description: "Справочник по работе с CPA-платформой",
};

export default async function DocsIndexPage() {
  const [doc, searchIndex] = await Promise.all([
    readPublicDocByHref("/docs"),
    buildPublicDocsSearchIndex(),
  ]);

  if (!doc) {
    return null;
  }

  const headings = doc.markdown ? extractPublicDocHeadings(doc.markdown) : [];
  const breadcrumbs = getDocBreadcrumbs(null);
  const navigation = getPrevNextPublicDocs(doc.href);
  const isEmpty = !doc.missing && !(doc.markdown ?? "").trim();

  return (
    <PublicDocsShell
      activeHref={publicDocsHome.href}
      title={doc.title}
      searchIndex={searchIndex}
      toc={<PublicDocsToc headings={headings} />}
    >
      <PublicDocsBreadcrumbs items={breadcrumbs} />
      {doc.missing ? (
        <MissingDocState
          title="Главная страница документации недоступна"
          description="Файл docs/user/README.md пока не найден. Боковая навигация уже доступна, остальные документы можно открыть напрямую."
        />
      ) : isEmpty ? (
        <MissingDocState
          title="Документация пока пуста"
          description="Markdown-файл для главной страницы найден, но не содержит текста. Навигация и поиск продолжают работать."
        />
      ) : (
        <>
          <div className="mb-8 xl:hidden">
            <PublicDocsToc headings={headings} />
          </div>
          <PublicMarkdownContent
            markdown={doc.markdown ?? ""}
            sourcePath={doc.sourcePath}
            headings={headings}
          />
          <PublicDocsPrevNext
            previous={navigation.previous}
            next={navigation.next}
          />
        </>
      )}
    </PublicDocsShell>
  );
}

function MissingDocState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 dark:border-zinc-700 dark:bg-zinc-900/70">
      <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      <Link
        href="/docs/platform-overview"
        className="mt-5 inline-flex rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
      >
        Открыть обзор платформы
      </Link>
    </div>
  );
}
