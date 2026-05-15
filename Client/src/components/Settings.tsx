import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings as SettingsIcon, LayoutGrid, CalendarRange, Bell } from 'lucide-react';
import { Modules } from './Modules';

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

export function Settings() {
  const [activeTab, setActiveTab] = useState('Modules');
  const tabs = ['Modules', 'Leave Settings', 'Notification Settings'];

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
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-btn flex flex-row items-center justify-center gap-2 ${tab === activeTab ? 'active' : ''}`}
          >
            {tab === 'Modules' && <LayoutGrid size={13} />}
            {tab === 'Leave Settings' && <CalendarRange size={13} />}
            {tab === 'Notification Settings' && <Bell size={13} />}
            {tab}
          </button>
        ))}
      </div>

      {/* Main card */}
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
            {(activeTab === 'Leave Settings' || activeTab === 'Notification Settings') && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] flex-1 overflow-hidden drop-shadow-sm h-full">
                {activeTab === 'Leave Settings' && <LeaveSettingsTab />}
                {activeTab === 'Notification Settings' && <NotificationSettingsTab />}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
