import React, { useState, useEffect, useRef } from 'react';
import {
  X, Phone, Mail, Shield, UploadCloud, Trash2, Edit, LogOut, Copy,
  Globe, Clock, ChevronDown, CheckCircle, XCircle, AlertTriangle,
  User, MapPin, Briefcase, Building, CreditCard, GraduationCap,
  Award, Brain, Heart, Users, FileText, IdCard, ChevronRight,
  Download, MoreHorizontal, Activity, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Employee {
  id?: number;
  number: string;
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  gender: string;
  supervisor: string;
  nationality?: string;
  maritalStatus?: string;
}

interface EmployeeDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

type TabId = 'Personal' | 'Employment' | 'Qualifications' | 'Relationships' | 'Documents' | 'Attendance' | 'Leave';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; value?: React.ReactNode; span2?: boolean }> = ({
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
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${accent}14` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
      </div>
      <h3 className="text-[11.5px] font-bold tracking-[0.07em] uppercase" style={{ color: accent }}>
        {title}
      </h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const StatusBadge: React.FC<{ status: 'active' | 'pending' | 'inactive' }> = ({ status }) => {
  const map = {
    active:   { label: 'Active',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    pending:  { label: 'Pending',  bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
    inactive: { label: 'Inactive', bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${map.bg} ${map.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${map.dot}`} />
      {map.label}
    </span>
  );
};

const CopyButton: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-0.5 rounded text-slate-300 hover:text-[#0066b3] transition-colors"
      title="Copy"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span key="check" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}>
            <CheckCircle className="w-3 h-3 text-emerald-500" />
          </motion.span>
        ) : (
          <motion.span key="copy" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}>
            <Copy className="w-3 h-3" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};

// Skeleton loader for empty states
const EmptyState: React.FC<{ icon: React.ElementType; label: string }> = ({ icon: Icon, label }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
      <Icon className="w-5 h-5 text-slate-300" />
    </div>
    <p className="text-sm text-slate-400 font-medium">{label}</p>
  </div>
);

// ─── Tab Content ──────────────────────────────────────────────────────────────

const PersonalTab: React.FC<{ employee: Employee }> = ({ employee }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <SectionCard title="Basic Information" icon={User} accent="#7c3aed">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Field label="Date of Birth" value="17 March 1984" />
        <Field label="Gender" value={employee.gender === 'M' ? 'Male' : employee.gender === 'F' ? 'Female' : 'Male'} />
        <Field label="Nationality" value={employee.nationality ?? 'Canadian'} />
        <Field label="Marital Status" value={employee.maritalStatus ?? 'Married'} />
        <Field label="Religion" value="Christianity" />
        <Field label="Blood Group" value="O+" />
      </div>
    </SectionCard>

    <SectionCard title="Contact Details" icon={MapPin} accent="#0066b3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Field label="Primary Phone" value={employee.phone} />
        <Field label="Work Email" value={`${employee.firstName.toLowerCase()}@company.com`} />
        <Field
          label="Current Address"
          value="123 Example Street, London, UK"
          span2
        />
      </div>
    </SectionCard>

    <div className="lg:col-span-2">
      <SectionCard title="Identification" icon={IdCard} accent="#b45309">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-5">
          <Field label="National ID / NIN" value="294-38-3535" />
          <Field label="Social Security" value="SSN-345-11" />
          <Field label="Personal Tax ID" value="TAX-998-GB" />
          <Field label="Driving Licence" value="DL-455-890" />
          <Field label="Health Insurance" value="Bupa Premium" />
        </div>
      </SectionCard>
    </div>
  </div>
);

const EmploymentTab: React.FC<{ employee: Employee }> = ({ employee }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <SectionCard title="Job Details" icon={Briefcase} accent="#059669">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Field label="Employee ID" value={employee.number} />
        <Field label="Job Role" value="Senior Developer" />
        <Field label="Department" value="Engineering" />
        <Field label="Supervisor" value={employee.supervisor || 'Unassigned'} />
        <Field label="Join Date" value="3 Aug 2005" />
        <Field label="Contract Type" value="Full-Time" />
      </div>
    </SectionCard>

    <SectionCard title="Financial & Banking" icon={CreditCard} accent="#0066b3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Field label="Bank Name" value="Barclays PLC" />
        <Field label="Branch" value="London Central" />
        <Field label="Account Number" value="**** **** 4567" />
        <Field label="Sort Code" value="20-45-78" />
        <Field label="Salary Cycle" value="Monthly" />
      </div>
    </SectionCard>
  </div>
);

