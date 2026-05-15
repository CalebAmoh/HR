import { useState } from 'react';
import { Search, Plus, Edit, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { MultiSelect } from './MultiSelect';
import { FormModal } from './ui/FormModal';
import { PageHeader } from './ui/PageHeader';
import { TabBar } from './ui/TabBar';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';

const SegmentedControl = ({ options, value, onChange }: { options: string[]; value: string; onChange: (val: string) => void }) => (
  <div className="flex items-center bg-[var(--surface-hover)] p-1 rounded-lg border border-[var(--border)]">
    {options.map((option) => (
      <button
        key={option}
        onClick={() => onChange(option)}
        className={`flex-1 py-1.5 px-3 text-[13px] font-semibold rounded-md transition-all ${
          value === option
            ? 'bg-[var(--surface)] text-[var(--accent)] shadow-sm border border-[var(--border)] ring-1 ring-[var(--accent)]/10'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
        }`}
      >
        {option}
      </button>
    ))}
  </div>
);

const TABS = ['Salary Component Types', 'Salary Components', 'Employee Salary Components', 'Notch Setup', 'Payment Type', 'Salary Increment/Decrement'];

export function Salary() {
  const [activeTab, setActiveTab] = useState('Salary Component Types');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [operationType, setOperationType] = useState('Increment');
  const [searchQuery, setSearchQuery] = useState('');

  const renderModalContent = () => {
    switch (activeTab) {
      case 'Salary Component Types':
        return (
          <>
            <div className="mb-4"><label className="label">Code</label><input type="text" placeholder="Enter Code" /></div>
            <div className="mb-4"><label className="label">Name</label><input type="text" placeholder="Enter Name" /></div>
          </>
        );
      case 'Salary Components':
        return (
          <>
            <div className="mb-4"><label className="label">Name</label><input type="text" placeholder="Enter Component Name" /></div>
            <div className="mb-4"><label className="label">Details</label><textarea rows={3} placeholder="Enter Component Details" /></div>
          </>
        );
      case 'Employee Salary Components':
        return (
          <>
            <div className="mb-4"><label className="label">Employee</label><MultiSelect options={['John Doe', 'Jane Smith', 'Michael Thompson', 'Sarah Williams', 'David Chen']} placeholder="Select employees" /></div>
            <div className="mb-4"><label className="label">Component</label><select><option value="">Select Component</option><option value="basic">Basic Salary</option><option value="allowance">Transport Allowance</option></select></div>
            <div className="mb-4"><label className="label">No. of working days</label><input type="number" placeholder="e.g. 20" /></div>
            <div className="mb-4"><label className="label">Amount</label><input type="number" placeholder="0.00" /></div>
          </>
        );
      case 'Notch Setup':
        return (
          <>
            <div className="mb-4"><label className="label">Notch Name</label><input type="text" placeholder="Enter Notch Name" /></div>
            <div className="mb-4"><label className="label">Paygrade</label><div className="search-wrap"><Search size={14} /><input type="text" placeholder="Search Paygrade..." /></div></div>
            <div className="mb-4"><label className="label">Currency</label><div className="search-wrap"><Search size={14} /><input type="text" placeholder="Search Currency..." /></div></div>
            <div className="mb-4"><label className="label">Amount</label><input type="number" placeholder="0.00" /></div>
          </>
        );
      case 'Payment Type':
        return (
          <>
            <div className="mb-4"><label className="label">Payment Type</label><input type="text" placeholder="Enter Payment Type" /></div>
            <div className="mb-4"><label className="label">Description</label><textarea rows={3} placeholder="Enter Description" /></div>
          </>
        );
      case 'Salary Increment/Decrement':
        return (
          <>
            <div className="mb-4"><label className="label">Notch</label><select><option value="">Select Notch</option><option value="1">Notch A</option><option value="2">Notch B</option></select></div>
            <div className="mb-4"><label className="label">Operation</label><SegmentedControl options={['Increment', 'Decrement']} value={operationType} onChange={setOperationType} /></div>
            <div className="mb-4">
              <label className="label">Change %</label>
              <div className="relative"><input type="number" placeholder="0.00" className="pl-3 pr-8" /><span className="absolute right-3 bottom-[10px] text-[var(--text-muted)] text-[13px]">%</span></div>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-6 w-full max-w-[1400px] mx-auto overflow-x-hidden flex flex-col h-full relative">
      <PageHeader title="Payroll Management" subtitle="Manage salary components, increments, and payment setups." />

      <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} className="flex flex-wrap gap-2 mt-2 mb-4" />

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col flex-1 max-h-min drop-shadow-sm">
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search..."
          actions={
            <button onClick={() => setIsModalOpen(true)} className="primary-btn shrink-0">
              <span className="hidden sm:inline">Add New</span>
              <span className="sm:hidden">Add</span>
              <Plus className="w-[14px] h-[14px]" />
            </button>
          }
        />

        <div className="overflow-x-auto flex-1">
          {activeTab === 'Salary Component Types' ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className="th">Code</th>
                  <th scope="col" className="th">Name</th>
                  <th scope="col" className="th text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {[{ code: 'B001', name: 'Payment' }, { code: 'B002', name: 'Deduction' }].map((row, i) => (
                  <motion.tr key={row.code} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                    <td className="td font-medium text-[var(--text-primary)]">{row.code}</td>
                    <td className="td">{row.name}</td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <button className="action-btn text-[var(--warning)]"><Edit size={14} /></button>
                        <button className="action-btn text-[var(--danger)]"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-500 text-sm">No data available for {activeTab}</div>
          )}
        </div>

        <TablePagination total={2} filtered={2} />
      </div>

      {isModalOpen && (
        <FormModal
          title={`Add New ${activeTab}`}
          onClose={() => setIsModalOpen(false)}
          onSave={() => setIsModalOpen(false)}
          maxWidth="md"
          scrollable={false}
        >
          {renderModalContent()}
        </FormModal>
      )}
    </div>
  );
}
