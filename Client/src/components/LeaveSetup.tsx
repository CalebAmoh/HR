import React, { useState } from 'react';
import { Settings, Check, ChevronDown, Plus, Edit, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { LeaveTypeForm } from './LeaveTypeForm';
import { LeavePeriodForm } from './LeavePeriodForm';
import { HolidayForm } from './HolidayForm';
import { PageHeader } from './ui/PageHeader';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';

const MAIN_TABS = ['Leave Types', 'Leave Period', 'Work Week', 'Holidays', 'Leave Rules'];
const GROUP_TABS = ['Add Leave Group', 'Leave Group Employees'];

export function LeaveSetup() {
  const [activeTab, setActiveTab] = useState('Leave Types');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [leaveTypes, setLeaveTypes] = useState([
    { id: 1, name: 'Annual leave', leavesPerPeriod: '20', adminCanAssign: 'Yes', leaveColor: '#3b82f6' },
    { id: 2, name: 'Maternity Leave', leavesPerPeriod: '90', adminCanAssign: 'Yes', leaveColor: '#e11d48' },
  ]);

  const [leavePeriods, setLeavePeriods] = useState([
    { id: 1, startDate: '2026-01-01', endDate: '2026-12-31' },
  ]);

  const [holidays, setHolidays] = useState([
    { id: 1, name: 'New Year', date: '2026-01-01' },
    { id: 2, name: 'Labor Day', date: '2026-05-01' },
  ]);

  const [workDays, setWorkDays] = useState({
    Monday: 'Full Day', Tuesday: 'Full Day', Wednesday: 'Full Day',
    Thursday: 'Full Day', Friday: 'Full Day',
    Saturday: 'Non-working Day', Sunday: 'Non-working Day',
  });

  const isGroupTab = GROUP_TABS.includes(activeTab);
  const isKnownTab = [...MAIN_TABS, ...GROUP_TABS, 'Employee Leave List'].includes(activeTab);

  return (
    <div className="p-4 sm:p-6 w-full max-w-[1400px] mx-auto overflow-x-hidden flex flex-col h-full relative">
      <PageHeader title="Leave Setup" subtitle="Configure company leave policies and groups." />

      {/* Tab bar — kept custom due to dropdown */}
      <div className="flex flex-wrap items-center gap-2 mt-2 mb-4 border-b border-slate-200 pb-2">
        {MAIN_TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-btn ${activeTab === tab ? 'active' : ''}`}>
            {tab}
          </button>
        ))}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
            className={`tab-btn flex items-center gap-1 ${isGroupTab ? 'active' : ''}`}
          >
            Leave Groups <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1.5 flex flex-col">
              {GROUP_TABS.map((tab) => (
                <button
                  key={tab}
                  onMouseDown={(e) => { e.preventDefault(); setActiveTab(tab); setDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 transition-colors ${activeTab === tab ? 'text-[var(--accent)] font-bold' : 'text-slate-600 font-medium'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setActiveTab('Employee Leave List')} className={`tab-btn ${activeTab === 'Employee Leave List' ? 'active' : ''}`}>
          Employee Leave List
        </button>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col">

        {activeTab === 'Leave Types' && (
          <div className="flex flex-col">
            <TableToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search leave types..."
              actions={
                <button onClick={() => setShowTypeForm(true)} className="primary-btn shrink-0">
                  <span className="hidden sm:inline">Add Leave Type</span>
                  <span className="sm:hidden">Add</span>
                  <Plus className="w-[14px] h-[14px]" />
                </button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className="th">Name</th>
                    <th scope="col" className="th text-center">Leaves Per Period</th>
                    <th scope="col" className="th text-center">Admin Can Assign</th>
                    <th scope="col" className="th text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveTypes.map((type, i) => (
                    <motion.tr key={type.id} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                      <td className="td font-medium text-[var(--text-primary)]">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.leaveColor }} />
                          {type.name}
                        </div>
                      </td>
                      <td className="td text-center">{type.leavesPerPeriod}</td>
                      <td className="td text-center">{type.adminCanAssign}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button className="action-btn text-[var(--accent)]"><Edit size={14} /></button>
                          <button className="action-btn text-[var(--danger)]"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination total={leaveTypes.length} filtered={leaveTypes.length} />
          </div>
        )}

        {activeTab === 'Leave Period' && (
          <div className="flex flex-col">
            <TableToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search leave periods..."
              actions={
                <button onClick={() => setShowPeriodForm(true)} className="primary-btn shrink-0">
                  <span className="hidden sm:inline">Add Leave Period</span>
                  <span className="sm:hidden">Add</span>
                  <Plus className="w-[14px] h-[14px]" />
                </button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className="th">Start Date</th>
                    <th scope="col" className="th">End Date</th>
                    <th scope="col" className="th text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leavePeriods.map((period, i) => (
                    <motion.tr key={period.id} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                      <td className="td font-medium text-[var(--text-primary)]">{period.startDate}</td>
                      <td className="td">{period.endDate}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button className="action-btn text-[var(--accent)]"><Edit size={14} /></button>
                          <button className="action-btn text-[var(--danger)]"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination total={leavePeriods.length} filtered={leavePeriods.length} />
          </div>
        )}

        {activeTab === 'Work Week' && (
          <div className="flex flex-col">
            <div className="flex flex-col border-b border-[var(--border)]">
              <div className="p-4 sm:p-5">
                <h3 className="font-bold text-[var(--text-primary)]">Work Week Setup</h3>
              </div>
            </div>
            <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
              <div className="grid grid-cols-[100px_1fr] gap-y-4 items-center">
                {Object.entries(workDays).map(([day, value]) => (
                  <React.Fragment key={day}>
                    <div className="font-bold text-[var(--text-primary)] text-[13px]">{day}</div>
                    <select
                      value={value}
                      onChange={(e) => setWorkDays({ ...workDays, [day]: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--surface)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] text-[var(--text-primary)] max-w-xs transition-colors"
                    >
                      <option value="Full Day">Full Day</option>
                      <option value="Half Day">Half Day</option>
                      <option value="Non-working Day">Non-working Day</option>
                    </select>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="px-4 py-4 border-t border-[var(--border)] flex items-center justify-start bg-[var(--surface-hover)]">
              <button className="primary-btn shrink-0"><Check size={14} /> Save Settings</button>
            </div>
          </div>
        )}

        {activeTab === 'Holidays' && (
          <div className="flex flex-col">
            <TableToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search holidays..."
              actions={
                <button onClick={() => setShowHolidayForm(true)} className="primary-btn shrink-0">
                  <span className="hidden sm:inline">Add Holiday</span>
                  <span className="sm:hidden">Add</span>
                  <Plus className="w-[14px] h-[14px]" />
                </button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className="th">Name</th>
                    <th scope="col" className="th">Date</th>
                    <th scope="col" className="th text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((holiday, i) => (
                    <motion.tr key={holiday.id} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                      <td className="td font-medium text-[var(--text-primary)]">{holiday.name}</td>
                      <td className="td">{holiday.date}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button className="action-btn text-[var(--accent)]"><Edit size={14} /></button>
                          <button className="action-btn text-[var(--danger)]"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination total={holidays.length} filtered={holidays.length} />
          </div>
        )}

        {!isKnownTab && (
          <div className="flex flex-col items-center justify-center text-center opacity-60 h-full my-auto p-8 flex-1">
            <Settings size={48} className="text-[var(--text-muted)] mb-4" />
            <h3 className="text-xl font-bold text-[var(--text-primary)] syne">{activeTab}</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-md">Configuration options for {activeTab.toLowerCase()} will be displayed here.</p>
          </div>
        )}
      </div>

      {showTypeForm && <LeaveTypeForm onClose={() => setShowTypeForm(false)} onSave={(data: any) => { setLeaveTypes((prev) => [...prev, { ...data, id: Date.now() }]); setShowTypeForm(false); }} />}
      {showPeriodForm && <LeavePeriodForm onClose={() => setShowPeriodForm(false)} onSave={(data: any) => { setLeavePeriods((prev) => [...prev, { ...data, id: Date.now() }]); setShowPeriodForm(false); }} />}
      {showHolidayForm && <HolidayForm onClose={() => setShowHolidayForm(false)} onSave={(data: any) => { setHolidays((prev) => [...prev, { ...data, id: Date.now() }]); setShowHolidayForm(false); }} />}
    </div>
  );
}
