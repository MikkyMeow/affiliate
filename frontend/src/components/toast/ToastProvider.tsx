'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const DEFAULT_DURATION = 6000;

const TOAST_STYLES = {
  success: {
    accent: 'bg-emerald-500',
    border: 'border-emerald-200/80 dark:border-emerald-500/40',
    background: 'bg-white/95 dark:bg-zinc-950/95',
    title: 'text-emerald-900 dark:text-emerald-100',
    description: 'text-emerald-700/90 dark:text-emerald-200/80',
  },
  warning: {
    accent: 'bg-amber-500',
    border: 'border-amber-200/80 dark:border-amber-500/40',
    background: 'bg-white/95 dark:bg-zinc-950/95',
    title: 'text-amber-900 dark:text-amber-100',
    description: 'text-amber-700/90 dark:text-amber-200/80',
  },
  error: {
    accent: 'bg-red-500',
    border: 'border-red-200/80 dark:border-red-500/40',
    background: 'bg-white/95 dark:bg-zinc-950/95',
    title: 'text-red-900 dark:text-red-100',
    description: 'text-red-700/90 dark:text-red-200/80',
  },
  info: {
    accent: 'bg-sky-500',
    border: 'border-sky-200/80 dark:border-sky-500/40',
    background: 'bg-white/95 dark:bg-zinc-950/95',
    title: 'text-sky-900 dark:text-sky-100',
    description: 'text-sky-700/90 dark:text-sky-200/80',
  },
} as const;

export type ToastVariant = keyof typeof TOAST_STYLES;

export type ShowToastOptions = {
  title: string;
  description?: string;
  duration?: number;
  persistent?: boolean;
};

type ToastRecord = ShowToastOptions & {
  id: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (variant: ToastVariant, options: ShowToastOptions) => string;
  success: (options: ShowToastOptions) => string;
  warning: (options: ShowToastOptions) => string;
  error: (options: ShowToastOptions) => string;
  info: (options: ShowToastOptions) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof window.setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timerId = timersRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      timersRef.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id: string, duration: number) => {
      const timerId = window.setTimeout(() => {
        dismissToast(id);
      }, duration);
      timersRef.current.set(id, timerId);
    },
    [dismissToast],
  );

  const showToast = useCallback(
    (variant: ToastVariant, options: ShowToastOptions) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const duration = options.duration ?? DEFAULT_DURATION;
      const toast: ToastRecord = {
        id,
        variant,
        title: options.title,
        description: options.description,
        duration,
        persistent: options.persistent ?? false,
      };

      setToasts((current) => [...current, toast]);

      if (!toast.persistent) {
        scheduleDismiss(id, duration);
      }

      return id;
    },
    [scheduleDismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;

    return () => {
      timers.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (options) => showToast('success', options),
      warning: (options) => showToast('warning', options),
      error: (options) => showToast('error', options),
      info: (options) => showToast('info', options),
      dismissToast,
    }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(100%-2rem,24rem)] flex-col gap-3 sm:right-6 sm:bottom-6">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}) {
  const styles = TOAST_STYLES[toast.variant];

  return (
    <div
      className={`pointer-events-auto overflow-hidden rounded-2xl border shadow-xl shadow-zinc-950/10 backdrop-blur-md transition dark:shadow-black/30 ${styles.border} ${styles.background}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex">
        <div className={`w-1.5 shrink-0 ${styles.accent}`} />
        <div className="flex flex-1 items-start gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold ${styles.title}`}>{toast.title}</p>
            {toast.description ? (
              <p className={`mt-1 text-sm leading-relaxed ${styles.description}`}>
                {toast.description}
              </p>
            ) : null}
          </div>
          {toast.persistent ? (
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200"
              aria-label="Закрыть уведомление"
            >
              <span aria-hidden="true" className="block text-base leading-none">
                ×
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
