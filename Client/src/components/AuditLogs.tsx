import { PageHeader } from './ui/PageHeader';

export function AuditLogs() {
  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-[1400px] mx-auto flex flex-col h-full">
      <PageHeader title="Audit Logs" subtitle="View system-wide activity logs." />

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col flex-1 drop-shadow-sm p-8 text-center text-[var(--text-muted)]">
        System audit logs will be displayed here.
      </div>
    </div>
  );
}
