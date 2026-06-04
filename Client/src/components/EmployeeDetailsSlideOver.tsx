import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Phone, UploadCloud, Trash2, Edit, LogOut, Copy,
  Globe, CheckCircle, XCircle, AlertTriangle,
  User, MapPin, Briefcase, Building, CreditCard, GraduationCap,
  Award, Brain, Heart, Users, FileText, IdCard, ChevronRight,
  Eye, MoreHorizontal, Activity, Calendar, FileCheck, Loader2,
  Camera, Hash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { getCurrentUser } from '../../lib/auth';
import { getSettings } from '../../lib/settings';
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

const StatChipSlide: React.FC<{ icon: React.ElementType; label: string; value: string | null | undefined; accent?: string }> = ({
  icon: Icon, label, value, accent = '#0066b3',
}) => (
  <div className="flex items-center gap-2.5 px-4 py-3 bg-[var(--surface-hover)] rounded-xl border border-[var(--border)]">
    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}1a` }}>
      <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
    </div>
    <div className="min-w-0">
      <p className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate leading-tight mt-0.5">
        {value || <span className="text-[var(--text-muted)] font-normal italic">—</span>}
      </p>
    </div>
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
        <InfoField label="Staff Level"        value={employee.staffLevel?.label ?? fmt(employee.staff_level)} />
        <InfoField label="Staff Role"         value={employee.staffRole?.label ?? fmt(employee.staff_role)} />
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
        <InfoField label="Pay Grade"     value={fmt(employee.paygrade)} />
        <InfoField label="Salary Notch"  value={fmt(employee.notch)} />
      </div>
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

const statusPill = (status: string) => {
  const map: Record<string, string> = {
    'Approved':         'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200',
    'Pending HR Approval': 'bg-blue-50 text-blue-700 border-blue-200',
    'Rejected':         'bg-rose-50 text-rose-700 border-rose-200',
    'Cancelled':        'bg-slate-100 text-slate-500 border-slate-200',
    'Draft':            'bg-slate-50 text-slate-500 border-slate-200',
  };
  const cls = map[status] ?? 'bg-slate-50 text-slate-500 border-slate-200';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${cls}`}>{status}</span>;
};

