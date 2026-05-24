import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, X, Eye, Users, Banknote, RefreshCw, Check, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';
import { FormField, inputClass } from './ui/FormField';
import api from '../../lib/api';

type ApprovalModule = 'Employee' | 'Payroll';

// Safely extract a display string from a value that may be a plain string,
// a code-list-value object {label}, or a structure object {name}.
function toStr(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.label ?? v.name ?? '';
  return String(v);
}

interface ApprovalItem {
  id: string;
  module: ApprovalModule;
  title: string;
  subtitle: string;
  submittedAt: string | null;
  raw: any;
}

function ModulePill({ module }: { module: ApprovalModule }) {
  return module === 'Employee'
    ? <span className="pill pill-accent text-[11px]"><Users size={10} className="inline mr-1" />Employee</span>
    : <span className="pill pill-warning text-[11px]"><Banknote size={10} className="inline mr-1" />Payroll</span>;
}

// ── Employee detail panel ─────────────────────────────────────────────────────
function EmployeeDetail({ emp, onApprove, onClose, busy }: { emp: any; onApprove: () => void; onClose: () => void; busy: boolean }) {
  const rows = [
    ['Employee ID', emp.employee_id || emp.employeeId || '—'],
    ['Department',  toStr(emp.department)  || '—'],
    ['Job Title',   toStr(emp.jobTitle)    || toStr(emp.designation) || '—'],
    ['Email',       emp.email       || '—'],
    ['Phone',       emp.phone       || '—'],
    ['Employment',  toStr(emp.employmentStatus) || emp.employmentType || emp.employment_type || '—'],
    ['Approval',    emp.approvalStatus || '—'],
    ['Lifecycle',   emp.lifecycleStatus || emp.lifecycle_status || '—'],
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
        <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] flex items-center justify-center">
          <Users size={18} className="text-[var(--accent)]" />
        </div>
        <div>
          <p className="font-bold text-[var(--text-primary)]">{emp.firstName} {emp.lastName}</p>
          <p className="text-xs text-[var(--text-muted)]">New employee pending approval</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] text-[var(--text-muted)] font-medium">{label}</dt>
            <dd className="text-[13px] text-[var(--text-primary)] font-semibold mt-0.5">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
        <button className="secondary-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="primary-btn bg-green-600 hover:bg-green-700" onClick={onApprove} disabled={busy}>
          <Check size={14} />
          <span>{busy ? 'Approving…' : 'Approve Employee'}</span>
        </button>
      </div>
    </div>
  );
}

