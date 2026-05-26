import Link from "next/link";

interface PublicDocsBreadcrumbsProps {
  items: Array<{ label: string; href?: string }>;
}

export function PublicDocsBreadcrumbs({ items }: PublicDocsBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumbs" className="mb-6">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="transition hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "font-medium text-zinc-950 dark:text-zinc-50" : ""}>
                  {item.label}
                </span>
              )}
              {!isLast ? <span aria-hidden="true">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
