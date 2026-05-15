import React, { useState } from 'react';
import { UserPlus, X, UploadCloud, AlertCircle } from 'lucide-react';

interface EmployeeFormFullProps {
  onClose: () => void;
  onSave: (employee: any) => void;
  initialData?: any | null;
}

const STEPS = [
  { id: 'personal', label: 'Personal' },
  { id: 'employment', label: 'Employment' },
  { id: 'financial', label: 'Financial' },
  { id: 'documents', label: 'Documents' },
];

export function EmployeeFormFull({ onClose, onSave, initialData }: EmployeeFormFullProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<any>(initialData || {
    number: `E${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
    firstName: '', lastName: '', gender: '', nationality: '', religion: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onSave(formData);
      onClose();
    }
  };

  const FormField = ({ label, name, type = "text", required, options, disabled, colSpan = 1, rows, placeholder }: any) => (
    <div className={`col-span-1 border-0 ${colSpan === 2 ? 'md:col-span-2' : ''}`}>
      <label className="label">
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </label>
      {type === 'select' ? (
        <select 
          name={name} 
          required={required} 
          disabled={disabled}
          value={formData[name] || ''} 
          onChange={handleChange} 
        >
          {options?.map((opt: any, i: number) => (
            <option key={i} value={typeof opt === 'string' ? opt : opt.value}>
              {typeof opt === 'string' ? opt : opt.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea 
          name={name} 
          required={required} 
          disabled={disabled}
          rows={rows || 3}
          value={formData[name] || ''} 
          onChange={handleChange} 
          placeholder={placeholder}
          className="resize-none"
        />
      ) : (
        <input 
          type={type} 
          name={name} 
          required={required} 
          disabled={disabled}
          value={formData[name] || ''} 
          onChange={handleChange} 
          placeholder={placeholder}
        />
      )}
    </div>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <h3 className="syne font-extrabold text-[var(--accent)] uppercase tracking-wider mb-6 text-[12px]">{title}</h3>
  );

  const renderStepContent = () => {
    switch (currentStepIndex) {
      case 0: // Personal
        return (
          <div>
            <SectionHeader title="Personal Information" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              <FormField label="First name" name="firstName" required placeholder="First name" />
              <FormField label="Last name" name="lastName" required placeholder="Last name" />
              <FormField label="Middle name" name="middleName" placeholder="Middle name (optional)" />
              <FormField label="Date of birth" name="dob" type="date" placeholder="mm/dd/yyyy" />
              <FormField label="Gender" name="gender" type="select" options={[{label: 'Select gender', value: ''}, {label: 'Male', value: 'M'}, {label: 'Female', value: 'F'}, {label: 'Other', value: 'Other'}]} />
              <FormField label="Nationality" name="nationality" type="select" options={['Select nationality', 'Ghanaian', 'Nigerian', 'American', 'Afghan']} />
              <FormField label="Religion" name="religion" type="select" options={['Select religion', 'Christian', 'Muslim', 'Other']} />
              <FormField label="Phone" name="phone" type="tel" required placeholder="Phone number" />
              <FormField label="Email" name="email" type="email" required placeholder="Email address" />
              <FormField label="Address" name="address1" placeholder="Street address" />
            </div>
          </div>
        );
      case 1: // Employment
        return (
          <div>
             <SectionHeader title="Employment Details" />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                <FormField label="Employee Number" name="number" disabled />
                <FormField label="Employment Status" name="empStatus" type="select" required options={['Select...', 'Full Time Contract', 'Part Time', 'Probation']} />
                <FormField label="Job Title" name="jobTitle" required placeholder="Job title" />
                <FormField label="Department" name="department" type="select" options={['Select...', 'SME', 'HR', 'IT']} />
                <FormField label="Branch" name="branch" type="select" required options={['Select...', 'HEAD OFFICE', 'BRANCH A']} />
                <FormField label="Supervisor" name="supervisor" type="select" options={['Select...', 'UNION ADMIN']} />
                <FormField label="Recruitment Date" name="recruitDate" type="date" required />
                <FormField label="Start Date" name="startDate" type="date" required />
             </div>
          </div>
        );
      case 2: // Financial
        return (
          <div>
             <SectionHeader title="Financial Information" />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                <FormField label="Name of Bank" name="bankName" placeholder="Bank name" />
                <FormField label="Bank Account No." name="bankAccount" required placeholder="Account number" />
                <FormField label="Tax Identification Number (TIN)" name="tin" placeholder="TIN" />
                <FormField label="Social Security No." name="ssn" placeholder="SSN" />
                <FormField label="Pay Grade" name="payGrade" type="select" options={['Select...', 'Grade A', 'Grade B', 'Grade C']} />
                <FormField label="Notch" name="notch" type="select" options={['Select...', 'Notch 1', 'Notch 2', 'Notch 3']} />
             </div>
          </div>
        );
      case 3: // Documents
        return (
          <div>
             <SectionHeader title="Documents & Attachments" />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 mb-8">
                <FormField label="National ID (NIN)" name="nin" placeholder="National ID" />
                <FormField label="NIN Expiry Date" name="ninExpiry" type="date" />
             </div>
             <div className="space-y-4">
                {['Profile Image', 'Fit & Proper Attachment', 'Police Clearance Report'].map((label, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border border-[#ced4da] rounded-[4px] bg-white hover:border-[#004b7c]/40 transition-colors">
                    <span className="text-[13px] font-medium text-slate-800">{label}</span>
                    <label className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-[#ced4da] shadow-sm text-[12px] font-medium rounded-[4px] text-slate-700 bg-white hover:bg-slate-50 transition-colors">
                      <UploadCloud className="w-4 h-4 mr-2 text-slate-500" />
                      Browse File
                      <input type="file" className="sr-only" />
                    </label>
                  </div>
                ))}
              </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] shadow-2xl w-full max-w-[800px] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-start justify-between px-8 py-6 border-b border-[var(--border)] bg-[var(--surface-hover)] shrink-0 rounded-t-[16px]">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
               <UserPlus className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] syne">
                {initialData ? 'Edit employee' : 'Add new employee'}
              </h2>
              <p className="text-[13px] text-[var(--text-muted)] mt-0.5 font-medium">
                {initialData ? 'Update personnel records' : 'Add newly employed personnel to the system'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-dim)] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between shrink-0 border-b border-[var(--border)]">
          {STEPS.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div key={step.id} className={`flex items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}>
                <div 
                  className={`flex items-center gap-1 sm:gap-1.5 md:gap-2 px-2 py-1.5 rounded-full text-[9px] sm:text-[10px] md:text-[12px] font-bold transition-colors cursor-pointer shrink-0 ${
                    isActive 
                      ? 'bg-[var(--accent)] text-white' 
                      : isCompleted
                        ? 'text-[var(--accent)] bg-[var(--accent-dim)] hover:bg-[var(--accent)] hover:text-white'
                        : 'text-[var(--text-muted)]'
                  }`}
                  onClick={() => setCurrentStepIndex(index)}
                >
                  <span className={`w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 flex items-center justify-center rounded-full text-[9px] font-extrabold shrink-0 ${
                    isActive 
                      ? 'bg-white/20' 
                      : isCompleted
                        ? 'text-inherit opacity-70'
                        : 'bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-muted)]'
                  }`}>
                    {index + 1}
                  </span>
                  <span className="whitespace-nowrap mr-1">{step.label}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`h-[2px] mx-1 sm:mx-2 flex-1 min-w-[2px] ${isCompleted ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <form id="employee-stepper-form" onSubmit={handleSubmit}>
            {renderStepContent()}
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-[var(--border)] flex items-center justify-end gap-3 shrink-0 bg-[var(--surface-hover)] rounded-b-[16px]">
          <button 
            type="button"
            onClick={onClose}
            className="secondary-btn"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="employee-stepper-form"
            className="primary-btn"
          >
            {currentStepIndex < STEPS.length - 1 ? 'Next' : 'Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}
