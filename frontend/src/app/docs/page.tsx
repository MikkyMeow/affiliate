import type { Metadata } from "next";
import { PublicDocsShell } from "@/features/docs/PublicDocsShell";
import { PublicMarkdownContent } from "@/features/docs/PublicMarkdownContent";
import { publicDocsHome } from "@/features/docs/public-docs-manifest";
import { readPublicDocByHref } from "@/features/docs/read-public-doc";

export const metadata: Metadata = {
  title: "Документация | CPA Platform",
  description: "Справочник по работе с CPA-платформой",
};

export default async function DocsIndexPage() {
  const doc = await readPublicDocByHref("/docs");

  if (!doc) {
    return null;
  }

  return (
    <PublicDocsShell activeHref={publicDocsHome.href} title={doc.title}>
      {doc.missing ? (
        <MissingDocState
          title="Главная страница документации недоступна"
          description="Файл docs/user/README.md пока не найден. Боковая навигация уже доступна, остальные документы можно открыть напрямую."
        />
      ) : (
        <PublicMarkdownContent
          markdown={doc.markdown ?? ""}
          sourcePath={doc.sourcePath}
        />
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
    </div>
  );
}
