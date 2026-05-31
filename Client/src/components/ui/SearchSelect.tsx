import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { inputClass } from './FormField';

// ── Single-select ─────────────────────────────────────────────────────────────

export function SearchSelect({ value, onChange, options, placeholder = 'Select…', disabled }: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = options.filter(o => !q || o.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled}
        onClick={() => { setOpen(o => !o); setQ(''); }}
        className={`${inputClass} flex items-center justify-between text-left ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <span className={selected ? '' : 'text-slate-400 font-normal'}>{selected?.label ?? placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0 opacity-50"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-[var(--border)]">
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
                className={`${inputClass} py-1.5 text-[12px]`} />
            </div>
            <div className="max-h-44 overflow-y-auto">
              {filtered.length === 0
                ? <p className="text-[12px] text-[var(--text-muted)] px-3 py-2">No results</p>
                : filtered.map(o => (
                  <button key={o.id} type="button"
                    onClick={() => { onChange(o.id); setOpen(false); setQ(''); }}
                    className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--bg)] transition-colors ${o.id === value ? 'font-bold text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                    {o.label}
                  </button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Multi-select ──────────────────────────────────────────────────────────────

export function MultiSearchSelect({ value, onChange, options, placeholder = 'Select…', disabled }: {
  value: string[];
  onChange: (v: string[]) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);

  const filtered = options.filter(o =>
    (!q || o.label.toLowerCase().includes(q.toLowerCase())) && !value.includes(o.id)
  );

  const selectedOptions = value.map(v => options.find(o => o.id === v)).filter(Boolean) as { id: string; label: string }[];

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => !disabled && setOpen(o => !o)}
        className={`${inputClass} flex flex-wrap gap-1.5 items-center min-h-[42px] py-1.5 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {selectedOptions.length === 0 && (
          <span className="text-slate-400 font-normal py-0.5">{placeholder}</span>
        )}
        {selectedOptions.map(o => (
          <span key={o.id} className="inline-flex items-center gap-1 bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] text-[11px] font-semibold px-2 py-0.5 rounded-full">
            {o.label}
            <button type="button" onMouseDown={e => { e.stopPropagation(); toggle(o.id); }} className="hover:text-[var(--danger)] transition-colors">
              <X size={10} />
            </button>
          </span>
        ))}
        <svg width="12" height="12" viewBox="0 0 12 12" className="ml-auto shrink-0 opacity-50"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-[var(--border)]">
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
                className={`${inputClass} py-1.5 text-[12px]`} />
            </div>
            <div className="max-h-44 overflow-y-auto">
              {filtered.length === 0
                ? <p className="text-[12px] text-[var(--text-muted)] px-3 py-2">{q ? 'No results' : 'All options selected'}</p>
                : filtered.map(o => (
                  <button key={o.id} type="button"
                    onMouseDown={e => { e.preventDefault(); toggle(o.id); setQ(''); }}
                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--bg)] transition-colors text-[var(--text-primary)]">
                    {o.label}
                  </button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
