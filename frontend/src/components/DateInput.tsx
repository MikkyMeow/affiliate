'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { formatDateInputValue, parseDateInputValue } from '@/lib/format';

type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  id?: string;
};

export function DateInput({
  value,
  onChange,
  className,
  disabled = false,
  placeholder = 'дд.мм.гггг',
  name,
  id,
}: DateInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const [displayValue, setDisplayValue] = useState(() => formatDateInputValue(value));

  useEffect(() => {
    setDisplayValue(formatDateInputValue(value));
  }, [value]);

  const openPicker = () => {
    if (disabled || !pickerRef.current) {
      return;
    }

    try {
      if (typeof pickerRef.current.showPicker === 'function') {
        pickerRef.current.showPicker();
        return;
      }
    } catch {}

    pickerRef.current.focus();
    pickerRef.current.click();
  };

  const handleTextChange = (nextValue: string) => {
    setDisplayValue(nextValue);
    const parsedValue = parseDateInputValue(nextValue);

    if (parsedValue === '') {
      onChange('');
      return;
    }

    if (parsedValue) {
      onChange(parsedValue);
    }
  };

  const handleBlur = () => {
    const parsedValue = parseDateInputValue(displayValue);

    if (parsedValue === '') {
      setDisplayValue('');
      onChange('');
      return;
    }

    if (!parsedValue) {
      setDisplayValue(formatDateInputValue(value));
      return;
    }

    setDisplayValue(formatDateInputValue(parsedValue));
  };

  return (
    <div className="relative mt-2 min-w-0">
      <input
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={displayValue}
        onChange={(event) => handleTextChange(event.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`ui-input ${className?.replace(/\bmt-2\b/g, '') ?? ''} pr-12`}
      />
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pointer-events-none absolute right-0 bottom-0 h-0 w-0 opacity-0"
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-xl text-zinc-500 transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
        aria-label="Открыть календарь"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 2.75v2.5M14 2.75v2.5M3.75 7.25h12.5" />
          <rect x="3.75" y="4.75" width="12.5" height="11.5" rx="2" />
          <path d="M7.5 10h.01M10 10h.01M12.5 10h.01M7.5 12.75h.01M10 12.75h.01M12.5 12.75h.01" />
        </svg>
      </button>
    </div>
  );
}
