import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Users, UserPlus, ClipboardList, CalendarCheck,
  Calendar, ChevronDown, Upload, Download,
  MoreHorizontal, Filter, TrendingUp, TrendingDown,
  Clock, ArrowUpRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
interface AttendanceRow {
  name: string;
  email: string;
  clockIn: string;
  clockOut: string;
  status: 'on-time' | 'late';
  initials: string;
}

interface Employee {
  name: string;
  email: string;
  position: string;
  level: string;
  status: 'permanent' | 'contract' | 'probation';
  initials: string;
}

interface GrowthDataPoint {
  month: string;
  employees: number;
  newHires: number;
}

interface ServiceDataPoint {
  label: string;
  value: number;
}

interface EmpStatus {
  label: string;
  count: number;
  pct: number;
  color: string;
}

/* ─────────────────────────────────────────────
   STATIC DATA
───────────────────────────────────────────── */
const ATTENDANCE: AttendanceRow[] = [
  { name: 'Raib Moon',     email: 'raibmoon@gmail.com', clockIn: '09:00 AM', clockOut: '17:00 PM', status: 'on-time', initials: 'RM' },
  { name: 'Lail Turner',   email: 'lailturn@gmail.com', clockIn: '09:00 AM', clockOut: '17:15 PM', status: 'on-time', initials: 'LT' },
  { name: 'Tamus Jhonson', email: 'tamusjh@gmail.com',  clockIn: '10:30 AM', clockOut: '18:30 PM', status: 'late',    initials: 'TJ' },
  { name: 'Bahtera Soke',  email: 'csok@gmail.com',     clockIn: '10:00 AM', clockOut: '18:00 PM', status: 'late',    initials: 'BS' },
  { name: 'Priya Mensah',  email: 'pmensah@gmail.com',  clockIn: '08:55 AM', clockOut: '17:00 PM', status: 'on-time', initials: 'PM' },
];

const GROWTH_DATA: GrowthDataPoint[] = [
  { month: 'Jul', employees: 130, newHires: 40 },
  { month: 'Aug', employees: 145, newHires: 50 },
  { month: 'Sep', employees: 155, newHires: 55 },
];

const SERVICE_DATA: ServiceDataPoint[] = [
  { label: '< 1yr',  value: 13 },
  { label: '1–2yr',  value: 20 },
  { label: '2–3yr',  value: 26 },
  { label: '3–5yr',  value: 25 },
  { label: '5–10yr', value: 20 },
  { label: '10yr+',  value: 12 },
];

const EMPLOYEES: Employee[] = [
  { name: 'Tamus Jhonson', email: 'tamusjh@gmail.com',  position: 'UI/UX Consultant',    level: 'Analyst',    status: 'permanent', initials: 'TJ' },
  { name: 'Raib Moon',     email: 'raibmoon@gmail.com', position: 'Software Engineer',   level: 'Consultant', status: 'contract',  initials: 'RM' },
  { name: 'Sophia Muller', email: 'sophia@gmail.com',   position: 'Strategy Consultant', level: 'Manager',    status: 'permanent', initials: 'SM' },
  { name: 'Lail Turner',   email: 'lailturn@gmail.com', position: 'Data Analyst',        level: 'Analyst',    status: 'probation', initials: 'LT' },
  { name: 'Priya Mensah',  email: 'pmensah@gmail.com',  position: 'HR Specialist',       level: 'Senior',     status: 'permanent', initials: 'PM' },
  { name: 'Kwame Asante',  email: 'kasante@gmail.com',  position: 'Finance Officer',     level: 'Consultant', status: 'contract',  initials: 'KA' },
];

const AVATAR_COLORS = [
  { bg: 'rgba(99,102,241,0.14)',  color: '#6366f1' },
  { bg: 'rgba(16,185,129,0.14)',  color: '#10b981' },
  { bg: 'rgba(245,158,11,0.14)',  color: '#f59e0b' },
  { bg: 'rgba(239,68,68,0.14)',   color: '#ef4444' },
  { bg: 'rgba(14,165,233,0.14)',  color: '#0ea5e9' },
  { bg: 'rgba(168,85,247,0.14)',  color: '#a855f7' },
];

const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

/* ─────────────────────────────────────────────
   CUSTOM TOOLTIP
───────────────────────────────────────────── */
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '12px',
      color: 'var(--text-primary)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, display: 'inline-block' }} />
          <span style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────── */
interface StatCardProps {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  iconColor: string;
  iconBg: string;
  delay: number;
}