// ── Payroll run detail panel ──────────────────────────────────────────────────
function PayrollDetail({ run, onApprove, onReject, onClose, busy }: { run: any; onApprove: () => void; onReject: (reason: string) => void; onClose: () => void; busy: boolean }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason]       = useState('');

  const rows = [
    ['Run Name',     run.name         || '—'],
    ['Period',       run.date_start   ? `${String(run.date_start).slice(0,10)} → ${String(run.date_end||'').slice(0,10)}` : '—'],
    ['Pay Frequency',run.freq_name    || '—'],
    ['Status',       run.status       || '—'],
    ['Deduction Group', run.group_name || '—'],
    ['Submitted By', run.submitted_by_name || run.submitted_by || '—'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
        <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] flex items-center justify-center">
          <Banknote size={18} className="text-[var(--warning)]" />
        </div>
        <div>
          <p className="font-bold text-[var(--text-primary)]">{run.name}</p>
          <p className="text-xs text-[var(--text-muted)]">Payroll run pending approval</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] text-[var(--text-muted)] font-medium">{label}</dt>
            <dd className="text-[13px] text-[var(--text-primary)] font-semibold mt-0.5">{value}</dd>
          </div>
        ))}
      </dl>

      {rejecting && (
        <div>
          <FormField label="Rejection Reason">
            <textarea
              className={inputClass + ' resize-none'}
              rows={3}
              placeholder="Enter reason for rejection…"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </FormField>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
        <button className="secondary-btn" onClick={onClose} disabled={busy}>Cancel</button>
        {rejecting ? (
          <>
            <button className="secondary-btn" onClick={() => setRejecting(false)} disabled={busy}>Back</button>
            <button
              className="primary-btn !bg-red-600 hover:!bg-red-700"
              onClick={() => onReject(reason)}
              disabled={busy || !reason.trim()}
            >
              <XCircle size={14} />
              <span>{busy ? 'Rejecting…' : 'Confirm Reject'}</span>
            </button>
          </>
        ) : (
          <>
            <button className="secondary-btn !border-red-500 !text-red-600 hover:!bg-red-50" onClick={() => setRejecting(true)} disabled={busy}>
              <XCircle size={14} />
              <span>Reject</span>
            </button>
            <button className="primary-btn !bg-green-600 hover:!bg-green-700" onClick={onApprove} disabled={busy}>
              <Check size={14} />
              <span>{busy ? 'Approving…' : 'Approve'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Slide-over panel wrapper ──────────────────────────────────────────────────
function SlideOver({ item, onClose, onDone }: { item: ApprovalItem; onClose: () => void; onDone: (id: string) => void }) {
  const [busy, setBusy] = useState(false);

  async function approveEmployee() {
    setBusy(true);
    try {
      await api.put(`/employees/${item.id}/approve`);
      toast.success('Employee approved');
      onDone(item.id);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Approval failed');
    } finally { setBusy(false); }
  }

  async function approvePayroll() {
    setBusy(true);
    try {
      await api.post(`/payroll/runs/${item.id}/approve`);
      toast.success('Payroll run approved');
      onDone(item.id);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Approval failed');
    } finally { setBusy(false); }
  }

  async function rejectPayroll(reason: string) {
    setBusy(true);
    try {
      await api.post(`/payroll/runs/${item.id}/reject`, { reason });
      toast.success('Payroll run rejected');
      onDone(item.id);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Rejection failed');
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--surface)] border-l border-[var(--border)] z-50 flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h3 className="font-bold text-[var(--text-primary)] syne text-[16px]">Review & Approve</h3>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5"><ModulePill module={item.module} /></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {item.module === 'Employee' ? (
            <EmployeeDetail emp={item.raw} onApprove={approveEmployee} onClose={onClose} busy={busy} />
          ) : (
            <PayrollDetail run={item.raw} onApprove={approvePayroll} onReject={rejectPayroll} onClose={onClose} busy={busy} />
          )}
        </div>
      </motion.div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CentralApproval() {
  const [items, setItems]           = useState<ApprovalItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, runRes] = await Promise.allSettled([
        api.get('/employees'),
        api.get('/payroll/runs'),
      ]);

      const pending: ApprovalItem[] = [];

      if (empRes.status === 'fulfilled') {
        const emps: any[] = empRes.value.data.data ?? [];
        emps
          .filter((e: any) => e.approvalStatus === 'PENDING' || e.approvalStatus === 'Pending')
          .forEach((e: any) => {
            pending.push({
              id:          String(e.id),
              module:      'Employee',
              title:       `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || 'Unknown Employee',
              subtitle:    toStr(e.jobTitle) || toStr(e.department) || String(e.email || ''),
              submittedAt: e.createdAt || e.created_at || null,
              raw:         e,
            });
          });
      }

      if (runRes.status === 'fulfilled') {
        const runs: any[] = runRes.value.data.data ?? [];
        runs
          .filter((r: any) => r.status === 'Pending Approval')
          .forEach((r: any) => {
            pending.push({
              id:          String(r.id),
              module:      'Payroll',
              title:       r.name || 'Unnamed Run',
              subtitle:    r.freq_name || r.date_start ? `${String(r.date_start || '').slice(0,10)}` : '',
              submittedAt: r.updated_at || r.created_at || null,
              raw:         r,
            });
          });
      }

      setItems(pending);
    } catch {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function handleDone(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    setSelectedItem(null);
  }

  const filtered = items.filter(i =>
    i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.module.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 w-full relative h-full flex flex-col">
      <div className="max-w-[1300px] w-full mx-auto px-6 py-8 flex-1 flex flex-col">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <h1 className="syne text-[26px] font-extrabold text-[var(--text-primary)] m-0 flex items-center gap-2">
            <CheckCircle className="text-[var(--accent)]" size={28} />
            Central Approval
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1.5">
            Review and action all pending approvals across employees and payroll.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col flex-1 max-h-min drop-shadow-sm"
        >
          <TableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search approvals…"
            searchWidth="sm:min-w-[300px]"
            actions={
              <button className="secondary-btn" onClick={fetchAll}>
                <RefreshCw size={14} />
                <span>Refresh</span>
              </button>
            }
          />

          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className="th">Module</th>
                  <th scope="col" className="th">Name</th>
                  <th scope="col" className="th">Details</th>
                  <th scope="col" className="th">Submitted</th>
                  <th scope="col" className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="td text-center py-12">
                      <p className="text-[var(--text-muted)] text-[13px]">Loading pending approvals…</p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="td text-center py-12">
                      {items.length === 0
                        ? <div>
                            <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
                            <p className="text-[var(--text-muted)] text-[13px]">No pending approvals — all caught up!</p>
                          </div>
                        : <p className="text-[var(--text-muted)] text-[13px]">No approvals match your search.</p>
                      }
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, i) => (
                    <motion.tr
                      key={`${item.module}-${item.id}`}
                      className="tr"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.04 }}
                    >
                      <td className="td"><ModulePill module={item.module} /></td>
                      <td className="td font-medium text-[var(--text-primary)]">{item.title}</td>
                      <td className="td text-[var(--text-muted)] text-[13px]">{item.subtitle || '—'}</td>
                      <td className="td text-[var(--text-muted)] text-[12px]">
                        {item.submittedAt ? String(item.submittedAt).slice(0, 10) : '—'}
                      </td>
                      <td className="td text-right">
                        <button
                          className="primary-btn"
                          onClick={() => setSelectedItem(item)}
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination total={items.length} filtered={filtered.length} />
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedItem && (
          <SlideOver
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onDone={handleDone}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
