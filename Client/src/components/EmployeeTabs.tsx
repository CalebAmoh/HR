import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Search, FileEdit, Trash2, Eye, Filter, Download } from 'lucide-react';

// Reusable Modal Component
function ModalWrapper({ title, isOpen, onClose, children, onSave }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--surface)] w-full max-w-lg rounded-2xl shadow-xl z-10 flex flex-col max-h-[90vh] border border-[var(--border)]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[#f8fafc] rounded-t-2xl">
          <h3 className="text-[17px] font-bold text-slate-800 syne">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {children}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[#f8fafc] rounded-b-2xl flex items-center justify-end gap-3">
          <button onClick={onClose} className="secondary-btn">Cancel</button>
          <button onClick={() => { onSave(); onClose(); }} className="primary-btn">Save Record</button>
        </div>
      </motion.div>
    </div>
  );
}

function FieldLabel({ children }: any) {
  return <label className="block text-[13px] font-semibold text-slate-700 mb-1.5 syne">{children}</label>;
}

function SelectField({ label, options, className = "" }: any) {
  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <select className="w-full px-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all font-medium">
        <option value="">Select...</option>
        {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function InputField({ label, type = "text", className = "" }: any) {
  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <input type={type} className="w-full px-3 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all font-medium" />
    </div>
  );
}

export function RelationalTab({ activeTab, mockEmployees }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const employeeNames = mockEmployees.map((e: any) => `${e.firstName} ${e.lastName}`);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col min-h-[500px]">
      <div className="p-4 sm:p-5 border-b border-[var(--border)] flex flex-col sm:flex-row lg:items-center justify-between gap-4">
         <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setIsModalOpen(true)} className="primary-btn shrink-0">
               <Plus className="w-[14px] h-[14px]" /> Add {activeTab.endsWith('s') ? activeTab.slice(0, -1) : activeTab}
            </button>
            <button className="secondary-btn shrink-0">
               Filter <Filter className="w-[14px] h-[14px] opacity-80" />
            </button>
            <button className="secondary-btn shrink-0">
               Export <Download className="w-[14px] h-[14px]" />
            </button>
         </div>
         <div className="search-wrap w-full sm:w-auto sm:min-w-[240px]">
           <Search size={14} />
           <input type="text" placeholder={`Search ${activeTab.toLowerCase()}...`} />
         </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-3 p-10">
         <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
           <Search size={24} className="text-slate-300" />
         </div>
         <p className="text-sm font-medium">No records found for {activeTab}.</p>
         <button onClick={() => setIsModalOpen(true)} className="text-[var(--accent)] font-semibold text-sm hover:underline">
           Create the first record
         </button>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <ModalWrapper 
            title={`Add ${activeTab.slice(0, activeTab.endsWith('s') ? -1 : undefined)}`} 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)}
            onSave={() => console.log('saved')}
          >
            
            {activeTab === 'Skills' && (
              <>
                <SelectField label="Employee" options={employeeNames} className="md:col-span-2" />
                <SelectField label="Skill" options={['React', 'Node.js', 'Python', 'Leadership', 'Communication', 'Project Management']} className="md:col-span-2" />
                <div className="md:col-span-2">
                   <FieldLabel>Details</FieldLabel>
                   <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all font-medium" rows={3} placeholder="Enter skill details..."></textarea>
                </div>
              </>
            )}

            {activeTab === 'Education' && (
              <>
                <SelectField label="Employee" options={employeeNames} className="md:col-span-2" />
                <InputField label="Qualification" className="md:col-span-2" />
                <InputField label="Institute" className="md:col-span-2" />
                <InputField label="Start Date" type="date" />
                <InputField label="Completed On" type="date" />
              </>
            )}

            {activeTab === 'Certifications' && (
              <>
                <SelectField label="Employee" options={employeeNames} className="md:col-span-2" />
                <SelectField label="Certification" options={['AWS Solutions Architect', 'PMP', 'Certified Scrum Master', 'Google Cloud Engineer']} className="md:col-span-2" />
                <InputField label="Institute" className="md:col-span-2" />
                <InputField label="Granted On" type="date" />
                <InputField label="Valid Thru" type="date" />
              </>
            )}

            {activeTab === 'Languages' && (
              <>
                <SelectField label="Employee" options={employeeNames} className="md:col-span-2" />
                <SelectField label="Language" options={['English', 'Spanish', 'French', 'German', 'Mandarin']} className="md:col-span-2" />
                <SelectField label="Reading" options={['Basic', 'Intermediate', 'Advanced', 'Native']} />
                <SelectField label="Speaking" options={['Basic', 'Intermediate', 'Advanced', 'Native']} />
                <SelectField label="Writing" options={['Basic', 'Intermediate', 'Advanced', 'Native']} />
                <SelectField label="Understanding" options={['Basic', 'Intermediate', 'Advanced', 'Native']} />
              </>
            )}

            {activeTab === 'Dependents' && (
              <>
                <SelectField label="Employee" options={employeeNames} className="md:col-span-2" />
                <InputField label="Dependent Name" className="md:col-span-2" />
                <SelectField label="Gender" options={['Male', 'Female', 'Other']} />
                <SelectField label="Relationship" options={['Spouse', 'Child', 'Parent', 'Sibling']} />
                <InputField label="Date of Birth" type="date" />
                <InputField label="Place of Birth" />
                <div className="md:col-span-2">
                   <FieldLabel>Address</FieldLabel>
                   <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all font-medium" rows={2}></textarea>
                </div>
              </>
            )}

            {activeTab === 'Emergency Contacts' && (
              <>
                <SelectField label="Employee" options={employeeNames} className="md:col-span-2" />
                <InputField label="Name" className="md:col-span-2" />
                <InputField label="Relationship" className="md:col-span-2" />
                <InputField label="Home Phone" type="tel" />
                <InputField label="Work Phone" type="tel" />
              </>
            )}

          </ModalWrapper>
        )}
      </AnimatePresence>
    </div>
  );
}
