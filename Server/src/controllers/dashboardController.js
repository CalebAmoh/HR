const { prisma }    = require('../helpers/dbQueryHelper');
const asyncHandler  = require('../middleware/asyncHandler');
const respond       = require('../helpers/respondHelper');
const { s }         = require('../helpers/controllerHelpers');

const pad = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ACTIVE = `lifecycleStatus = 'ACTIVE' AND approvalStatus = 'APPROVED'`;

// "1 file" / "2 files" — pluralize a counted noun for module-card labels.
const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

const timeHM = v => {
  if (v == null) return null;
  const x = v instanceof Date ? v.toISOString().slice(11, 16) : String(v).slice(11, 16);
  return x || null;
};

// GET /dashboard/summary — everything the overview page needs in one round-trip
exports.getDashboardSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const today = dstr(now);
  const yesterday = dstr(new Date(now.getTime() - 86_400_000));
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthStart = `${lastMonthEnd.getFullYear()}-${pad(lastMonthEnd.getMonth() + 1)}-01`;

  const one = rows => Number(rows?.[0]?.cnt ?? 0);

  const [
    totalRows, hiresMonthRows, hiresLastMonthRows,
    applicantsRows, applicantsMonthRows, applicantsLastMonthRows,
    presentTodayRows, presentYesterdayRows,
    attendanceToday, statusDist, hiresByMonth, serviceRows, recentEmployees,
  ] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT COUNT(*) cnt FROM employee WHERE ${ACTIVE}`),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) cnt FROM employee WHERE ${ACTIVE} AND hireDate >= ?`, monthStart),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) cnt FROM employee WHERE ${ACTIVE} AND hireDate >= ? AND hireDate < ?`, lastMonthStart, monthStart),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) cnt FROM applications`),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) cnt FROM applications WHERE created >= ?`, monthStart),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) cnt FROM applications WHERE created >= ? AND created < ?`, lastMonthStart, monthStart),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) cnt FROM attendance WHERE date = ? AND day_status IN ('Present','Late','Half_Day','Incomplete')`, today),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) cnt FROM attendance WHERE date = ? AND day_status IN ('Present','Late','Half_Day','Incomplete')`, yesterday),
    prisma.$queryRawUnsafe(
      `SELECT a.in_time, a.out_time, a.day_status,
              TRIM(CONCAT_WS(' ', e.firstName, e.lastName)) AS name,
              COALESCE(NULLIF(e.work_email, ''), e.email) AS email
       FROM attendance a JOIN employee e ON e.id = a.employee
       WHERE a.date = ? AND a.in_time IS NOT NULL
       ORDER BY a.in_time DESC LIMIT 8`, today
    ),
    prisma.$queryRawUnsafe(
      `SELECT COALESCE(clv.label, 'Unspecified') AS label, COUNT(*) cnt
       FROM employee e LEFT JOIN CodeListValue clv ON clv.id = e.employmentStatusId
       WHERE ${ACTIVE} GROUP BY clv.label ORDER BY cnt DESC`
    ),
    prisma.$queryRawUnsafe(
      `SELECT DATE_FORMAT(hireDate, '%Y-%m') AS ym, COUNT(*) cnt
       FROM employee WHERE ${ACTIVE} AND hireDate IS NOT NULL
       GROUP BY ym ORDER BY ym ASC`
    ),
    prisma.$queryRawUnsafe(
      `SELECT TIMESTAMPDIFF(YEAR, hireDate, CURDATE()) AS yrs, COUNT(*) cnt
       FROM employee WHERE ${ACTIVE} AND hireDate IS NOT NULL GROUP BY yrs`
    ),
    prisma.$queryRawUnsafe(
      `SELECT e.id, TRIM(CONCAT_WS(' ', e.firstName, e.lastName)) AS name,
              COALESCE(NULLIF(e.work_email, ''), e.email) AS email,
              jt.label AS position, sl.label AS level, es.label AS emp_status
       FROM employee e
       LEFT JOIN CodeListValue jt ON jt.id = e.jobTitleId
       LEFT JOIN CodeListValue sl ON sl.id = e.staff_level
       LEFT JOIN CodeListValue es ON es.id = e.employmentStatusId
       WHERE ${ACTIVE} ORDER BY e.id DESC LIMIT 6`
    ),
  ].map(p => p.catch(() => [])));

  // Growth — last 6 months, cumulative headcount + hires per month
  const hiresMap = Object.fromEntries(hiresByMonth.map(r => [r.ym, Number(r.cnt)]));
  const monthKeys = Object.keys(hiresMap).sort();
  const growth = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const cumulative = monthKeys.filter(k => k <= ym).reduce((sum, k) => sum + hiresMap[k], 0);
    growth.push({
      month: d.toLocaleString('en-US', { month: 'short' }),
      employees: cumulative,
      new_hires: hiresMap[ym] ?? 0,
    });
  }

  // Length-of-service buckets
  const buckets = { '< 1yr': 0, '1–2yr': 0, '2–3yr': 0, '3–5yr': 0, '5–10yr': 0, '10yr+': 0 };
  for (const r of serviceRows) {
    const y = Number(r.yrs ?? 0);
    const cnt = Number(r.cnt);
    if (y < 1) buckets['< 1yr'] += cnt;
    else if (y < 2) buckets['1–2yr'] += cnt;
    else if (y < 3) buckets['2–3yr'] += cnt;
    else if (y < 5) buckets['3–5yr'] += cnt;
    else if (y < 10) buckets['5–10yr'] += cnt;
    else buckets['10yr+'] += cnt;
  }

  respond.ok(res, 'Dashboard summary', {
    date: today,
    stats: {
      total_employees:      one(totalRows),
      new_hires_month:      one(hiresMonthRows),
      new_hires_last_month: one(hiresLastMonthRows),
      applicants:           one(applicantsRows),
      applicants_month:     one(applicantsMonthRows),
      applicants_last_month:one(applicantsLastMonthRows),
      present_today:        one(presentTodayRows),
      present_yesterday:    one(presentYesterdayRows),
    },
    attendance_today: attendanceToday.map(r => ({
      name:       r.name,
      email:      r.email ?? null,
      in_time:    timeHM(r.in_time),
      out_time:   timeHM(r.out_time),
      day_status: r.day_status ?? 'Incomplete',
    })),
    employment_status: statusDist.map(r => ({ label: String(r.label), count: Number(r.cnt) })),
    growth,
    service: Object.entries(buckets).map(([label, value]) => ({ label, value })),
    recent_employees: recentEmployees.map(r => ({ ...s(r) })),
  });
});

