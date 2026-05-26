import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicDocsShell } from "@/features/docs/PublicDocsShell";
import { PublicMarkdownContent } from "@/features/docs/PublicMarkdownContent";
import {
  getPublicDocByHref,
  getPublicDocHrefFromSlug,
  getPublicDocStaticSlugs,
} from "@/features/docs/public-docs-manifest";
import { readPublicDocByHref } from "@/features/docs/read-public-doc";

interface DocPageProps {
  params: Promise<{
    slug: string[];
  }>;
}

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
      title: "Документация | CPA Platform",
      description: "Справочник по работе с CPA-платформой",
    };
  }

  return {
    title: `${doc.title} | Документация | CPA Platform`,
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

  const doc = await readPublicDocByHref(href);

  if (!doc) {
    notFound();
  }

  return (
    <PublicDocsShell activeHref={href} title={doc.title}>
      {doc.missing ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 dark:border-zinc-700 dark:bg-zinc-900/70">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Документ пока недоступен
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Файл для маршрута <span className="font-medium">{href}</span> не
            найден в <span className="font-medium">{doc.sourcePath}</span>.
            Навигация продолжает работать, а страница не падает.
          </p>
        </div>
      ) : (
        <PublicMarkdownContent
          markdown={doc.markdown ?? ""}
          sourcePath={doc.sourcePath}
        />
      )}
    </PublicDocsShell>
  );
}
