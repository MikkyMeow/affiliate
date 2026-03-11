'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export function BackendMessage() {
  const [message, setMessage] = useState<string>('Загружаем сообщение...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMessage() {
      try {
        const payload = await apiFetch<{ message?: string }>(
          '/message',
          { signal: controller.signal },
        );
        setMessage(payload.message ?? 'Сообщение не найдено');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Не удалось загрузить сообщение');
        }
      }
    }

    loadMessage();

    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <p className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        {error}
      </p>
    );
  }

  return (
    <p className="rounded-md border border-zinc-200 bg-white/60 p-4 text-base text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100">
      {message}
    </p>
  );
}