// GET /dashboard/module-stats — the live stat shown on each module launcher card.
// For each module, returns an org-wide figure when the user can manage that module,
// otherwise a figure scoped to the user's own data (personal view). Modules the user
// cannot access at all are omitted. Mirrors the client's resolveTarget access rules.
exports.getModuleStats = asyncHandler(async (req, res) => {
  const perms = new Set(req.user?.permissions ?? []);
  const has   = (...keys) => keys.some(k => perms.has(k));
  const empId = req.user?.employeeId != null ? BigInt(req.user.employeeId) : null; // employee.id
  const empIdStr = empId != null ? String(empId) : null;

  const now   = new Date();
  const today = dstr(now);
  const monthStart = `${today.slice(0, 7)}-01`;

  const count = (sql, ...params) =>
    prisma.$queryRawUnsafe(sql, ...params).then(r => Number(r?.[0]?.cnt ?? 0)).catch(() => 0);

  const tasks = [];
  const push  = (p) => tasks.push(p);

  // ── Employees (management only) ──
  if (has('view_employees')) {
    push((async () => ['Employees',
      plural(await count(`SELECT COUNT(*) cnt FROM employee WHERE ${ACTIVE}`), 'employee')])());
  }

  // ── Leave ──
  if (has('view_leave_setup', 'manage_leave_types', 'manage_leave_periods', 'manage_holidays')) {
    push((async () => ['LeaveManagement',
      `${await count(`SELECT COUNT(*) cnt FROM employeeleaves WHERE status LIKE 'Pending%'`)} pending`])());
  } else if (empId != null) {
    push((async () => ['LeaveManagement',
      `${await count(`SELECT COUNT(*) cnt FROM employeeleaves WHERE employee = ? AND status LIKE 'Pending%'`, empId)} pending`])());
  }

  // ── Payroll (management only) — last run period ──
  if (has('view_payroll', 'process_payroll', 'approve_payroll', 'manage_payroll_employees',
          'view_salary_setup', 'manage_salary_component_types', 'manage_salary_components', 'manage_notch_setup')) {
    push((async () => {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT date_end, created_at FROM payrollruns ORDER BY COALESCE(date_end, created_at) DESC LIMIT 1`
      ).catch(() => []);
      const d = rows?.[0]?.date_end || rows?.[0]?.created_at;
      return ['Payroll', d ? `Last run: ${new Date(d).toLocaleString('en-US', { month: 'short', year: 'numeric' })}` : 'No runs yet'];
    })());
  }

  // ── Insights / Reports ──
  if (has('generate_reports')) {
    push((async () => ['Insights', plural(await count(`SELECT COUNT(*) cnt FROM reports`), 'report')])());
  } else {
    push((async () => ['Insights', plural(await count(`SELECT COUNT(*) cnt FROM userreports`), 'report')])());
  }

  // ── Company / Organisation Structure (management only) — count org nodes ──
  if (has('view_company_structure')) {
    push((async () => ['Company', plural(await count(`SELECT COUNT(*) cnt FROM companystructures`), 'structure')])());
  }

  // ── Recruitment (management only) ──
  if (has('view_recruitment')) {
    push((async () => ['Recruitment', plural(await count(`SELECT COUNT(*) cnt FROM applications`), 'applicant')])());
  }

  // ── Training ──
  if (has('view_training')) {
    push((async () => ['Training', plural(await count(`SELECT COUNT(*) cnt FROM trainingcatalog WHERE is_active = 1`), 'active course')])());
  } else if (empId != null) {
    push((async () => ['Training', plural(await count(`SELECT COUNT(*) cnt FROM trainingnomination WHERE employee = ?`, empId), 'training')])());
  }

  // ── Documents — actual files (company + employee documents), not definitions ──
  if (has('view_documents')) {
    push((async () => {
      const a = await count(`SELECT COUNT(*) cnt FROM companydocuments WHERE status = 'Active'`);
      const b = await count(`SELECT COUNT(*) cnt FROM employeedocuments`);
      return ['Documents', plural(a + b, 'file')];
    })());
  } else if (empId != null) {
    push((async () => ['Documents', plural(await count(`SELECT COUNT(*) cnt FROM employeedocuments WHERE employee = ?`, empId), 'file')])());
  }

  // ── System Administration (management only) ──
  if (has('manage_app_settings', 'view_app_settings')) {
    push((async () => ['Admin', plural(await count(`SELECT COUNT(*) cnt FROM users`), 'user')])());
  }

  // ── Medical ──
  if (has('view_medical')) {
    push((async () => {
      const a = await count(`SELECT COUNT(*) cnt FROM staffmedical WHERE status = 'Pending Approval'`);
      const b = await count(`SELECT COUNT(*) cnt FROM dependentmedical WHERE status = 'Pending Approval'`);
      return ['Medical', `${a + b} pending`];
    })());
  } else if (empIdStr != null) {
    push((async () => ['Medical',
      `${await count(`SELECT COUNT(*) cnt FROM staffmedical WHERE employee = ? AND status IN ('Pending Approval','Pending','Processing')`, empIdStr)} pending`])());
  }

  // ── Performance ──
  if (has('view_performance')) {
    push((async () => ['Performance',
      plural(await count(`SELECT COUNT(*) cnt FROM performance_review WHERE status NOT IN ('Completed','Closed')`), 'review')])());
  } else if (empId != null) {
    push((async () => ['Performance',
      plural(await count(`SELECT COUNT(*) cnt FROM performance_review WHERE employee = ? AND status NOT IN ('Completed','Closed')`, empId), 'review')])());
  }

  // ── Attendance ──
  if (has('view_attendance')) {
    push((async () => ['Attendance',
      `${await count(`SELECT COUNT(*) cnt FROM attendance WHERE date = ? AND day_status IN ('Present','Late','Half_Day','Incomplete')`, today)} present today`])());
  } else if (empId != null) {
    push((async () => {
      const n = await count(`SELECT COUNT(*) cnt FROM attendance WHERE employee = ? AND date >= ? AND day_status IN ('Present','Late','Half_Day','Incomplete')`, empId, monthStart);
      return ['Attendance', `${plural(n, 'day')} this month`];
    })());
  }

  const results = await Promise.all(tasks);
  const out = {};
  for (const [id, label] of results) if (id) out[id] = label;

  respond.ok(res, 'Module stats', out);
});
