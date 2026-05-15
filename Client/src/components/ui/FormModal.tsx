import type { ReactNode } from 'react';
import { X, Save } from 'lucide-react';
import { motion } from 'motion/react';

const maxWidthMap = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
} as const;

interface FormModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  maxWidth?: keyof typeof maxWidthMap;
  scrollable?: boolean;
  children: ReactNode;
}

export function FormModal({
  title,
  subtitle,
  onClose,
  onSave,
  saveLabel = 'Save',
  maxWidth = '2xl',
  scrollable = true,
  children,
}: FormModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className={`bg-[var(--surface)] w-full ${maxWidthMap[maxWidth]} rounded-2xl shadow-xl z-10 flex flex-col ${scrollable ? 'max-h-[90vh]' : ''} border border-[var(--border)] overflow-hidden`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-slate-50/50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800 syne">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className={`${scrollable ? 'flex-1 overflow-y-auto' : ''} p-6`}>
          {children}
        </div>

        <div className="px-6 py-4 border-t border-[var(--border)] bg-slate-50/50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="secondary-btn shadow-sm">
            Cancel
          </button>
          <button onClick={onSave} className="primary-btn shadow-sm flex items-center gap-2">
            <Save size={16} /> {saveLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
