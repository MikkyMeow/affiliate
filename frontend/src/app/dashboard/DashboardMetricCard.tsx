'use client';

type DashboardMetricCardProps = {
  label: string;
  description: string;
  value: string;
  accentClassName: string;
};

export function DashboardMetricCard({
  label,
  description,
  value,
  accentClassName,
}: DashboardMetricCardProps) {
  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={`mt-3 text-3xl font-semibold ${accentClassName}`}>{value}</p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
    </article>
  );
}
