'use client';

import type { ReactNode } from 'react';

const VARIANT_STYLES = {
  info: {
    border: 'border-zinc-200 dark:border-zinc-700',
    bg: 'bg-zinc-50 dark:bg-zinc-900/50',
    text: 'text-zinc-700 dark:text-zinc-200',
  },
  success: {
    border: 'border-emerald-200 dark:border-emerald-500/40',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-800 dark:text-emerald-100',
  },
  warning: {
    border: 'border-amber-200 dark:border-amber-500/40',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-800 dark:text-amber-100',
  },
  error: {
    border: 'border-red-200 dark:border-red-500/40',
    bg: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-700 dark:text-red-100',
  },
} as const;

export type InlineAlertVariant = keyof typeof VARIANT_STYLES;

export function InlineAlert({
  variant = 'info',
  title,
  children,
}: {
  variant?: InlineAlertVariant;
  title?: ReactNode;
  children: ReactNode;
}) {
  const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.info;
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={`break-words rounded-2xl border px-4 py-3 text-sm leading-relaxed ${styles.border} ${styles.bg} ${styles.text}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? 'mt-1 text-sm leading-relaxed' : ''}>{children}</div>
    </div>
  );
}
