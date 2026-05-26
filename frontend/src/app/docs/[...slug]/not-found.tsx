import Link from "next/link";
import { PublicDocsShell } from "@/features/docs/PublicDocsShell";

export default function DocsNotFoundPage() {
  return (
    <PublicDocsShell activeHref="/docs" title="Страница не найдена">
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
      </div>
    </PublicDocsShell>
  );
}