const LeaveTab: React.FC<{ employee: any }> = ({ employee }) => {
  const [leaves,  setLeaves]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/leave/leaves/all?employee=${employee.id}`)
      .then(r => setLeaves(r.data.data ?? []))
      .catch(() => setLeaves([]))
      .finally(() => setLoading(false));
  }, [employee.id]);

  if (loading) return (
    <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  );

  return (
    <div className="space-y-4">
      <SectionCard title="Leave Records" icon={Calendar} accent="#7c3aed">
        {leaves.length === 0 ? (
          <EmptyState icon={Calendar} label="No leave records found" />
        ) : (
          <MiniTable
            cols={['Leave Type', 'Period', 'Start', 'End', 'Days', 'Status']}
            rows={leaves.map(l => [
              <span key="t" className="flex items-center gap-1.5">
                {l.leave_color && (
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block" style={{ background: l.leave_color }} />
                )}
                {l.leave_type_name ?? '—'}
              </span>,
              l.period_name ?? '—',
              fmtDateLocal(l.date_start),
              fmtDateLocal(l.date_end),
              l.day_count ?? '—',
              statusPill(l.status ?? 'Draft'),
            ])}
            empty="No leave records found"
          />
        )}
      </SectionCard>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmployeeDetailsSlideOver({ isOpen, onClose, employee, onRefresh }: EmployeeDetailsProps) {
  const [activeTab, setActiveTab]     = useState<TabId>('Personal');
  const [isMoreOpen, setIsMoreOpen]   = useState(false);
  const [approving, setApproving]         = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason]   = useState('');
  const [rejecting, setRejecting]         = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [localPhoto, setLocalPhoto]   = useState<string | null>(employee?.profile_imagebase64 || null);
  const [documentToView, setDocumentToView] = useState<any | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalPhoto(employee?.profile_imagebase64 || null);
  }, [employee?.id]);

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
  const isPending  = employee.approvalStatus === 'PENDING';
  const isRejected = employee.approvalStatus === 'REJECTED';

  // Self-approval guard
  const currentUser = getCurrentUser();
  const selfApprovalAllowed = getSettings().approvals.employeeSelfApproval;
  const isOwnRecord = String(currentUser?.id) === String(employee.posted_by);
  const canApprove  = selfApprovalAllowed || !isOwnRecord;

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

  // ── Approve / Reject ────────────────────────────────────────────────────────
  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await api.put(`/employees/${employee.id}/approve`);
      toast.success(`${fullName} approved successfully`);

      const sync = res.data?.syncResult;
      if (sync) {
        const body = sync.data != null ? JSON.stringify(sync.data, null, 2) : sync.message ?? '';
        if (sync.success) {
          toast.success(
            <div>
              <p className="font-semibold text-[13px] mb-1">External system synced</p>
              {body && <pre className="text-[11px] whitespace-pre-wrap opacity-80">{body}</pre>}
            </div>,
            { duration: 8000 }
          );
        } else {
          toast.error(
            <div>
              <p className="font-semibold text-[13px] mb-1">External sync failed {sync.httpStatus ? `(${sync.httpStatus})` : ''}</p>
              {body && <pre className="text-[11px] whitespace-pre-wrap opacity-80">{body}</pre>}
            </div>,
            { duration: 10000 }
          );
        }
      }

      onRefresh?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await api.put(`/employees/${employee.id}/reject`, { reason: rejectReason });
      toast.success(`${fullName}'s application rejected`);
      setShowRejectModal(false);
      setRejectReason('');
      onRefresh?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to reject');
    } finally {
      setRejecting(false);
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
      case 'Leave':          return <LeaveTab employee={employee} />;
      default:               return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          className="w-full h-full bg-[var(--bg)] overflow-y-auto"
        >
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-4">
            {/* Hidden file input for photo */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />

            {/* ── Top bar: breadcrumb + actions ── */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[12px] min-w-0">
                <span className="text-[var(--text-muted)] font-medium whitespace-nowrap">Employees</span>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                <span className="text-[var(--text-primary)] font-semibold truncate">{fullName}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isPending && canApprove && (
                  <>
                    <button
                      onClick={handleApprove}
                      disabled={approving || rejecting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[var(--success)] bg-[var(--success-dim)] hover:opacity-80 border border-[var(--success)]/20 transition-all disabled:opacity-50"
                    >
                      {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => { setRejectReason(''); setShowRejectModal(true); }}
                      disabled={approving || rejecting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[var(--danger)] bg-[var(--danger-dim)] hover:opacity-80 border border-[var(--danger)]/20 transition-all disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </>
                )}
                {isPending && !canApprove && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--warning)] bg-[var(--warning-dim)] border border-[var(--warning)]/20">
                    <AlertTriangle className="w-3 h-3" />
                    Self-approval not permitted
                  </span>
                )}

                {/* More dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsMoreOpen(v => !v)}
                    className="w-8 h-8 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <AnimatePresence>
                    {isMoreOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 6 }} transition={{ duration: 0.12 }}
                        className="absolute right-0 top-[calc(100%+6px)] w-52 bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--border)] py-1.5 z-[100]"
                      >
                        {[
                          { icon: AlertTriangle, label: 'Suspend Employee',     color: 'text-amber-500' },
                          { icon: LogOut,        label: 'Initiate Resignation', color: 'text-rose-500'  },
                        ].map(({ icon: Icon, label, color }) => (
                          <button key={label} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors text-left">
                            <Icon className={`w-4 h-4 ${color}`} /> {label}
                          </button>
                        ))}
                        <div className="my-1 border-t border-[var(--border)]" />
                        <button
                          onClick={() => { setIsMoreOpen(false); fileInputRef.current?.click(); }}
                          disabled={photoUploading}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors text-left disabled:opacity-50"
                        >
                          {photoUploading ? <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" /> : <UploadCloud className="w-4 h-4 text-[var(--accent)]" />}
                          Upload Photo
                        </button>
                        {localPhoto && (
                          <button
                            onClick={() => { setIsMoreOpen(false); handlePhotoRemove(); }}
                            disabled={photoUploading}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors text-left disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4 text-[var(--danger)]" /> Remove Photo
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Close */}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Hero card — matches PersonalInfo design ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
              className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              {/* Gradient banner */}
              <div className="relative h-28 sm:h-36"
                style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 50%, #0891b2 100%)' }}
              >
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: 'radial-gradient(circle at 25% 50%, white 1px, transparent 1px), radial-gradient(circle at 75% 50%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}
                />
                {/* Status badge — top right only */}
                {!isRejected && employee.lifecycleStatus && (
                  <div className="absolute top-4 right-4">
                    <LifecycleBadge status={employee.lifecycleStatus} />
                  </div>
                )}
                {isRejected && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-white border border-rose-400/40">
                      Application Rejected
                    </span>
                  </div>
                )}
              </div>

              {/* Profile content */}
              <div className="px-5 sm:px-7 pb-6">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-4 sm:-mt-6 mb-5">
                  {/* Avatar */}
                  <div className="relative shrink-0 group">
                    <div
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-[var(--surface)] overflow-hidden cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                      title="Click to upload photo"
                      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                    >
                      {localPhoto ? (
                        <img src={localPhoto} alt={fullName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl syne"
                          style={{ background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)' }}>
                          {initials || <User className="w-8 h-8" />}
                        </div>
                      )}
                      {photoUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-[var(--accent)] text-white border-2 border-[var(--surface)] flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                      title="Change photo"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Name + role */}
                  <div className="flex-1 min-w-0 pb-1">
                    <h1 className="text-[20px] sm:text-[24px] font-bold text-[var(--text-primary)] syne leading-tight truncate">{fullName}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {employee.jobTitle?.label && (
                        <span className="text-[13px] text-[var(--text-secondary)] font-medium">{employee.jobTitle.label}</span>
                      )}
                      {employee.jobTitle?.label && employee.employee_id && (
                        <span className="text-[var(--text-muted)]">·</span>
                      )}
                      {employee.employee_id && (
                        <span className="font-mono text-[12px] text-[var(--text-muted)] flex items-center gap-1">
                          <Hash className="w-3 h-3" />{employee.employee_id}
                          <CopyButton value={employee.employee_id} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status badges — after flex row, before stat chips */}
                {isPending && (
                  <div className="mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--warning-dim)] text-[var(--warning)] border border-[var(--warning)]/20">
                      Awaiting Approval
                    </span>
                  </div>
                )}

                {/* Rejection notice */}
                {isRejected && (
                  <div className="mb-4 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[var(--danger-dim)] border border-[var(--danger)]/20">
                    <XCircle className="w-3.5 h-3.5 text-[var(--danger)] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[12px] font-semibold text-[var(--danger)]">
                        {employee.actionReason ? `Reason: ${employee.actionReason}` : 'This application was rejected. Edit the record to re-submit for approval.'}
                      </p>
                      {employee.actionReason && (
                        <p className="text-[11px] text-[var(--danger)] opacity-75 mt-0.5">Edit the record to correct and re-submit for approval.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Quick stat chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <StatChipSlide icon={Building}  label="Department" value={employee.department?.title} accent="#0066b3" />
                  <StatChipSlide icon={Briefcase} label="Job Title"  value={employee.jobTitle?.label}   accent="#059669" />
                  <StatChipSlide icon={Calendar}  label="Hire Date"  value={fmtDate(employee.hireDate)} accent="#7c3aed" />
                  <StatChipSlide icon={Phone}     label="Mobile"     value={employee.mobilePhone}       accent="#b45309" />
                </div>
              </div>
            </motion.div>

            {/* ── Tab bar ── */}
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.06 }}
              className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-2 py-1.5 flex items-center gap-1 overflow-x-auto hide-scrollbar"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className="relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-medium whitespace-nowrap transition-all shrink-0"
                  style={{
                    background: activeTab === t.id ? 'var(--accent-dim)' : 'transparent',
                    color:      activeTab === t.id ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: activeTab === t.id ? 700 : 500,
                    boxShadow:  activeTab === t.id ? '0 0 0 1px rgba(37,99,235,0.2) inset' : 'none',
                  }}
                >
                  <t.icon className="w-3.5 h-3.5 shrink-0" />
                  {t.label}
                </button>
              ))}
            </motion.div>

            {/* ── Tab content ── */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
          <DocumentViewer document={documentToView} onClose={() => setDocumentToView(null)} />
        </motion.div>
      )}

      {/* Reject reason modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.15 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 z-10"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center mb-4">
                <XCircle className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-[15px] font-bold text-slate-900 mb-1">Reject Application?</h3>
              <p className="text-[13px] text-slate-500 mb-4">
                Reject the application for <span className="font-semibold text-slate-700">{fullName}</span>?
              </p>
              <div className="mb-5">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Reason <span className="font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection…"
                  className="w-full px-3 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition-all resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  disabled={rejecting}
                  className="px-4 py-2 text-[13px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejecting}
                  className="px-4 py-2 text-[13px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {rejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {rejecting ? 'Rejecting…' : 'Reject'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
