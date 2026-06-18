const { prisma } = require('../helpers/dbQueryHelper');
const asyncHandler = require('../middleware/asyncHandler');
const respond = require('../helpers/respondHelper');
const { sendDisciplinaryEmail } = require('../helpers/emailHelper');
const { logActivity, fromReq } = require('./auditController');

const INCIDENT_TYPES = [
  'Verbal Warning', 'Written Warning', 'Final Warning',
  'Counselling', 'Suspension', 'Gross Misconduct',
  'Performance Issue', 'Policy Violation', 'Dismissal',
];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES   = ['Open', 'Under Review', 'Resolved', 'Appealed'];

const { toBigInt, s } = require('../helpers/controllerHelpers');

async function query(sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return s(rows);
}

async function exec(sql, ...params) {
  return prisma.$executeRawUnsafe(sql, ...params);
}

async function enrichWithEmployee(rows) {
  if (!rows.length) return rows;
  const ids = [...new Set(rows.map(r => String(r.employee)).filter(Boolean))];
  const emps = ids.length
    ? await query(
        `SELECT id, firstName, lastName, employee_id, work_email, email
         FROM employee WHERE id IN (${ids.map(() => '?').join(',')})`,
        ...ids.map(toBigInt)
      )
    : [];
  const em = Object.fromEntries(emps.map(e => [String(e.id), e]));
  return rows.map(r => {
    const emp = em[String(r.employee)] ?? null;
    return {
      ...r,
      employee: emp
        ? { id: String(emp.id), name: `${emp.firstName} ${emp.lastName}`.trim(), employee_id: emp.employee_id }
        : { id: String(r.employee), name: null, employee_id: null },
      _emp_email: emp ? (emp.work_email || emp.email || null) : null,
    };
  });
}

// GET /disciplinary/meta
const getDisciplinaryMeta = asyncHandler(async (_req, res) => {
  respond.ok(res, 'Disciplinary meta', { incidentTypes: INCIDENT_TYPES, severities: SEVERITIES, statuses: STATUSES });
});

// GET /disciplinary
const getAllDisciplinary = asyncHandler(async (req, res) => {
  const { employee_id, incident_type, severity, status, date_from, date_to, search, page = '1', limit = '25' } = req.query;

  const conditions = ['1=1'];
  const params = [];

  if (employee_id)   { conditions.push('d.employee = ?');      params.push(toBigInt(employee_id)); }
  if (incident_type) { conditions.push('d.incident_type = ?'); params.push(incident_type); }
  if (severity)      { conditions.push('d.severity = ?');      params.push(severity); }
  if (status)        { conditions.push('d.status = ?');        params.push(status); }
  if (date_from)     { conditions.push('d.incident_date >= ?');params.push(date_from); }
  if (date_to)       { conditions.push('d.incident_date <= ?');params.push(date_to); }

  const where = conditions.join(' AND ');

  let rows = await query(
    `SELECT d.*, e.firstName, e.lastName, e.employee_id AS emp_code
     FROM employee_disciplinary d
     LEFT JOIN employee e ON e.id = d.employee
     WHERE ${where}
     ORDER BY d.incident_date DESC`,
    ...params
  );

  // Text search (post-fetch, needs enriched name)
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(r =>
      (`${r.firstName ?? ''} ${r.lastName ?? ''}`).toLowerCase().includes(q) ||
      (r.emp_code      ?? '').toLowerCase().includes(q) ||
      (r.incident_type ?? '').toLowerCase().includes(q) ||
      (r.description   ?? '').toLowerCase().includes(q)
    );
  }

  const pageNum  = Math.max(1, parseInt(page));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
  const total    = rows.length;
  const paged    = rows.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  const enriched = paged.map(r => ({
    ...r,
    employee: { id: String(r.employee), name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim(), employee_id: r.emp_code },
    firstName: undefined, lastName: undefined, emp_code: undefined,
  }));

  respond.ok(res, 'Disciplinary records retrieved', { records: enriched, total, page: pageNum, limit: pageSize });
});

