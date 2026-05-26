"use client";

import Link from "next/link";

type ContextHelpCardProps = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
};

export function ContextHelpCard({
  title,
  description,
  href,
  ctaLabel,
}: ContextHelpCardProps) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sky-900/80 dark:text-sky-100/80">{description}</p>
      <Link
        href={href}
        className="mt-3 inline-flex text-sm font-semibold underline-offset-4 hover:underline"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
