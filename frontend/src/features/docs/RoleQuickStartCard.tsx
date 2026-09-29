"use client";

import Link from "next/link";

type RoleQuickStartCardProps = {
  href: string;
  title?: string;
  description: string;
};

export function RoleQuickStartCard({
  href,
  title = "Впервые на платформе?",
  description,
}: RoleQuickStartCardProps) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 leading-6 text-emerald-900/80 dark:text-emerald-100/80">
        {description}
      </p>
      <Link
        href={href}
        className="mt-3 inline-flex text-sm font-semibold underline-offset-4 hover:underline"
      >
        Открыть быстрый старт
      </Link>
    </div>
  );
}
