import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Phone, Mail, Shield, UploadCloud, Trash2, Edit, LogOut, Copy,
  Globe, Clock, ChevronDown, CheckCircle, XCircle, AlertTriangle,
  User, MapPin, Briefcase, Building, CreditCard, GraduationCap,
  Award, Brain, Heart, Users, FileText, IdCard, ChevronRight,
  Eye, MoreHorizontal, Activity, Calendar, FileCheck, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { DocumentViewer } from './DocumentViewer';

interface EmployeeDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  onRefresh?: () => void;
}

type TabId = 'Personal' | 'Employment' | 'Qualifications' | 'Relationships' | 'Documents' | 'Attendance' | 'Leave';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: any) => v || null;
const fmtDate = (v: string | null | undefined) => {
  if (!v) return null;
  try { return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return v; }
};

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

// ─── Subcomponents ────────────────────────────────────────────────────────────

const InfoField: React.FC<{ label: string; value?: React.ReactNode; span2?: boolean }> = ({
  label, value, span2 = false,
}) => (
  <div className={span2 ? 'sm:col-span-2' : ''}>
    <p className="text-[10.5px] font-semibold tracking-[0.08em] uppercase text-slate-400 mb-1">{label}</p>
    <p className="text-[13.5px] font-medium text-slate-800 leading-snug">
      {value ?? <span className="text-slate-300 font-normal italic">—</span>}
    </p>
  </div>
);

const SectionCard: React.FC<{
  title: string;
  icon: React.ElementType;
  accent?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon: Icon, accent = '#0066b3', children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 overflow-hidden ${className}`}>
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}14` }}>
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
      </div>
      <h3 className="text-[11.5px] font-bold tracking-[0.07em] uppercase" style={{ color: accent }}>{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const CopyButton: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
      className="p-0.5 rounded text-slate-300 hover:text-[#0066b3] transition-colors"
      title="Copy"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied
          ? <motion.span key="c" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}><CheckCircle className="w-3 h-3 text-emerald-500" /></motion.span>
          : <motion.span key="d" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}><Copy className="w-3 h-3" /></motion.span>
        }
      </AnimatePresence>
    </button>
  );
};

const LifecycleBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    ACTIVE:     { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    PENDING:    { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
    SUSPENDED:  { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500'  },
    TERMINATED: { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500'    },
    RESIGNED:   { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
  };
  const s = map[status] ?? map['PENDING'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
};

const EmptyState: React.FC<{ icon: React.ElementType; label: string }> = ({ icon: Icon, label }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
      <Icon className="w-5 h-5 text-slate-300" />
    </div>
    <p className="text-sm text-slate-400 font-medium">{label}</p>
  </div>
);

// ─── Clearance document row ───────────────────────────────────────────────────

const ClearanceDoc: React.FC<{
  label: string;
  value: string | null;
  onView: (document: any) => void;
}> = ({ label, value, onView }) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${value ? 'bg-emerald-50' : 'bg-slate-50'}`}>
        {value ? <FileCheck className="w-4 h-4 text-emerald-500" /> : <FileText className="w-4 h-4 text-slate-300" />}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
        <p className={`text-[11px] mt-0.5 ${value ? 'text-emerald-600' : 'text-slate-400 italic'}`}>
          {value ? 'Document on file' : 'Not uploaded'}
        </p>
      </div>
    </div>
    {value && (
      <button
        type="button"
        onClick={() => onView({
          name: label,
          documentType: label,
          attachmentName: value,
          sourceUrl: `/documents/${encodeURIComponent(value)}`,
        })}
        className="p-1.5 rounded-lg text-slate-400 hover:text-[#0066b3] hover:bg-blue-50 transition-colors"
        title="View document"
      >
        <Eye className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

// ─── Tab content components ───────────────────────────────────────────────────

const PersonalTab: React.FC<{ employee: any }> = ({ employee }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <SectionCard title="Basic Information" icon={User} accent="#7c3aed">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <InfoField label="Date of Birth"   value={fmtDate(employee.dateOfBirth)} />
        <InfoField label="Place of Birth"  value={fmt(employee.place_of_birth)} />
        <InfoField label="Gender"          value={employee.gender?.label} />
        <InfoField label="Nationality"     value={employee.nationality?.label} />
        <InfoField label="Religion"        value={employee.religion?.label} />
        <InfoField label="Marital Status"  value={fmt(employee.marital_status)} />
        {employee.marital_status === 'Married' && (
          <InfoField label="Spouse" value={fmt(employee.spouse_name)} />
        )}
        <InfoField label="Father's Name"  value={fmt(employee.father_name)} />
        <InfoField label="Mother's Name"  value={fmt(employee.mother_name)} />
      </div>
    </SectionCard>

    <SectionCard title="Contact Details" icon={MapPin} accent="#0066b3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <InfoField label="Mobile"          value={fmt(employee.mobilePhone)} />
        <InfoField label="Work Email"      value={fmt(employee.work_email ?? employee.email)} />
        <InfoField label="Personal Email"  value={fmt(employee.personal_email)} />
        <InfoField label="Address"         value={[employee.address1, employee.city, employee.country].filter(Boolean).join(', ') || null} span2 />
      </div>
    </SectionCard>

    <div className="lg:col-span-2">
      <SectionCard title="Identification" icon={IdCard} accent="#b45309">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
          <InfoField label="National ID"       value={fmt(employee.nationalIdNumber)} />
          <InfoField label="NIN Expiry"        value={fmtDate(employee.nationalIdExpiry)} />
          <InfoField label="Passport"          value={fmt(employee.passportNumber)} />
          <InfoField label="Passport Expiry"   value={fmtDate(employee.passportExpiry)} />
          <InfoField label="Driver's License"  value={fmt(employee.driverLicenseNum)} />
          <InfoField label="License Expiry"    value={fmtDate(employee.driverLicenseExp)} />
          <InfoField label="SSN / Staff ID"    value={fmt(employee.ssn_num)} />
        </div>
      </SectionCard>
    </div>
  </div>
);

const EmploymentTab: React.FC<{ employee: any }> = ({ employee }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <SectionCard title="Job Details" icon={Briefcase} accent="#059669">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <InfoField label="Employee ID"        value={fmt(employee.employee_id)} />
        <InfoField label="Job Title"          value={employee.jobTitle?.label} />
        <InfoField label="Employment Status"  value={employee.employmentStatus?.label} />
        <InfoField label="Staff Level"        value={fmt(employee.staff_level)} />
        <InfoField label="Staff Role"         value={fmt(employee.staff_role)} />
        <InfoField label="Department"         value={employee.department?.title} />
        <InfoField label="Branch"             value={employee.branch?.title} />
        <InfoField label="Unit"               value={employee.unit?.title} />
        <InfoField label="Outlet"             value={employee.outlet?.title} />
        <InfoField label="Supervisor"         value={employee.supervisor?.name} />
        <InfoField label="Hire Date"          value={fmtDate(employee.hireDate)} />
        <InfoField label="Confirmation Date"  value={fmtDate(employee.confirmationDate)} />
      </div>
    </SectionCard>

    <SectionCard title="Financial" icon={CreditCard} accent="#0066b3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <InfoField label="Bank Account"  value={fmt(employee.bankAccount)} span2 />
      </div>
      <p className="text-[11px] text-slate-400 mt-4 italic">Pay grade and salary notch managed separately.</p>
    </SectionCard>
  </div>
);

function profLabel(key: string | null | undefined) {
  if (!key) return '—';
  return key.replace(/_/g, ' ');
}

function fmtDateLocal(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

function MiniTable({ cols, rows, empty }: { cols: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-[12px] text-slate-400 italic py-2">{empty}</p>;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[12px]">
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} className="text-left px-1 pb-2 text-[10.5px] font-bold tracking-wider uppercase text-slate-400 border-b border-slate-100 whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-slate-50 last:border-0">
              {cells.map((cell, j) => (
                <td key={j} className="px-1 py-2 text-slate-700 align-top">{cell ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RelationshipsTab: React.FC<{ employee: any }> = ({ employee }) => {
  const empId = String(employee.id);
  const [dependents,   setDependents]   = useState<any[]>([]);
  const [contacts,     setContacts]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([
        import('../../lib/api').then(m => m.default.get('/dependents')),
        import('../../lib/api').then(m => m.default.get('/emergency-contacts')),
      ]);
      setDependents((dRes.data.data ?? []).filter((r: any) => r.employee?.id === empId));
      setContacts((cRes.data.data ?? []).filter((r: any) => r.employee?.id === empId));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [empId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <SectionCard title="Next of Kin" icon={Heart} accent="#e11d48">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <InfoField label="Full Name" value={fmt(employee.nxt_kin_fname)} span2 />
          <InfoField label="Phone"     value={fmt(employee.nxt_kin_phone)} />
          <InfoField label="Email"     value={fmt(employee.nxt_kin_email)} />
          <InfoField label="Address"   value={fmt(employee.nxt_kin_address)} span2 />
        </div>
      </SectionCard>

      <SectionCard title="Dependents" icon={Users} accent="#0284c7">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
        ) : (
          <MiniTable
            cols={['Name', 'Relationship', 'Gender', 'Date of Birth', 'Place of Birth']}
            rows={dependents.map(r => [r.name, r.relationship, r.gender, fmtDateLocal(r.dob), r.place_of_birth])}
            empty="No dependents on record"
          />
        )}
      </SectionCard>

      <SectionCard title="Emergency Contacts" icon={Phone} accent="#dc2626">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
        ) : (
          <MiniTable
            cols={['Name', 'Relationship', 'Home Phone', 'Work Phone', 'Mobile']}
            rows={contacts.map(r => [r.name, r.relationshipLabel ?? r.relationship, r.home_phone, r.work_phone, r.mobile_phone])}
            empty="No emergency contacts on record"
          />
        )}
      </SectionCard>
    </div>
  );
};

const QualificationsTab: React.FC<{ employee: any }> = ({ employee }) => {
  const empId = String(employee.id);
  const [skills,   setSkills]   = useState<any[]>([]);
  const [certs,    setCerts]    = useState<any[]>([]);
  const [edus,     setEdus]     = useState<any[]>([]);
  const [langs,    setLangs]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const apiMod = await import('../../lib/api');
      const api = apiMod.default;
      const [sRes, cRes, eRes, lRes] = await Promise.all([
        api.get('/skills'),
        api.get('/certifications'),
        api.get('/education'),
        api.get('/languages'),
      ]);
      setSkills((sRes.data.data ?? []).filter((r: any) => r.employee?.id === empId));
      setCerts((cRes.data.data ?? []).filter((r: any) => r.employee?.id === empId));
      setEdus((eRes.data.data ?? []).filter((r: any) => r.employee?.id === empId));
      setLangs((lRes.data.data ?? []).filter((r: any) => r.employee?.id === empId));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [empId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  );

  return (
    <div className="space-y-4">
      <SectionCard title="Skills" icon={Award} accent="#7c3aed">
        <MiniTable
          cols={['Skill', 'Details']}
          rows={skills.map(r => [r.skill?.label, r.details])}
          empty="No skills on record"
        />
      </SectionCard>

      <SectionCard title="Certifications" icon={GraduationCap} accent="#0066b3">
        <MiniTable
          cols={['Certification', 'Institute', 'Granted', 'Valid Thru']}
          rows={certs.map(r => [r.certification?.label, r.institute, fmtDateLocal(r.date_start), fmtDateLocal(r.date_end)])}
          empty="No certifications on record"
        />
      </SectionCard>

      <SectionCard title="Education" icon={Brain} accent="#059669">
        <MiniTable
          cols={['Institution Type', 'Institute / School', 'Start', 'Completed']}
          rows={edus.map(r => [r.institutionType?.label, r.institute, fmtDateLocal(r.date_start), fmtDateLocal(r.date_end)])}
          empty="No education records"
        />
      </SectionCard>

      <SectionCard title="Languages" icon={Globe} accent="#b45309">
        <MiniTable
          cols={['Language', 'Reading', 'Speaking', 'Writing', 'Understanding']}
          rows={langs.map(r => [r.language?.label, profLabel(r.reading), profLabel(r.speaking), profLabel(r.writing), profLabel(r.understanding)])}
          empty="No language records"
        />
      </SectionCard>
    </div>
  );
};

const DocumentsTab: React.FC<{ employee: any; onViewDocument: (document: any) => void }> = ({ employee, onViewDocument }) => (
  <div className="space-y-4">
    <SectionCard title="Clearance Documents" icon={FileText} accent="#475569">
      <div>
        <ClearanceDoc label="Fit & Proper Form"   value={employee.fit_and_proper}  onView={onViewDocument} />
        <ClearanceDoc label="Police Clearance"    value={employee.policeClearance} onView={onViewDocument} />
        <ClearanceDoc label="Medical Clearance"   value={employee.medicalClearance} onView={onViewDocument} />
      </div>
    </SectionCard>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmployeeDetailsSlideOver({ isOpen, onClose, employee, onRefresh }: EmployeeDetailsProps) {
  const [activeTab, setActiveTab]     = useState<TabId>('Personal');
  const [currentTime, setCurrentTime] = useState('');
  const [isMoreOpen, setIsMoreOpen]   = useState(false);
  const [approving, setApproving]     = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [localPhoto, setLocalPhoto]   = useState<string | null>(employee?.profile_imagebase64 || null);
  const [documentToView, setDocumentToView] = useState<any | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalPhoto(employee?.profile_imagebase64 || null);
  }, [employee?.id]);

  useEffect(() => {
    const tick = () => setCurrentTime(
      new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!employee) return null;

  const fullName = `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim();
  const initials = `${(employee.firstName?.[0] ?? '').toUpperCase()}${(employee.lastName?.[0] ?? '').toUpperCase()}`;
  const isPending = employee.approvalStatus === 'PENDING';

  // ── Photo upload ────────────────────────────────────────────────────────────
  const resizeImage = (file: File, maxPx = 800, quality = 0.85): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width >= height) { height = Math.round((height / width) * maxPx); width = maxPx; }
          else                 { width  = Math.round((width / height) * maxPx); height = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = url;
    });

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    setPhotoUploading(true);
    try {
      const base64 = await resizeImage(file);
      await api.put(`/employees/${employee.id}`, { profile_imagebase64: base64 });
      setLocalPhoto(base64);
      toast.success('Photo updated');
      onRefresh?.();
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  };

  const handlePhotoRemove = async () => {
    setPhotoUploading(true);
    try {
      await api.put(`/employees/${employee.id}`, { profile_imagebase64: null });
      setLocalPhoto(null);
      toast.success('Photo removed');
      onRefresh?.();
    } catch {
      toast.error('Failed to remove photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  // ── Approve ─────────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    setApproving(true);
    try {
      await api.put(`/employees/${employee.id}/approve`);
      toast.success(`${fullName} approved`);
      onRefresh?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  const tabs = [
    { id: 'Personal'       as TabId, label: 'Personal',       icon: User          },
    { id: 'Employment'     as TabId, label: 'Employment',     icon: Briefcase     },
    { id: 'Relationships'  as TabId, label: 'Relationships',  icon: Heart         },
    { id: 'Documents'      as TabId, label: 'Documents',       icon: FileText      },
    { id: 'Qualifications' as TabId, label: 'Qualifications', icon: GraduationCap },
    { id: 'Attendance'     as TabId, label: 'Attendance',     icon: Activity      },
    { id: 'Leave'          as TabId, label: 'Leave',          icon: Calendar      },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'Personal':       return <PersonalTab       employee={employee} />;
      case 'Employment':     return <EmploymentTab     employee={employee} />;
      case 'Relationships':  return <RelationshipsTab  employee={employee} />;
      case 'Documents':      return <DocumentsTab      employee={employee} onViewDocument={setDocumentToView} />;
      case 'Qualifications': return <QualificationsTab employee={employee} />;
      case 'Attendance':     return <EmptyState icon={Activity}      label="Attendance data not available yet" />;
      case 'Leave':          return <EmptyState icon={Calendar}      label="Leave records not available yet" />;
      default:               return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          className="w-full h-full bg-slate-50 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="max-w-[1100px] mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-4 relative"
          >
            {/* Hidden file input for photo */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-8 right-6 md:right-8 z-20 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Profile header */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {/* Action bar */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-50">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="font-medium text-slate-500">Employees</span>
                  <ChevronRight className="w-3 h-3" />
                  <span>{fullName}</span>
                </div>

                <div className="flex items-center gap-2">
                  {isPending && (
                    <button
                      onClick={handleApprove}
                      disabled={approving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-colors disabled:opacity-60"
                    >
                      {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                  )}

                  {/* More dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setIsMoreOpen(v => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                      More
                    </button>

                    <AnimatePresence>
                      {isMoreOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 6 }} transition={{ duration: 0.12 }}
                          className="absolute right-0 top-[calc(100%+6px)] w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-[100]"
                        >
                          {[
                            { icon: AlertTriangle, label: 'Suspend Employee',     color: 'text-amber-500' },
                            { icon: LogOut,        label: 'Initiate Resignation', color: 'text-rose-500'  },
                          ].map(({ icon: Icon, label, color }) => (
                            <button key={label} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors text-left">
                              <Icon className={`w-4 h-4 ${color}`} /> {label}
                            </button>
                          ))}
                          <div className="my-1 border-t border-slate-100" />
                          <button
                            onClick={() => { setIsMoreOpen(false); fileInputRef.current?.click(); }}
                            disabled={photoUploading}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
                          >
                            {photoUploading ? <Loader2 className="w-4 h-4 text-[#0066b3] animate-spin" /> : <UploadCloud className="w-4 h-4 text-[#0066b3]" />}
                            Upload Photo
                          </button>
                          {localPhoto && (
                            <button
                              onClick={() => { setIsMoreOpen(false); handlePhotoRemove(); }}
                              disabled={photoUploading}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4 text-rose-500" /> Remove Photo
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Profile body */}
              <div className="p-6 md:p-8 flex flex-col sm:flex-row items-start gap-6 md:gap-8">
                {/* Avatar */}
                <div className="shrink-0 relative">
                  <div
                    className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden border border-slate-100 bg-slate-100 shadow-sm cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}
                    title="Click to upload photo"
                  >
                    {localPhoto ? (
                      <img src={localPhoto} alt={fullName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-500 text-3xl font-bold">
                        {initials || <User className="w-10 h-10" />}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {photoUploading
                        ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                        : <UploadCloud className="w-6 h-6 text-white" />
                      }
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-[20px] font-bold text-slate-900 tracking-tight">{fullName}</h2>
                    <LifecycleBadge status={employee.lifecycleStatus ?? 'PENDING'} />
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        Awaiting Approval
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8">
                    <div className="flex items-center gap-2 text-[13px] text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{employee.mobilePhone || '—'}</span>
                      {employee.mobilePhone && <CopyButton value={employee.mobilePhone} />}
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{employee.work_email ?? employee.email ?? '—'}</span>
                      {(employee.work_email ?? employee.email) && <CopyButton value={employee.work_email ?? employee.email} />}
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-slate-600">
                      <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700">Emp No.</span>
                      <span>{employee.employee_id ?? '—'}</span>
                      {employee.employee_id && <CopyButton value={employee.employee_id} />}
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-slate-600">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{employee.jobTitle?.label ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-slate-600 sm:col-span-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <code className="text-[12px] font-mono bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                        {currentTime}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-4 scrollbar-none">
                {tabs.map(({ id, label, icon: Icon }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition-all ${
                        active ? 'bg-white text-[#0066b3] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-white/70'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                      {active && (
                        <motion.span layoutId="tab-indicator" className="absolute inset-x-0 -bottom-[5px] h-0.5 bg-[#0066b3] rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
          <DocumentViewer document={documentToView} onClose={() => setDocumentToView(null)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
