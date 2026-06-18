const { prisma }    = require('../helpers/dbQueryHelper');
const asyncHandler  = require('../middleware/asyncHandler');
const respond       = require('../helpers/respondHelper');
const { s }         = require('../helpers/controllerHelpers');

const pad = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ACTIVE = `lifecycleStatus = 'ACTIVE' AND approvalStatus = 'APPROVED'`;

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
