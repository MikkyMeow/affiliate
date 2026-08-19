"use client";

import type { PublicDocHeading } from "@/features/docs/public-docs-utils";

interface PublicDocsTocProps {
  headings: PublicDocHeading[];
}

export function PublicDocsToc({ headings }: PublicDocsTocProps) {
  if (headings.length === 0) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/80">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
        На этой странице
      </h2>
      <nav className="mt-4">
        <ul className="space-y-2">
          {headings.map((heading) => (
            <li key={heading.id} className={heading.level === 3 ? "pl-4" : ""}>
              <a
                href={`#${heading.id}`}
                className="text-sm leading-6 text-zinc-700 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
              >
                {heading.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
