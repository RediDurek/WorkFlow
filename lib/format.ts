'use client';

// Generic date formatter with optional locale.
export const formatDate = (value: string | number | Date, locale?: string) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return locale ? d.toLocaleDateString(locale) : d.toLocaleDateString();
};

// Short dd/mm/yyyy formatting with optional locale override.
export const formatDateShort = (value: string | number | Date, locale?: string) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  if (locale) return d.toLocaleDateString(locale);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// Hours formatter from milliseconds.
export const formatHours = (ms: number) => (ms / (1000 * 60 * 60)).toFixed(2);

