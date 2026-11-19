import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };
export default function Input({ label, error, hint, id, ...props }: Props) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
  return <label className="form-label" htmlFor={inputId}>{label}<input id={inputId} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined} {...props}/>{error&&<small id={`${inputId}-error`} role="alert">{error}</small>}{!error&&hint&&<small id={`${inputId}-hint`}>{hint}</small>}</label>;
}
