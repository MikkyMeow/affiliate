"use client";

import Link from "next/link";

type HelpLinkProps = {
  href: string;
  label?: string;
  className?: string;
};

export function HelpLink({
  href,
  label = "Помощь",
  className = "",
}: HelpLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`inline-flex items-center gap-1 text-sm font-medium text-zinc-500 underline-offset-4 transition hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100 ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px] leading-none"
      >
        ?
      </span>
      <span>{label}</span>
    </Link>
  );
}
