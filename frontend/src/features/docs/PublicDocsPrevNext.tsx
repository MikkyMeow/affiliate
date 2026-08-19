import Link from "next/link";
import type { PublicDocNavLink } from "@/features/docs/public-docs-navigation";

interface PublicDocsPrevNextProps {
  previous: PublicDocNavLink | null;
  next: PublicDocNavLink | null;
}

function NavCard({
  href,
  eyebrow,
  title,
  direction,
  align = "left",
}: {
  href: string;
  eyebrow: string;
  title: string;
  direction: "previous" | "next";
  align?: "left" | "right";
}) {
  return (
    <Link
      href={href}
      className={`rounded-3xl border border-zinc-200 bg-zinc-50 px-5 py-4 transition hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-950 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {direction === "previous" ? "← Предыдущий раздел" : "Следующий раздел →"}
      </div>
      <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{eyebrow}</div>
      <div className="mt-1 text-base font-semibold text-zinc-950 dark:text-zinc-50">{title}</div>
    </Link>
  );
}

export function PublicDocsPrevNext({ previous, next }: PublicDocsPrevNextProps) {
  if (!previous && !next) {
    return null;
  }

  return (
    <nav
      aria-label="Next and previous sections"
      className="mt-10 grid gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800 md:grid-cols-2"
    >
      {previous ? (
        <NavCard
          href={previous.href}
          eyebrow={previous.section}
          title={previous.title}
          direction="previous"
        />
      ) : (
        <div />
      )}
      {next ? (
        <NavCard
          href={next.href}
          eyebrow={next.section}
          title={next.title}
          direction="next"
          align="right"
        />
      ) : null}
    </nav>
  );
}
