"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  buildSearchSnippet,
  type PublicDocSearchIndexItem,
  type PublicDocSearchResult,
} from "@/features/docs/public-docs-utils";

interface PublicDocsSearchProps {
  index: PublicDocSearchIndexItem[];
}

function searchPublicDocs(
  index: PublicDocSearchIndexItem[],
  query: string,
): PublicDocSearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");

  if (!normalizedQuery) {
    return [];
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return index
    .map((item) => {
      const score = terms.reduce((total, term) => {
        let nextScore = total;

        if (item.title.toLocaleLowerCase("ru").includes(term)) {
          nextScore += 6;
        }

        if (item.section.toLocaleLowerCase("ru").includes(term)) {
          nextScore += 3;
        }

        if (item.href.toLocaleLowerCase("ru").includes(term)) {
          nextScore += 2;
        }

        if (item.content.toLocaleLowerCase("ru").includes(term)) {
          nextScore += 1;
        }

        return nextScore;
      }, 0);

      return {
        ...item,
        score,
        snippet: buildSearchSnippet(item.content, query) ?? item.snippet,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "ru"))
    .map((item) => ({
      title: item.title,
      href: item.href,
      section: item.section,
      snippet: item.snippet,
    }))
    .slice(0, 8);
}

export function PublicDocsSearch({ index }: PublicDocsSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const results = useMemo(() => searchPublicDocs(index, debouncedQuery), [debouncedQuery, index]);
  const hasQuery = debouncedQuery.trim().length > 0 || query.trim().length > 0;

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setQuery("");
            setDebouncedQuery("");
          }
        }}
        placeholder="Поиск по документации"
        className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-sky-500 dark:focus:ring-sky-950"
      />

      {hasQuery ? (
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {results.length > 0 ? (
            <div className="space-y-1">
              {results.map((result) => (
                <Link
                  key={result.href}
                  href={result.href}
                  className="block rounded-xl px-3 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {result.title}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {result.section}
                      </div>
                    </div>
                    <div className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:block">
                      {result.href}
                    </div>
                  </div>
                  {result.snippet ? (
                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      {result.snippet}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
              Ничего не найдено
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
