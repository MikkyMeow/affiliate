import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PublicDocsBreadcrumbs } from "@/features/docs/PublicDocsBreadcrumbs";
import { PublicDocsPrevNext } from "@/features/docs/PublicDocsPrevNext";
import { PublicDocsShell } from "@/features/docs/PublicDocsShell";
import { PublicDocsToc } from "@/features/docs/PublicDocsToc";
import { PublicMarkdownContent } from "@/features/docs/PublicMarkdownContent";
import { getPrevNextPublicDocs } from "@/features/docs/public-docs-navigation";
import { buildPublicDocsSearchIndex } from "@/features/docs/public-docs-search";
import {
  getPublicDocByHref,
  getPublicDocHrefFromSlug,
  getPublicDocStaticSlugs,
} from "@/features/docs/public-docs-manifest";
import {
  extractPublicDocHeadings,
  getDocBreadcrumbs,
} from "@/features/docs/public-docs-utils";
import { readPublicDocByHref } from "@/features/docs/read-public-doc";

interface DocPageProps {
  params: Promise<{
    slug: string[];
  }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return getPublicDocStaticSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: DocPageProps): Promise<Metadata> {
  const { slug } = await params;
  const href = getPublicDocHrefFromSlug(slug);
  const doc = getPublicDocByHref(href);

  if (!doc) {
    return {
      title: "Документация | MikiLead",
      description: "Справочник по работе с CPA-платформой",
    };
  }

  return {
    title: `${doc.title} | Документация | MikiLead`,
    description: "Справочник по работе с CPA-платформой",
  };
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params;
  const href = getPublicDocHrefFromSlug(slug);
  const docMeta = getPublicDocByHref(href);

  if (!docMeta) {
    notFound();
  }

  const [doc, searchIndex] = await Promise.all([
    readPublicDocByHref(href),
    buildPublicDocsSearchIndex(),
  ]);

  if (!doc) {
    notFound();
  }

  const headings = doc.markdown ? extractPublicDocHeadings(doc.markdown) : [];
  const breadcrumbs = getDocBreadcrumbs(docMeta);
  const navigation = getPrevNextPublicDocs(href);
  const isEmpty = !doc.missing && !(doc.markdown ?? "").trim();

  return (
    <PublicDocsShell
      activeHref={href}
      title={doc.title}
      searchIndex={searchIndex}
      toc={headings.length ? <PublicDocsToc headings={headings} /> : undefined}
    >
      <PublicDocsBreadcrumbs items={breadcrumbs} />
      {doc.missing ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 dark:border-zinc-700 dark:bg-zinc-900/70">
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Документ пока недоступен
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Не удалось открыть этот раздел. Выберите другую тему в меню или
            вернитесь к началу документации.
          </p>
          <Link
            href="/docs"
            className="mt-5 inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Вернуться к документации
          </Link>
        </div>
      ) : isEmpty ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 dark:border-zinc-700 dark:bg-zinc-900/70">
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Раздел готовится
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Инструкция появится здесь позже. Пока можно открыть другие разделы
            документации.
          </p>
          <Link
            href="/docs"
            className="mt-5 inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Вернуться к документации
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-8 xl:hidden">
            <PublicDocsToc headings={headings} />
          </div>
          <PublicMarkdownContent
            title={doc.title}
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