const QualificationsTab: React.FC = () => (
  <div className="space-y-4">
    <SectionCard title="Education" icon={GraduationCap} accent="#7c3aed">
      <div className="flex items-start gap-4 p-4 rounded-xl bg-violet-50/60 border border-violet-100">
        <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <Building className="w-4.5 h-4.5 text-violet-600" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-slate-800">Master of Business Administration</p>
          <p className="text-[12.5px] text-slate-500 mt-0.5">University of Ghana</p>
          <p className="text-[11.5px] text-slate-400 mt-1 font-medium">Sep 2018 – May 2020</p>
        </div>
      </div>
    </SectionCard>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SectionCard title="Certifications" icon={Award} accent="#d97706">
        <div className="space-y-2">
          {[
            { name: 'Certified Scrum Master (CSM)', issuer: 'Scrum Alliance', date: 'Jan 2021' },
            { name: 'AWS Solutions Architect', issuer: 'Amazon Web Services', date: 'Mar 2022' },
          ].map((cert) => (
            <div key={cert.name} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
              <div>
                <p className="text-[13px] font-semibold text-slate-800">{cert.name}</p>
                <p className="text-[11.5px] text-slate-400 mt-0.5">{cert.issuer} · {cert.date}</p>
              </div>
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Skills" icon={Brain} accent="#e11d48">
        <div className="flex flex-wrap gap-2">
          {['Project Management', 'Agile', 'Strategic Planning', 'Leadership', 'Communication', 'TypeScript'].map((s) => (
            <span
              key={s}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium rounded-full"
            >
              {s}
            </span>
          ))}
        </div>
      </SectionCard>
    </div>
  </div>
);

const RelationshipsTab: React.FC = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <SectionCard title="Next of Kin / Emergency" icon={Heart} accent="#e11d48">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Field label="Full Name" value="Jane Thompson" />
        <Field label="Relationship" value="Spouse" />
        <Field label="Phone" value="+44 7911 123456" />
        <Field label="Address" value="Same as primary" />
      </div>
    </SectionCard>

    <SectionCard title="Dependents" icon={Users} accent="#0284c7">
      <div className="space-y-2">
        {[{ initials: 'JT', name: 'John Thompson Jr', detail: 'Son · Born 2012' }].map((dep) => (
          <div key={dep.name} className="flex items-center gap-3 p-3 rounded-xl bg-sky-50/60 border border-sky-100">
            <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
              {dep.initials}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">{dep.name}</p>
              <p className="text-[11.5px] text-slate-400 mt-0.5">{dep.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  </div>
);

const DocumentsTab: React.FC = () => {
  const docs = [
    { name: 'National ID Copy.pdf', date: 'Aug 12, 2023', size: '1.2 MB' },
    { name: 'Resume_Latest.pdf', date: 'Sep 01, 2023', size: '840 KB' },
    { name: 'Employment Contract.pdf', date: 'Aug 03, 2005', size: '2.1 MB' },
    { name: 'Insurance Certificate.pdf', date: 'Jan 10, 2024', size: '560 KB' },
  ];
  return (
    <SectionCard title="Documents & Attachments" icon={FileText} accent="#475569">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {docs.map((doc) => (
          <div
            key={doc.name}
            className="group flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-[#0066b3]/30 hover:bg-blue-50/40 transition-all cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-[#0066b3] transition-colors">
              <FileText className="w-4 h-4 text-[#0066b3] group-hover:text-white transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-slate-800 truncate">{doc.name}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{doc.date} · {doc.size}</p>
            </div>
            <Download className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#0066b3] transition-colors shrink-0" />
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmployeeDetailsSlideOver({ isOpen, onClose, employee }: EmployeeDetailsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('Personal');
  const [currentTime, setCurrentTime] = useState('');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = () => {
      setCurrentTime(
        new Date().toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!employee) return null;

  const fullName = `${employee.firstName} ${employee.lastName}`;
  const initials  = `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase();

  const tabs: Tab[] = [
    { id: 'Personal',        label: 'Personal',       icon: User      },
    { id: 'Employment',      label: 'Employment',     icon: Briefcase },
    { id: 'Qualifications',  label: 'Qualifications', icon: GraduationCap },
    { id: 'Relationships',   label: 'Relationships',  icon: Heart     },
    { id: 'Documents',       label: 'Documents',      icon: FileText  },
    { id: 'Attendance',      label: 'Attendance',     icon: Activity  },
    { id: 'Leave',           label: 'Leave',          icon: Calendar  },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'Personal':       return <PersonalTab employee={employee} />;
      case 'Employment':     return <EmploymentTab employee={employee} />;
      case 'Qualifications': return <QualificationsTab />;
      case 'Relationships':  return <RelationshipsTab />;
      case 'Documents':      return <DocumentsTab />;
      case 'Attendance':     return <EmptyState icon={Activity} label="Attendance data is not available yet" />;
      case 'Leave':          return <EmptyState icon={Calendar} label="Leave records are not available yet" />;
      default:               return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="w-full h-full bg-slate-50 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{ y: 12,    opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="max-w-[1100px] mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-4 relative"
          >
            {/* ── Close ──────────────────────────────────────────── */}
            <button
              onClick={onClose}
              className="absolute top-8 right-6 md:right-8 z-20 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* ── Profile Header ──────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {/* Top action bar */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-50">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="font-medium text-slate-500">Employees</span>
                  <ChevronRight className="w-3 h-3" />
                  <span>{fullName}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 transition-colors">
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#0066b3] bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors">
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </button>

                  {/* More actions dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setIsMoreMenuOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                      More
                    </button>

                    <AnimatePresence>
                      {isMoreMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 6 }}
                          animate={{ opacity: 1, scale: 1,    y: 0 }}
                          exit={{ opacity: 0,   scale: 0.95, y: 6 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 top-[calc(100%+6px)] w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-[100]"
                        >
                          {[
                            { icon: AlertTriangle, label: 'Suspend Employee',    color: 'text-amber-500' },
                            { icon: LogOut,        label: 'Initiate Resignation', color: 'text-rose-500'  },
                          ].map(({ icon: Icon, label, color }) => (
                            <button
                              key={label}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors text-left"
                            >
                              <Icon className={`w-4 h-4 ${color}`} />
                              {label}
                            </button>
                          ))}
                          <div className="my-1 border-t border-slate-100" />
                          {[
                            { icon: UploadCloud, label: 'Upload Photo',  color: 'text-[#0066b3]' },
                            { icon: Trash2,      label: 'Remove Photo',  color: 'text-rose-500'  },
                          ].map(({ icon: Icon, label, color }) => (
                            <button
                              key={label}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors text-left"
                            >
                              <Icon className={`w-4 h-4 ${color}`} />
                              {label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Profile body */}
              <div className="p-6 md:p-8 flex flex-col sm:flex-row items-start gap-6 md:gap-8">
                {/* Avatar */}
                <div className="shrink-0">
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden border border-slate-100 bg-slate-100 shadow-sm">
                    <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-500 text-3xl font-bold">{initials}</div>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-[20px] font-bold text-slate-900 tracking-tight">{fullName}</h2>
                    <StatusBadge status="active" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8">
                    {/* Phone */}
                    <div className="flex items-center gap-2 text-[13px] text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{employee.phone || '440-953-4578'}</span>
                      <CopyButton value={employee.phone || '440-953-4578'} />
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-2 text-[13px] text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{employee.firstName.toLowerCase()}@company.com</span>
                      <CopyButton value={`${employee.firstName.toLowerCase()}@company.com`} />
                    </div>

                    {/* Employee number */}
                    <div className="flex items-center gap-2 text-[13px] text-slate-600">
                      <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700">Emp No.</span>
                      <span>{employee.number}</span>
                      <CopyButton value={employee.number} />
                    </div>

                    {/* Access level */}
                    <div className="flex items-center gap-2 text-[13px] text-slate-600">
                      <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700">Access</span>
                      <span className="px-2 py-0.5 bg-violet-50 text-violet-700 text-[11px] font-semibold rounded-md border border-violet-100">Admin</span>
                    </div>

                    {/* Timezone + time */}
                    <div className="flex items-center gap-2 text-[13px] text-slate-600 sm:col-span-2">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700">Europe/London</span>
                      <span className="text-slate-300">·</span>
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <code className="text-[12px] font-mono bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                        {currentTime}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Tabs ────────────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-4 scrollbar-none">
                {tabs.map(({ id, label, icon: Icon }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`
                        relative flex items-center gap-2 px-4 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition-all
                        ${active
                          ? 'bg-white text-[#0066b3] shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-white/70'
                        }
                      `}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                      {active && (
                        <motion.span
                          layoutId="tab-indicator"
                          className="absolute inset-x-0 -bottom-[5px] h-0.5 bg-[#0066b3] rounded-full"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}