function StatCard({ icon: Icon, label, value, delta, deltaPositive, iconColor, iconBg, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="stat-card"
      style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '18px 20px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '10px',
          background: iconBg, color: iconColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} strokeWidth={1.8} />
        </div>
        <MoreHorizontal size={16} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
      </div>

      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>
          {label}
        </div>
        <div className="syne" style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
          {value}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {deltaPositive
          ? <TrendingUp size={13} style={{ color: 'var(--success)' }} />
          : <TrendingDown size={13} style={{ color: 'var(--danger)' }} />
        }
        <span style={{ fontSize: '12px', fontWeight: 600, color: deltaPositive ? 'var(--success)' : 'var(--danger)' }}>
          {delta}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>vs last month</span>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   AVATAR
───────────────────────────────────────────── */
interface AvatarProps {
  initials: string;
  size?: number;
}

function Avatar({ initials, size = 34 }: AvatarProps) {
  const c = avatarColor(initials);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: c.bg, color: c.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size < 32 ? '11px' : '12px', fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

/* ─────────────────────────────────────────────
   STATUS PILL
───────────────────────────────────────────── */
type StatusType = AttendanceRow['status'] | Employee['status'];

interface StatusPillProps {
  status: StatusType;
}

function StatusPill({ status }: StatusPillProps) {
  const map: Record<StatusType, { cls: string; label: string }> = {
    'on-time':   { cls: 'pill pill-success', label: 'On time' },
    'late':      { cls: 'pill pill-danger',  label: 'Late' },
    'permanent': { cls: 'pill pill-success', label: 'Permanent' },
    'contract':  { cls: 'pill pill-warning', label: 'Contract' },
    'probation': { cls: 'pill pill-danger',  label: 'Probation' },
  };
  const { cls, label } = map[status];
  return <span className={cls}>{label}</span>;
}

/* ─────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────── */
export function Dashboard() {
  const [attendanceView, setAttendanceView] = useState<'Day' | 'Week' | 'Months'>('Day');
  const [, setSortField] = useState<string | null>(null);

  const empStatus: EmpStatus[] = [
    { label: 'Permanent', count: 150, pct: 75, color: 'var(--accent)' },
    { label: 'Contract',  count: 34,  pct: 25, color: 'var(--warning)' },
    { label: 'Probation', count: 16,  pct: 10, color: 'var(--danger)' },
  ];

  return (
    <div style={{ flex: 1, width: '100%' }}>
      <div style={{ maxWidth: 1340, margin: '0 auto', padding: '28px 24px 40px' }}>

        {/* PAGE HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', gap: 16,
            flexWrap: 'wrap', marginBottom: 28,
          }}
        >
          <div>
            <h1 className="syne" style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-.02em' }}>
              Dashboard
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 500 }}>
              Welcome to the SISL HR portal. Have a productive day.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="secondary-btn" style={{ gap: 7 }}>
              <Calendar size={14} />
              01 Sept – 29 Sept 2025
              <ChevronDown size={13} />
            </button>
            <button className="secondary-btn"><Upload size={14} /> Import</button>
            <button className="primary-btn"><Download size={14} /> Export</button>
          </div>
        </motion.div>

        {/* STAT STRIP */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14, marginBottom: 22,
        }}>
          <StatCard delay={0.05} icon={Users}         label="Total Employees" value="200" delta="+16 vs last year"   deltaPositive iconColor="var(--accent)"  iconBg="var(--accent-dim)" />
          <StatCard delay={0.10} icon={UserPlus}      label="New Hires"       value="152" delta="-50% vs last month" deltaPositive={false} iconColor="var(--danger)"  iconBg="rgba(239,68,68,0.10)" />
          <StatCard delay={0.15} icon={ClipboardList} label="Applicants"      value="16"  delta="+90 vs last month"  deltaPositive iconColor="var(--success)" iconBg="rgba(16,185,129,0.10)" />
          <StatCard delay={0.20} icon={CalendarCheck} label="Active Today"    value="138" delta="+4 vs yesterday"    deltaPositive iconColor="var(--warning)" iconBg="rgba(245,158,11,0.10)" />
        </div>

        {/* MAIN GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14, alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ATTENDANCE LOG */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', borderBottom: '1px solid var(--border)', gap: 12, flexWrap: 'wrap',
              }}>
                <h3 className="syne" style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Attendance Log
                </h3>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['Day', 'Week', 'Months'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setAttendanceView(v)}
                      style={{
                        height: 30, padding: '0 12px', borderRadius: 100,
                        border: attendanceView === v ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: attendanceView === v ? 'var(--accent-dim)' : 'transparent',
                        color: attendanceView === v ? 'var(--accent)' : 'var(--text-muted)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all .15s ease',
                      }}
                    >{v}</button>
                  ))}
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Employee', 'Clock In', 'Clock Out', 'Status'].map((h, i) => (
                        <th key={h} className="th" style={{ textAlign: i === 0 ? 'left' : i === 3 ? 'center' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ATTENDANCE.map((row, i) => (
                      <motion.tr
                        key={row.name} className="tr"
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.05 }}
                      >
                        <td className="td">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar initials={row.initials} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="td">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.clockIn}</span>
                          </div>
                        </td>
                        <td className="td">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.clockOut}</span>
                          </div>
                        </td>
                        <td className="td" style={{ textAlign: 'center' }}>
                          <StatusPill status={row.status} />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* EMPLOYEE LIST */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', borderBottom: '1px solid var(--border)', gap: 12,
              }}>
                <h3 className="syne" style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Employee List
                </h3>
                <button className="secondary-btn"><Filter size={13} /> Filter Table</button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Name', 'Email', 'Position', 'Level', 'Status', ''].map((h, i) => (
                        <th
                          key={i} className="th"
                          style={{ textAlign: i === 5 ? 'right' : 'left', cursor: i < 5 ? 'pointer' : 'default' }}
                          onClick={() => i < 5 && setSortField(h.toLowerCase())}
                        >
                          {h && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {h}
                              {i < 5 && <ArrowUpRight size={10} style={{ opacity: 0.4 }} />}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {EMPLOYEES.map((emp, i) => (
                      <motion.tr
                        key={emp.name} className="tr"
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.05 }}
                      >
                        <td className="td">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar initials={emp.initials} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</span>
                          </div>
                        </td>
                        <td className="td" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{emp.email}</td>
                        <td className="td" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{emp.position}</td>
                        <td className="td" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{emp.level}</td>
                        <td className="td"><StatusPill status={emp.status} /></td>
                        <td className="td" style={{ textAlign: 'right' }}>
                          <button className="action-btn" style={{ color: 'var(--text-muted)' }}>
                            <MoreHorizontal size={15} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                padding: '12px 20px', borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Showing <strong style={{ color: 'var(--text-secondary)' }}>1–6</strong> of <strong style={{ color: 'var(--text-secondary)' }}>200</strong> employees
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['←', '1', '2', '3', '→'] as const).map((p, i) => (
                    <button
                      key={p}
                      style={{
                        width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
                        background: i === 1 ? 'var(--accent-dim)' : 'transparent',
                        color: i === 1 ? 'var(--accent)' : 'var(--text-muted)',
                        borderColor: i === 1 ? 'var(--accent)' : 'var(--border)',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >{p}</button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* EMPLOYMENT STATUS */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 className="syne" style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Employment Status
                </h3>
                <MoreHorizontal size={16} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
              </div>

              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 14, marginBottom: 6, gap: 2 }}>
                {empStatus.map((s) => (
                  <div
                    key={s.label}
                    style={{ flex: s.count, background: s.color, borderRadius: 4, transition: 'flex .4s ease' }}
                    title={`${s.label}: ${s.count}`}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>0%</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>100%</span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {empStatus.map((s) => (
                  <div
                    key={s.label}
                    style={{
                      flex: 1, borderRadius: 12, padding: '12px 14px',
                      background: s.color === 'var(--accent)'
                        ? 'var(--accent-dim)'
                        : s.color === 'var(--warning)'
                          ? 'rgba(245,158,11,0.08)'
                          : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${
                        s.color === 'var(--accent)'
                          ? 'rgba(59,130,246,0.2)'
                          : s.color === 'var(--warning)'
                            ? 'rgba(245,158,11,0.2)'
                            : 'rgba(239,68,68,0.2)'
                      }`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        {s.label}
                      </span>
                    </div>
                    <div className="syne" style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                      {s.count}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.pct}%</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* EMPLOYEE GROWTH */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.33, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 className="syne" style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Employee Growth
                </h3>
                <MoreHorizontal size={16} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
              </div>

              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={GROWTH_DATA} barCategoryGap="28%" barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'inherit' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="employees" name="Employees" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="newHires"  name="New Hires"  fill="rgba(59,130,246,0.35)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Total (Sep)
                </div>
                {[
                  { label: 'Employees', value: 155, color: 'var(--accent)' },
                  { label: 'New Hires',  value: 55,  color: 'rgba(59,130,246,0.5)' },
                ].map((l) => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.label}</span>
                    </div>
                    <span className="syne" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{l.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* LENGTH OF SERVICE */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 className="syne" style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Length of Service
                </h3>
                <MoreHorizontal size={16} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
              </div>

              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={SERVICE_DATA} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'inherit' }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="value" name="Employees" radius={[4, 4, 0, 0]}>
                    {SERVICE_DATA.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === SERVICE_DATA.length - 1 ? 'var(--accent)' : 'rgba(59,130,246,0.25)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}