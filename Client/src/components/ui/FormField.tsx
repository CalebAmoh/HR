import type { ReactNode } from 'react';

export const inputClass =
  'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all font-medium';

export const labelClass = 'block text-[13px] font-semibold text-slate-700 mb-1.5 syne';

interface FormFieldProps {
  label: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, required, className, children }: FormFieldProps) {
  return (
    <div className={className}>
      <label className={labelClass}>
        {label}
        {required && <span className="text-[var(--danger)]"> *</span>}
      </label>
      {children}
    </div>
  );
}
