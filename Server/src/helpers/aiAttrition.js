// aiAttrition — an explainable, offline attrition-risk scorecard. No training pipeline:
// each signal contributes weighted points (0–100 total) with a human-readable reason, so HR
// can see WHY an employee is flagged. Pure Node + SQL, ideal for a CPU-only host.
const { prisma } = require('./dbQueryHelper');

const ACTIVE = `lifecycleStatus = 'ACTIVE' AND approvalStatus = 'APPROVED'`;
const raw = (sql, ...p) => prisma.$queryRawUnsafe(sql, ...p).catch(() => []);
const daysAgo = n => {
  const d = new Date(Date.now() - n * 86400000); const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Build a Map keyed by employee id (string) for a grouped query.
function toMap(rows, key = 'employee') {
  const m = new Map();
  for (const r of rows) m.set(String(r[key]), r);
  return m;
}

async function computeAttrition() {
  const employees = await raw(`
    SELECT e.id, TRIM(CONCAT_WS(' ', e.firstName, e.lastName)) AS name, e.hireDate,
           e.confirmationDate, cs.title AS department, jt.label AS job_title
    FROM employee e
    LEFT JOIN companystructures cs ON cs.id = e.departmentId
    LEFT JOIN CodeListValue jt ON jt.id = e.jobTitleId
    WHERE ${ACTIVE}
  `);
  if (!employees.length) return [];

  const since90  = daysAgo(90);
  const since180 = daysAgo(180);

  const [att, leaves, perf, disc] = await Promise.all([
    raw(`SELECT employee,
            SUM(CASE WHEN day_status = 'Late' THEN 1 ELSE 0 END)   AS late,
            SUM(CASE WHEN day_status = 'Absent' THEN 1 ELSE 0 END) AS absent
         FROM attendance WHERE date >= ? GROUP BY employee`, since90),
    raw(`SELECT employee, COUNT(*) AS cnt FROM employeeleaves
         WHERE date_start >= ? AND status IN ('Approved','Pending','Processing') GROUP BY employee`, since180),
    raw(`SELECT pr.employee, pr.supervisor_score, pr.hr_score
         FROM performance_review pr
         INNER JOIN (SELECT employee, MAX(id) AS mid FROM performance_review GROUP BY employee) last
           ON last.employee = pr.employee AND last.mid = pr.id`),
    raw(`SELECT employee,
            SUM(CASE WHEN status <> 'Resolved' THEN 1 ELSE 0 END) AS open_cnt,
            SUM(CASE WHEN severity IN ('High','Critical') THEN 1 ELSE 0 END) AS severe_cnt
         FROM employee_disciplinary GROUP BY employee`),
  ]);

  const attMap  = toMap(att);
  const leaveMap = toMap(leaves);
  const perfMap = toMap(perf);
  const discMap = toMap(disc);
  const now = Date.now();

  const results = employees.map(e => {
    const id = String(e.id);
    const factors = [];
    let score = 0;
    const add = (pts, label) => { if (pts > 0) { score += pts; factors.push({ label, points: pts }); } };

    // 1) Tenure — newest hires and unconfirmed (probation) churn most.
    const tenureYrs = e.hireDate ? (now - new Date(e.hireDate).getTime()) / (365.25 * 86400000) : null;
    if (tenureYrs != null) {
      if (tenureYrs < 1) add(20, 'Short tenure (under 1 year)');
      else if (tenureYrs < 2) add(10, 'Early tenure (1–2 years)');
    }
    if (!e.confirmationDate) add(8, 'Not yet confirmed (probation)');

    // 2) Attendance — lateness & absence over the last 90 days.
    const a = attMap.get(id);
    const late = Number(a?.late ?? 0), absent = Number(a?.absent ?? 0);
    if (absent >= 3) add(Math.min(20, absent * 4), `Frequent absences (${absent} in 90 days)`);
    if (late >= 5) add(Math.min(12, Math.floor(late / 2)), `Frequent lateness (${late} in 90 days)`);

    // 3) Leave frequency — spikes can signal burnout/disengagement.
    const lc = Number(leaveMap.get(id)?.cnt ?? 0);
    if (lc >= 4) add(Math.min(15, (lc - 3) * 4), `High leave frequency (${lc} in 180 days)`);

    // 4) Performance — low latest score.
    const p = perfMap.get(id);
    const pScore = p ? Number(p.hr_score ?? p.supervisor_score ?? NaN) : NaN;
    if (!Number.isNaN(pScore)) {
      if (pScore <= 2) add(22, `Low performance score (${pScore})`);
      else if (pScore <= 2.8) add(12, `Below-average performance score (${pScore})`);
    }

    // 5) Disciplinary — open and severe cases.
    const d = discMap.get(id);
    const open = Number(d?.open_cnt ?? 0), severe = Number(d?.severe_cnt ?? 0);
    if (severe > 0) add(Math.min(20, severe * 12), `Severe disciplinary record (${severe})`);
    else if (open > 0) add(Math.min(12, open * 6), `Open disciplinary case(s) (${open})`);

    score = Math.min(100, Math.round(score));
    const band = score >= 60 ? 'High' : score >= 35 ? 'Medium' : 'Low';
    factors.sort((x, y) => y.points - x.points);

    return {
      employee_id: id, name: e.name, department: e.department || '—', job_title: e.job_title || '—',
      score, band, factors: factors.slice(0, 5),
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

// Persist a computed scorecard to the cache table.
async function persist(results) {
  await prisma.$executeRawUnsafe(`DELETE FROM ai_attrition_scores`).catch(() => {});
  for (const r of results) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO ai_attrition_scores (employee_id, score, band, factors) VALUES (?, ?, ?, ?)`,
      BigInt(r.employee_id), r.score, r.band, JSON.stringify(r.factors)
    ).catch(() => {});
  }
}

module.exports = { computeAttrition, persist };
