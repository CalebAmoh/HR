import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, CalendarRange, Bell, SlidersHorizontal } from 'lucide-react';
import { Modules } from './Modules';
import { getSettings, saveSetting } from '../../lib/settings';

// ─── Toggle row ──────────────────────────────────────────────────────────────
function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 border-b border-[var(--border-light)] last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">{label}</p>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative shrink-0 inline-flex h-[22px] w-[40px] cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--border)]',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm',
            'ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-[18px]' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function LeaveSettingsTab() {
  return (
    <div className="p-6">
      <h3 className="text-lg font-bold mb-4 syne">Leave Policies</h3>
      <p className="text-sm text-[var(--text-muted)]">Configure leave types and constraints here.</p>
    </div>
  );
}

function NotificationSettingsTab() {
  return (
    <div className="p-6">
      <h3 className="text-lg font-bold mb-4 syne">Notification Templates</h3>
      <p className="text-sm text-[var(--text-muted)]">Configure email and SMS templates here.</p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[11px] font-bold syne uppercase tracking-widest text-[var(--text-muted)]">{title}</span>
      <div className="flex-1 h-px bg-[var(--border-light)]" />
    </div>
  );
}

function ControlsTab() {
  const [autoGenCode, setAutoGenCode] = useState(() => getSettings().companyStructure.autoGenerateCode);
  const [autoGenEmpNum, setAutoGenEmpNum] = useState(() => getSettings().employees.autoGenerateNumber);
  const [payrollApproval, setPayrollApproval] = useState(() => getSettings().approvals.payrollApproval);
  const [selfApproval, setSelfApproval] = useState(() => getSettings().approvals.selfApproval);

  return (
    <div className="p-6 flex flex-col gap-8">

      {/* Company Structure section */}
      <section>
        <SectionHeader title="Company Structure" />
        <div className="mt-3">
          <SettingRow
            label="Auto Generate Code"
            description="Automatically generate a 4-character code when creating structures. Branches are always entered manually."
            checked={autoGenCode}
            onChange={val => { setAutoGenCode(val); saveSetting('companyStructure', { autoGenerateCode: val }); }}
          />
        </div>
      </section>

      {/* Employees section */}
      <section>
        <SectionHeader title="Employees" />
        <div className="mt-3">
          <SettingRow
            label="Auto Generate Employee Number"
            description="Automatically assign an employee number on creation using the format EMP-YEAR-0001. When off, you can enter the number manually."
            checked={autoGenEmpNum}
            onChange={val => { setAutoGenEmpNum(val); saveSetting('employees', { autoGenerateNumber: val }); }}
          />
        </div>
      </section>

      {/* Approval Workflows section */}
      <section>
        <SectionHeader title="Approval Workflows" />
        <div className="mt-3">
          <SettingRow
            label="Payroll Approval Workflow"
            description="Require payroll runs to be submitted and approved before they can be finalized. Adds a 'Submit for Approval' button after generation."
            checked={payrollApproval}
            onChange={val => { setPayrollApproval(val); saveSetting('approvals', { payrollApproval: val }); }}
          />
          <SettingRow
            label="Allow Self-Approval"
            description="Allow the same user who submitted a payroll run for approval to also approve it. When off, a different user must approve."
            checked={selfApproval}
            onChange={val => { setSelfApproval(val); saveSetting('approvals', { selfApproval: val }); }}
          />
        </div>
      </section>

    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS = ['Modules', 'Leave Settings', 'Notification Settings', 'Controls'] as const;
type Tab = (typeof TABS)[number];

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('Modules');

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-[1400px] mx-auto flex flex-col h-full">
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2 className="text-[22px] font-extrabold syne text-[var(--text-primary)] tracking-tight">
          System Settings
        </h2>
        <p className="text-[13px] text-[var(--text-muted)] mt-1 font-medium">
          Manage system-wide configuration, modules, and notifications.
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-btn flex flex-row items-center justify-center gap-2 ${tab === activeTab ? 'active' : ''}`}
          >
            {tab === 'Modules'                && <LayoutGrid          size={13} />}
            {tab === 'Leave Settings'         && <CalendarRange       size={13} />}
            {tab === 'Notification Settings'  && <Bell                size={13} />}
            {tab === 'Controls'               && <SlidersHorizontal   size={13} />}
            {tab}
          </button>
        ))}
      </div>

      {/* Content card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="flex flex-col flex-1 relative"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 h-full"
          >
            {activeTab === 'Modules' && (
              <div className="bg-[var(--bg)] -mx-4 sm:-mx-6 md:-mx-8">
                <Modules isSettings />
              </div>
            )}

            {activeTab !== 'Modules' && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] flex-1 overflow-hidden drop-shadow-sm h-full">
                {activeTab === 'Leave Settings'        && <LeaveSettingsTab />}
                {activeTab === 'Notification Settings' && <NotificationSettingsTab />}
                {activeTab === 'Controls'              && <ControlsTab />}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