// POST /disciplinary
const createDisciplinary = asyncHandler(async (req, res) => {
  const {
    employee_id, incident_date, incident_type, description,
    severity = 'Medium', action_taken, witnesses, status = 'Open',
    resolution, resolved_date,
  } = req.body;

  if (!employee_id)     return respond.badReq(res, 'Employee is required');
  if (!incident_date)   return respond.badReq(res, 'Incident date is required');
  if (!incident_type)   return respond.badReq(res, 'Incident type is required');
  if (!description?.trim()) return respond.badReq(res, 'Description is required');

  const empId = toBigInt(employee_id);
  const [emp] = await query(
    `SELECT id, firstName, lastName, work_email, email FROM employee WHERE id = ? LIMIT 1`, empId
  );
  if (!emp) return respond.notFound(res, 'Employee not found');

  const raisedBy   = req.user?.id ? BigInt(req.user.id) : null;
  const raisedName = req.user?.username || req.user?.name || null;
  const now        = new Date().toISOString().slice(0, 19).replace('T', ' ');

  await exec(
    `INSERT INTO employee_disciplinary
      (employee, incident_date, incident_type, description, severity, action_taken,
       witnesses, status, resolution, resolved_date, raised_by, raised_by_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    empId,
    incident_date,
    incident_type,
    description.trim(),
    severity,
    action_taken?.trim() || null,
    witnesses?.trim()    || null,
    status,
    resolution?.trim()   || null,
    resolved_date || null,
    raisedBy,
    raisedName,
    now, now
  );

  const [created] = await query(`SELECT * FROM employee_disciplinary ORDER BY id DESC LIMIT 1`);

  logActivity({
    module: 'Disciplinary', action: 'create',
    entityId: String(emp.id), entityName: `${emp.firstName} ${emp.lastName}`.trim(),
    details: { incident_type, severity, incident_date },
    ...fromReq(req),
  });

  sendDisciplinaryEmail({
    to:           emp.work_email || emp.email,
    name:         `${emp.firstName} ${emp.lastName}`.trim(),
    incidentType: incident_type,
    incidentDate: incident_date,
    description:  description.trim(),
    severity,
    actionTaken:  action_taken?.trim() || null,
  }).catch(e => console.error('[DisciplinaryEmail]', e.message));

  respond.created(res, 'Disciplinary record created', created);
});

// PUT /disciplinary/:id
const updateDisciplinary = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const [existing] = await query(`SELECT * FROM employee_disciplinary WHERE id = ? LIMIT 1`, id);
  if (!existing) return respond.notFound(res, 'Record not found');

  const {
    incident_date, incident_type, description, severity,
    action_taken, witnesses, status, resolution, resolved_date,
  } = req.body;

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  await exec(
    `UPDATE employee_disciplinary SET
      incident_date  = ?,
      incident_type  = ?,
      description    = ?,
      severity       = ?,
      action_taken   = ?,
      witnesses      = ?,
      status         = ?,
      resolution     = ?,
      resolved_date  = ?,
      updated_at     = ?
     WHERE id = ?`,
    incident_date  ?? existing.incident_date,
    incident_type  ?? existing.incident_type,
    description?.trim() || existing.description,
    severity       ?? existing.severity,
    action_taken != null ? (action_taken.trim() || null) : existing.action_taken,
    witnesses    != null ? (witnesses.trim()    || null) : existing.witnesses,
    status         ?? existing.status,
    resolution   != null ? (resolution.trim()   || null) : existing.resolution,
    resolved_date != null ? (resolved_date || null) : existing.resolved_date,
    now,
    id
  );

  const [updated] = await query(`SELECT * FROM employee_disciplinary WHERE id = ? LIMIT 1`, id);
  respond.ok(res, 'Disciplinary record updated', updated);
});

// DELETE /disciplinary/:id
const deleteDisciplinary = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  await exec(`DELETE FROM employee_disciplinary WHERE id = ?`, id);
  respond.ok(res, 'Disciplinary record deleted');
});

module.exports = { getDisciplinaryMeta, getAllDisciplinary, createDisciplinary, updateDisciplinary, deleteDisciplinary };
