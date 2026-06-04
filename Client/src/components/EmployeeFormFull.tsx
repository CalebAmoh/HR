import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserPlus, X, UploadCloud, FileCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { getSettings } from '../../lib/settings';
import { Combobox } from './EmployeeTabs';

interface Props {
  onClose: () => void;
  onSave: (data: any, id?: string) => void;
  initialData?: any | null;
}

const STEPS = [
  { id: 'personal',   label: 'Personal'    },
  { id: 'employment', label: 'Employment'  },
  { id: 'nextofkin',  label: 'Next of Kin' },
  { id: 'financial',  label: 'Financial'   },
  { id: 'documents',  label: 'Documents'   },
];

const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];

const SectionHeader = ({ title }: { title: string }) => (
  <h3 className="syne font-extrabold text-[var(--accent)] uppercase tracking-wider mb-6 text-[12px]">{title}</h3>
);

function Field({ label, required, className, children }: {
  label: string; required?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`col-span-1 ${className ?? ''}`}>
      <label className="label">{label}{required && <span className="text-[var(--danger)]"> *</span>}</label>
      {children}
    </div>
  );
}

export function EmployeeFormFull({ onClose, onSave, initialData }: Props) {
  const isEdit = !!initialData;

  const [step, setStep] = useState(0);
  const autoGenEmpNum = getSettings().employees.autoGenerateNumber;

  const [form, setForm] = useState<any>(() => ({
    // Employment number (manual entry when auto-gen is off)
    employee_id:      '',
    // Personal
    titleId:          '',
    firstName:        '',
    middleName:       '',
    lastName:         '',
    genderId:         '',
    dateOfBirth:      '',
    place_of_birth:   '',
    nationalityId:    '',
    religionId:       '',
    marital_status:   '',
    spouse_name:      '',
    father_name:      '',
    mother_name:      '',
    address1:         '',
    city:             '',
    country:          '',
    // Contact
    work_email:       '',
    personal_email:   '',
    mobilePhone:      '',
    // Employment
    jobTitleId:         '',
    employmentStatusId: '',
    staff_level:        '',
    staff_role:         '',
    ssn_num:            '',
    departmentId:       '',
    branchId:           '',
    unitId:             '',
    outletId:           '',
    supervisorId:       '',
    hireDate:           '',
    confirmationDate:   '',
    // Next of Kin
    nxt_kin_fname:    '',
    nxt_kin_phone:    '',
    nxt_kin_email:    '',
    nxt_kin_address:  '',
    // Financial
    bankAccount:      '',
    paygradeId:       '',
    notcheId:         '',
    // Documents
    nationalIdNumber: '',
    nationalIdExpiry: '',
    passportNumber:   '',
    passportExpiry:   '',
    driverLicenseNum: '',
    driverLicenseExp: '',
    ...(initialData ? {
      titleId:          initialData.title?.id         ?? '',
      firstName:        initialData.firstName          ?? '',
      middleName:       initialData.middleName         ?? '',
      lastName:         initialData.lastName           ?? '',
      genderId:         initialData.gender?.id         ?? '',
      dateOfBirth:      initialData.dateOfBirth  ? initialData.dateOfBirth.slice(0, 10)  : '',
      place_of_birth:   initialData.place_of_birth     ?? '',
      nationalityId:    initialData.nationality?.id    ?? '',
      religionId:       initialData.religion?.id       ?? '',
      marital_status:   initialData.marital_status     ?? '',
      spouse_name:      initialData.spouse_name        ?? '',
      father_name:      initialData.father_name        ?? '',
      mother_name:      initialData.mother_name        ?? '',
      address1:         initialData.address1           ?? '',
      city:             initialData.city               ?? '',
      country:          initialData.country            ?? '',
      work_email:       initialData.work_email         ?? initialData.email ?? '',
      personal_email:   initialData.personal_email     ?? '',
      mobilePhone:      initialData.mobilePhone        ?? '',
      jobTitleId:         initialData.jobTitle?.id       ?? '',
      employmentStatusId: initialData.employmentStatus?.id ?? '',
      staff_level:        initialData.staff_level        ?? '',
      staff_role:         initialData.staff_role         ?? '',
      ssn_num:            initialData.ssn_num            ?? '',
      departmentId:       initialData.department?.id     ?? '',
      branchId:           initialData.branch?.id         ?? '',
      unitId:             initialData.unit?.id            ?? '',
      outletId:           initialData.outlet?.id          ?? '',
      supervisorId:       initialData.supervisor?.id      ?? '',
      hireDate:           initialData.hireDate       ? initialData.hireDate.slice(0, 10)       : '',
      confirmationDate:   initialData.confirmationDate ? initialData.confirmationDate.slice(0, 10) : '',
      nxt_kin_fname:    initialData.nxt_kin_fname    ?? '',
      nxt_kin_phone:    initialData.nxt_kin_phone    ?? '',
      nxt_kin_email:    initialData.nxt_kin_email    ?? '',
      nxt_kin_address:  initialData.nxt_kin_address  ?? '',
      bankAccount:      initialData.bankAccount      ?? '',
      paygradeId:       initialData.paygradeId?.toString()  ?? '',
      notcheId:         initialData.notcheId?.toString()    ?? '',
      nationalIdNumber: initialData.nationalIdNumber ?? '',
      nationalIdExpiry: initialData.nationalIdExpiry ? initialData.nationalIdExpiry.slice(0, 10) : '',
      passportNumber:   initialData.passportNumber   ?? '',
      passportExpiry:   initialData.passportExpiry   ? initialData.passportExpiry.slice(0, 10)   : '',
      driverLicenseNum: initialData.driverLicenseNum ?? '',
      driverLicenseExp: initialData.driverLicenseExp ? initialData.driverLicenseExp.slice(0, 10) : '',
    } : {}),
  }));

  // ── Document upload state ─────────────────────────────────────────────────
  const [docNames, setDocNames] = useState({
    fit_and_proper:   initialData?.fit_and_proper   ? 'Uploaded' : '',
    policeClearance:  initialData?.policeClearance  ? 'Uploaded' : '',
    medicalClearance: initialData?.medicalClearance ? 'Uploaded' : '',
  });
  const [docUploading, setDocUploading] = useState<Record<string, boolean>>({});

  const handleDocUpload = async (field: string, file: File | null) => {
    if (!file) {
      set(field, '');
      setDocNames(p => ({ ...p, [field]: '' }));
      return;
    }
    setDocUploading(p => ({ ...p, [field]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/employees/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const filename = res.data.data?.filename;
      set(field, filename);
      setDocNames(p => ({ ...p, [field]: file.name }));
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    } finally {
      setDocUploading(p => ({ ...p, [field]: false }));
    }
  };

  // ── Code lists & structure data ────────────────────────────────────────────
  const [cl, setCl] = useState({
    titles: [] as any[], genders: [] as any[], nationalities: [] as any[],
    religions: [] as any[], empStatuses: [] as any[], jobTitles: [] as any[],
    staffLevels: [] as any[], staffRoles: [] as any[], countries: [] as any[],
  });
  const [structures, setStructures]   = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [paygrades, setPaygrades]     = useState<any[]>([]);
  const [notches, setNotches]         = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/system/code-lists/TIT/values'),
      api.get('/system/code-lists/GEN/values'),
      api.get('/system/code-lists/NAT/values'),
      api.get('/system/code-lists/REG/values'),
      api.get('/system/code-lists/EMPS/values'),
      api.get('/system/code-lists/JOBT/values'),
      api.get('/system/code-lists/STAFL/values'),
      api.get('/system/code-lists/STAFR/values'),
      api.get('/company/structures'),
      api.get('/employees/active'),
      api.get('/employees/paygrades'),
      api.get('/employees/notches'),
      api.get('/system/code-lists/CT/values'),
    ]).then(([t, g, n, r, e, j, sl, sr, s, sup, pg, nc, ct]) => {
      setCl({
        titles:       t.data.data  ?? [],
        genders:      g.data.data  ?? [],
        nationalities: n.data.data ?? [],
        religions:    r.data.data  ?? [],
        empStatuses:  e.data.data  ?? [],
        jobTitles:    j.data.data  ?? [],
        staffLevels:  sl.data.data ?? [],
        staffRoles:   sr.data.data ?? [],
        countries:    ct.data.data ?? [],
      });
      setStructures(s.data.data    ?? []);
      setSupervisors(sup.data.data ?? []);
      setPaygrades(pg.data.data    ?? []);
      setNotches(nc.data.data      ?? []);
    }).catch(() => {});
  }, []);

  const departments = useMemo(() => structures.filter(s => s.typeLabel === 'Department'), [structures]);
  const branches    = useMemo(() => structures.filter(s => ['Branch', 'Head Office'].includes(s.typeLabel)), [structures]);
  const units       = useMemo(() => structures.filter(s => s.typeLabel === 'Unit'),   [structures]);
  const outlets     = useMemo(() => structures.filter(s => s.typeLabel === 'Outlet'), [structures]);

  const selectedPaygrade   = useMemo(() => paygrades.find(p => p.id === form.paygradeId), [paygrades, form.paygradeId]);
  const filteredNotches    = useMemo(() =>
    form.paygradeId && selectedPaygrade
      ? notches.filter(n => n.paygrade === selectedPaygrade.name)
      : [],
  [notches, form.paygradeId, selectedPaygrade]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const set = (name: string, value: string) => setForm((p: any) => ({ ...p, [name]: value }));
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    set(e.target.name, e.target.value);

  const clSelect = (name: string, options: any[], placeholder: string, required?: boolean, label?: string) => (
    <Field label={label ?? placeholder} required={required}>
      <select name={name} value={form[name]} onChange={handleChange}>
        <option value="">— {placeholder} —</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </Field>
  );

  const structSelect = (name: string, list: any[], placeholder: string, required?: boolean, label?: string) => (
    <Field label={label ?? placeholder} required={required}>
      <select name={name} value={form[name]} onChange={handleChange}>
        <option value="">— {placeholder} —</option>
        {list.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
    </Field>
  );

  // ── Per-step validation ────────────────────────────────────────────────────
  const validateStep = (s: number): string | null => {
    switch (s) {
      case 0:
        if (!form.firstName?.trim())    return 'First name is required';
        if (!form.lastName?.trim())     return 'Last name is required';
        if (!form.dateOfBirth)          return 'Date of birth is required';
        if (!form.marital_status)       return 'Marital status is required';
        if (!form.work_email?.trim())   return 'Work email is required';
        if (!form.mobilePhone?.trim())  return 'Mobile phone is required';
        if (!form.address1?.trim())     return 'Address is required';
        return null;
      case 1:
        if (!isEdit && !autoGenEmpNum && !form.employee_id?.trim())
          return 'Employee number is required when auto-generate is off';
        if (!form.employmentStatusId)   return 'Employment status is required';
        if (!form.jobTitleId)           return 'Job title is required';
        if (!form.staff_level)          return 'Staff level is required';
        if (!form.staff_role)           return 'Staff role is required';
        if (!form.supervisorId)         return 'Supervisor is required';
        if (!form.ssn_num?.trim())      return 'SSN is required';
        if (!form.hireDate)             return 'Hire date is required';
        if (!form.confirmationDate)     return 'Confirmation date is required';
        return null;
      case 2:
        if (!form.nxt_kin_fname?.trim())   return 'Next of kin full name is required';
        if (!form.nxt_kin_phone?.trim())   return 'Next of kin phone number is required';
        if (!form.nxt_kin_address?.trim()) return 'Next of kin address is required';
        return null;
      case 3:
        if (!form.bankAccount?.trim()) return 'Bank account number is required';
        if (!form.paygradeId)          return 'Pay grade is required';
        if (!form.notcheId)            return 'Salary notch is required';
        return null;
      case 4:
        if (form.nationalIdNumber && !form.nationalIdExpiry)
          return 'National ID expiry date is required when an ID number is provided';
        if (form.nationalIdExpiry && !form.nationalIdNumber)
          return 'National ID number is required when an expiry date is provided';
        if (form.passportNumber && !form.passportExpiry)
          return 'Passport expiry date is required when a passport number is provided';
        if (form.passportExpiry && !form.passportNumber)
          return 'Passport number is required when an expiry date is provided';
        if (form.driverLicenseNum && !form.driverLicenseExp)
          return "Driver's license expiry date is required when a license number is provided";
        if (form.driverLicenseExp && !form.driverLicenseNum)
          return "Driver's license number is required when an expiry date is provided";
        return null;
      default:
        return null;
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleFinish = () => {
    const err = validateStep(4);
    if (err) { toast.error(err); return; }

    const payload: any = { ...form };
    ['titleId', 'genderId', 'nationalityId', 'religionId', 'staff_level', 'staff_role',
     'departmentId', 'branchId', 'unitId', 'outletId', 'supervisorId'].forEach(k => {
      if (!payload[k]) payload[k] = null;
    });
    ['dateOfBirth', 'hireDate', 'confirmationDate',
     'nationalIdExpiry', 'passportExpiry', 'driverLicenseExp'].forEach(k => {
      if (!payload[k]) payload[k] = null;
    });

    onSave(payload, initialData?.id?.toString());
  };

  // ── Step navigation ────────────────────────────────────────────────────────
  const goNext = () => {
    const err = validateStep(step);
    if (err) { toast.error(err); return; }
    if (step === STEPS.length - 1) handleFinish();
    else setStep(s => s + 1);
  };
  const goPrev = () => setStep(s => Math.max(0, s - 1));

  // ── Step content ───────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-8">
          <div>
            <SectionHeader title="Personal Information" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {clSelect('titleId', cl.titles, 'Select Title', false, 'Title')}
              <Field label="First Name" required>
                <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="First name" />
              </Field>
              <Field label="Middle Name">
                <input name="middleName" value={form.middleName} onChange={handleChange} placeholder="Middle name (optional)" />
              </Field>
              <Field label="Last Name" required>
                <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Last name" />
              </Field>
              {clSelect('genderId', cl.genders, 'Select Gender', false, 'Gender')}
              <Field label="Date of Birth" required>
                <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={handleChange} />
              </Field>
              <Field label="Place of Birth">
                <input name="place_of_birth" value={form.place_of_birth} onChange={handleChange} placeholder="City or town of birth" />
              </Field>
              {clSelect('nationalityId', cl.nationalities, 'Select Nationality', false, 'Nationality')}
              {clSelect('religionId', cl.religions, 'Select Religion', false, 'Religion')}
              <Field label="Marital Status" required>
                <select name="marital_status" value={form.marital_status} onChange={handleChange}>
                  <option value="">— Select —</option>
                  {MARITAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              {form.marital_status === 'Married' && (
                <Field label="Spouse Name">
                  <input name="spouse_name" value={form.spouse_name} onChange={handleChange} placeholder="Spouse full name" />
                </Field>
              )}
              <Field label="Father's Name">
                <input name="father_name" value={form.father_name} onChange={handleChange} placeholder="Father's full name" />
              </Field>
              <Field label="Mother's Name">
                <input name="mother_name" value={form.mother_name} onChange={handleChange} placeholder="Mother's full name" />
              </Field>
            </div>
          </div>

          <div>
            <SectionHeader title="Contact & Address" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Work Email" required>
                <input type="email" name="work_email" value={form.work_email} onChange={handleChange} placeholder="Company email address" />
              </Field>
              <Field label="Personal Email">
                <input type="email" name="personal_email" value={form.personal_email} onChange={handleChange} placeholder="Personal email address" />
              </Field>
              <Field label="Mobile Phone" required>
                <input type="tel" name="mobilePhone" value={form.mobilePhone} onChange={handleChange} placeholder="Mobile number" />
              </Field>
              <Field label="Address" required className="md:col-span-2">
                <input name="address1" value={form.address1} onChange={handleChange} placeholder="Street address" />
              </Field>
              <Field label="City">
                <input name="city" value={form.city} onChange={handleChange} placeholder="City" />
              </Field>
              <Field label="Country">
                <select name="country" value={form.country} onChange={handleChange}>
                  <option value="">— Select Country —</option>
                  {cl.countries.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          </div>
        </div>
      );

      case 1: return (
        <div>
          <SectionHeader title="Employment Details" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            {/* Employee ID — always the first field */}
            {isEdit ? (
              <Field label="Employee ID">
                <input value={initialData?.employee_id ?? '—'} disabled />
              </Field>
            ) : autoGenEmpNum ? (
              <Field label="Employee ID">
                <input value="" disabled placeholder="Auto-generated on save" />
              </Field>
            ) : (
              <Field label="Employee ID" required>
                <input
                  name="employee_id"
                  value={form.employee_id}
                  onChange={handleChange}
                  placeholder="e.g. EMP-2026-0001"
                />
              </Field>
            )}
            {clSelect('employmentStatusId', cl.empStatuses, 'Select Status', true, 'Employment Status')}
            {clSelect('jobTitleId', cl.jobTitles, 'Select Job Title', true, 'Job Title')}
            {clSelect('staff_level', cl.staffLevels, 'Select Staff Level', true, 'Staff Level')}
            {clSelect('staff_role', cl.staffRoles, 'Select Staff Role', true, 'Staff Role')}
            {structSelect('branchId', branches, 'Select Branch', false, 'Branch')}
            {structSelect('departmentId', departments, 'Select Department', false, 'Department')}
            {structSelect('unitId', units, 'Select Unit', false, 'Unit')}
            {structSelect('outletId', outlets, 'Select Outlet', false, 'Outlet')}
            <Field label="Supervisor" required>
              <Combobox
                options={supervisors
                  .filter(s => !initialData || s.id !== initialData.id?.toString())
                  .map(s => ({ id: String(s.id), label: s.name + (s.employee_id ? ` (${s.employee_id})` : '') }))}
                value={form.supervisorId}
                onChange={id => set('supervisorId', id)}
                placeholder="Search supervisor..."
              />
            </Field>
            <Field label="SSN" required>
              <input name="ssn_num" value={form.ssn_num} onChange={handleChange} placeholder="Social security number" />
            </Field>
            <Field label="Hire Date" required>
              <input type="date" name="hireDate" value={form.hireDate} onChange={handleChange} />
            </Field>
            <Field label="Confirmation Date" required>
              <input type="date" name="confirmationDate" value={form.confirmationDate} onChange={handleChange} />
            </Field>
          </div>
        </div>
      );

      case 2: return (
        <div>
          <SectionHeader title="Next of Kin" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Field label="Full Name" required>
              <input name="nxt_kin_fname" value={form.nxt_kin_fname} onChange={handleChange} placeholder="Next of kin full name" />
            </Field>
            <Field label="Phone Number" required>
              <input type="tel" name="nxt_kin_phone" value={form.nxt_kin_phone} onChange={handleChange} placeholder="Phone number" />
            </Field>
            <Field label="Email Address">
              <input type="email" name="nxt_kin_email" value={form.nxt_kin_email} onChange={handleChange} placeholder="Email address" />
            </Field>
            <Field label="Address" required className="md:col-span-2">
              <input name="nxt_kin_address" value={form.nxt_kin_address} onChange={handleChange} placeholder="Residential address" />
            </Field>
          </div>
        </div>
      );

      case 3: return (
        <div>
          <SectionHeader title="Financial Information" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Field label="Bank Account Number" required className="md:col-span-2">
              <input name="bankAccount" value={form.bankAccount} onChange={handleChange} placeholder="Bank account number" />
            </Field>
            <Field label="Pay Grade" required>
              <Combobox
                options={paygrades.map(p => ({
                  id: String(p.id),
                  label: p.name + (p.currency ? ` (${p.currency})` : ''),
                }))}
                value={form.paygradeId}
                onChange={id => { set('paygradeId', id); set('notcheId', ''); }}
                placeholder="Search paygrade..."
              />
            </Field>
            <Field label="Salary Notch" required>
              <Combobox
                options={filteredNotches.map(n => ({
                  id: String(n.id),
                  label: n.name + (n.amount ? ` — ${n.currency ?? ''} ${Number(n.amount).toLocaleString()}` : ''),
                }))}
                value={form.notcheId}
                onChange={id => set('notcheId', id)}
                placeholder={form.paygradeId ? 'Search notch...' : 'Select a paygrade first...'}
              />
            </Field>
          </div>
        </div>
      );

      case 4: return (
        <div className="space-y-8">
          <div>
            <SectionHeader title="Identity Documents" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <Field label="National ID Number">
                <input name="nationalIdNumber" value={form.nationalIdNumber} onChange={handleChange} placeholder="NIN / National ID" />
              </Field>
              <Field label="National ID Expiry">
                <input type="date" name="nationalIdExpiry" value={form.nationalIdExpiry} onChange={handleChange} />
              </Field>
              <Field label="Passport Number">
                <input name="passportNumber" value={form.passportNumber} onChange={handleChange} placeholder="Passport number" />
              </Field>
              <Field label="Passport Expiry">
                <input type="date" name="passportExpiry" value={form.passportExpiry} onChange={handleChange} />
              </Field>
              <Field label="Driver's License Number">
                <input name="driverLicenseNum" value={form.driverLicenseNum} onChange={handleChange} placeholder="License number" />
              </Field>
              <Field label="Driver's License Expiry">
                <input type="date" name="driverLicenseExp" value={form.driverLicenseExp} onChange={handleChange} />
              </Field>
            </div>
          </div>

          <div>
            <SectionHeader title="Clearance Documents" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {(['fit_and_proper', 'policeClearance', 'medicalClearance'] as const).map(field => {
                const labels: Record<string, string> = {
                  fit_and_proper:   'Fit & Proper Form',
                  policeClearance:  'Police Clearance',
                  medicalClearance: 'Medical Clearance',
                };
                const fileName = docNames[field];
                return (
                  <div key={field} className="col-span-1">
                    <label className="label">{labels[field]}</label>
                    <label className={`flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                      docUploading[field]
                        ? 'border-[var(--border)] bg-[var(--surface-hover)] opacity-60 cursor-wait'
                        : fileName
                          ? 'border-[var(--accent)] bg-[var(--accent-dim)]'
                          : 'border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--accent)]'
                    }`}>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        disabled={!!docUploading[field]}
                        onChange={e => handleDocUpload(field, e.target.files?.[0] ?? null)}
                      />
                      {docUploading[field] ? (
                        <>
                          <UploadCloud size={15} className="text-[var(--accent)] shrink-0 animate-pulse" />
                          <span className="text-[13px] text-[var(--accent)]">Uploading…</span>
                        </>
                      ) : fileName ? (
                        <>
                          <FileCheck size={15} className="text-[var(--accent)] shrink-0" />
                          <span className="text-[13px] font-medium text-[var(--accent)] truncate flex-1">{fileName}</span>
                          <button
                            type="button"
                            onClick={e => { e.preventDefault(); handleDocUpload(field, null); }}
                            className="p-0.5 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <UploadCloud size={15} className="text-[var(--text-muted)] shrink-0" />
                          <span className="text-[13px] text-[var(--text-muted)]">Upload file (PDF / image)</span>
                        </>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      );

      default: return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] shadow-2xl w-full max-w-[800px] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-8 py-5 border-b border-[var(--border)] bg-[var(--surface-hover)] shrink-0 rounded-t-[16px]">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
              <UserPlus className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] syne">
                {isEdit ? 'Edit Employee' : 'Add New Employee'}
              </h2>
              <p className="text-[13px] text-[var(--text-muted)] mt-0.5 font-medium">
                {isEdit ? 'Update personnel record' : 'New employee will be created as pending approval'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-dim)] rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-[var(--border)] overflow-x-auto">
          {STEPS.map((s, i) => {
            const active    = i === step;
            const completed = i < step;
            return (
              <div key={s.id} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
                <button
                  onClick={() => i <= step && setStep(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors shrink-0 ${
                    active    ? 'bg-[var(--accent)] text-white' :
                    completed ? 'text-[var(--accent)] bg-[var(--accent-dim)] hover:bg-[var(--accent)] hover:text-white' :
                                'text-[var(--text-muted)]'
                  }`}
                >
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-extrabold shrink-0 ${
                    active    ? 'bg-white/20' :
                    completed ? 'opacity-70' :
                                'bg-[var(--surface-hover)] border border-[var(--border)]'
                  }`}>{i + 1}</span>
                  <span className="hidden sm:inline whitespace-nowrap">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`h-[2px] mx-2 flex-1 min-w-[12px] ${completed ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-[var(--border)] flex items-center justify-between shrink-0 bg-[var(--surface-hover)] rounded-b-[16px]">
          <button onClick={onClose} className="secondary-btn">Cancel</button>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button onClick={goPrev} className="secondary-btn">Back</button>
            )}
            <button
              onClick={goNext}
              disabled={Object.values(docUploading).some(Boolean)}
              className="primary-btn disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {Object.values(docUploading).some(Boolean)
                ? 'Uploading…'
                : step < STEPS.length - 1 ? 'Next' : (isEdit ? 'Save Changes' : 'Create Employee')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
