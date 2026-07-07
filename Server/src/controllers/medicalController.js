const { prisma }    = require('../helpers/dbQueryHelper');
const asyncHandler  = require('../middleware/asyncHandler');
const respond       = require('../helpers/respondHelper');
const { tmsg }      = require('../helpers/messageStore');
const { postToGL } = require('../helpers/glHelper');
const { toBigInt, s } = require('../helpers/controllerHelpers');
const { notifyEmployee, notifyUser, notifyUsersWithPermission } = require('../helpers/notificationHelper');
const { logActivity, fromReq } = require('./auditController');

// In-app bell for a medical claim status change.
// 'Pending Approval' → approvers; 'Approved'/'Rejected' → the claim's employee.
function notifyMedicalStatus(req, employeeId, status, reason, label) {
  if (status === 'Pending Approval') {
    notifyUsersWithPermission('approve_medical', {
      message: `A ${label} awaits your approval`,
      action: 'AdminMedical', type: 'medical', fromUser: req.user?.id, employee: employeeId,
    }, req.user?.id);
  } else if ((status === 'Approved' || status === 'Rejected') && employeeId) {
    notifyEmployee(employeeId, {
      message: `Your ${label} was ${status.toLowerCase()}${status === 'Rejected' && reason ? ': ' + reason : ''}`,
      action: 'PersonalMedical', type: 'medical', fromUser: req.user?.id,
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toInt(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

/** Read an app-control toggle from the settings table. Returns `defaultOn` when never saved. */
async function readControlSetting(name, defaultOn) {
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT value FROM settings WHERE name=? AND category='app_controls' LIMIT 1`, name
  ).catch(() => []);
  return row ? row.value === '1' : defaultOn;
}

/** Whether medical claims post to the GL / pay out. Off ⇒ record-only (skip all GL postings). */
const medicalPaymentsEnabled = () => readControlSetting('medical_payments_enabled', true);

// Build userId → display name map (joins users → employee for full name)
async function userMap(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(Number).filter(n => !isNaN(n) && n > 0))];
  if (!unique.length) return {};
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT u.id, TRIM(CONCAT_WS(' ', e.firstName, e.lastName)) AS name, u.username
       FROM users u LEFT JOIN employee e ON e.id = u.employeeId
       WHERE u.id IN (${unique.join(',')})`
    );
    return Object.fromEntries(rows.map(r => [String(r.id), r.name?.trim() || r.username || `User ${r.id}`]));
  } catch { return {}; }
}

// Build id → { id, name, employee_id } map for a list of BigInt ids
async function empMap(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return {};
  const emps = await prisma.employee.findMany({
    where: { id: { in: unique.map(BigInt) } },
    select: { id: true, firstName: true, lastName: true, employee_id: true },
  });
  return Object.fromEntries(emps.map(e => [e.id.toString(), {
    id:          e.id.toString(),
    name:        `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim(),
    employee_id: e.employee_id,
  }]));
}

// Build codeListValue id → label map
async function clvMap(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(Number).filter(n => !isNaN(n) && n > 0))];
  if (!unique.length) return {};
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, label FROM codelistvalue WHERE id IN (${unique.join(',')})`
    );
    return Object.fromEntries(rows.map(r => [String(r.id), r.label]));
  } catch { return {}; }
}



// ── WHT settings helpers ──────────────────────────────────────────────────────

const WHT_HOSPITAL_KEY = 'wht_rate_hospital';
const WHT_PHARMACY_KEY = 'wht_rate_pharmacy';
const SETTINGS_CAT     = 'medical';

async function upsertSetting(name, value, category) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM settings WHERE name = ? AND category = ?`, name, category
  ).catch(() => []);
  if (existing.length) {
    await prisma.$executeRawUnsafe(`UPDATE settings SET value = ? WHERE id = ?`, value, existing[0].id);
  } else {
    const newId = BigInt(Date.now());
    await prisma.$executeRawUnsafe(
      `INSERT INTO settings (id, name, value, category) VALUES (?, ?, ?, ?)`, newId, name, value, category
    );
  }
}

async function getWhtRate(hospitalType) {
  const key = (hospitalType ?? '').toLowerCase() === 'pharmacy' ? WHT_PHARMACY_KEY : WHT_HOSPITAL_KEY;
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT value FROM settings WHERE name = ? AND category = ?`, key, SETTINGS_CAT
  ).catch(() => []);
  return parseFloat(row?.value ?? 0);
}

// ── Year-end utilization reset point ────────────────────────────────────────────
// Utilization is recomputed (never stored). When HR starts a new medical year we record a
// reset timestamp here; the enquiries below then only count Approved records on/after it, so
// everyone shows 0 for the fresh year while all historical records remain intact.
const RESET_AT_KEY = 'utilization_reset_at';

// Returns the cutoff date as 'YYYY-MM-DD' (date-only, safe to inline) or null when never reset.
async function getUtilizationCutoff() {
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT value FROM settings WHERE name = ? AND category = ?`, RESET_AT_KEY, SETTINGS_CAT
  ).catch(() => []);
  if (!row?.value) return null;
  const d = new Date(row.value);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// SQL fragments that restrict each source table's Approved rows to the current medical year.
function cutoffFragments(cut) {
  return {
    staff: cut ? ` AND COALESCE(approved_date, updatedAt, createdAt) >= '${cut}'` : '',
    dep:   cut ? ` AND COALESCE(approved_date, from_date) >= '${cut}'`            : '',
    claim: cut ? ` AND COALESCE(approved_date, posted_date) >= '${cut}'`          : '',
  };
}

// GET /medical/settings — retrieve WHT (withholding tax) rates for hospitals and pharmacies.
exports.getMedicalSettings = asyncHandler(async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT name, value FROM settings WHERE category = ?`, SETTINGS_CAT
  ).catch(() => []);
  const map = Object.fromEntries(rows.map(r => [r.name, r.value]));
  respond.ok(res, 'Medical settings', {
    wht_rate_hospital: map[WHT_HOSPITAL_KEY] ?? '0',
    wht_rate_pharmacy: map[WHT_PHARMACY_KEY] ?? '0',
  });
});

// ── Medical GL settings ───────────────────────────────────────────────────────

const GL_CAT          = 'medical_gl';
const GL_EXPENSE_KEY  = 'medical_expense_gl';
const GL_WHT_KEY      = 'medical_wht_gl';
const GL_BRANCH_KEY   = 'medical_gl_branch';

// GET /medical/gl-settings — retrieve GL account codes for medical expense, WHT payable, and branch.
exports.getMedicalGLSettings = asyncHandler(async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT name, value FROM settings WHERE category = ?`, GL_CAT
  ).catch(() => []);
  const map = Object.fromEntries(rows.map(r => [r.name, r.value]));
  respond.ok(res, 'Medical GL settings', {
    medical_expense_gl: map[GL_EXPENSE_KEY] ?? '',
    medical_wht_gl:     map[GL_WHT_KEY]     ?? '',
    medical_gl_branch:  map[GL_BRANCH_KEY]  ?? '',
  });
});

// PUT /medical/gl-settings — save GL account codes used when posting medical payments to the general ledger.
exports.updateMedicalGLSettings = asyncHandler(async (req, res) => {
  const { medical_expense_gl = '', medical_wht_gl = '', medical_gl_branch = '' } = req.body;
  await upsertSetting(GL_EXPENSE_KEY, String(medical_expense_gl), GL_CAT);
  await upsertSetting(GL_WHT_KEY,     String(medical_wht_gl),     GL_CAT);
  await upsertSetting(GL_BRANCH_KEY,  String(medical_gl_branch),  GL_CAT);
  respond.ok(res, 'GL settings saved');
});

// Shared GL posting for direct staff/dependent medical approvals.
// creditAccount = employee's bankAccount from the employee record.
async function postStaffMedicalGL({ id, prefix, employeeName, illnessType, cost, approvedBy, glExpense, creditAccount, branch, currency }) {
  const amt = parseFloat(String(cost ?? 0));
  console.log(`[medical GL] MED_${prefix}_${id} — amt=${amt}, glExpense="${glExpense}", creditAccount="${creditAccount}", branch="${branch}", currency="${currency}"`);
  if (!amt || !glExpense || !creditAccount) {
    console.warn(`[medical GL] skipping — missing: ${!amt ? 'amount' : ''}${!glExpense ? ' glExpense' : ''}${!creditAccount ? ' creditAccount(bankAccount)' : ''}`);
    return null;
  }
  const narration   = ['Medical', employeeName, illnessType].filter(Boolean).join(' - ');
  const referenceNo = `M${prefix[0]}${id}${String(Date.now()).slice(-7)}`;
  const payload = {
    approvedBy,
    referenceNo,
    debitAccounts: [{
      debitAmount:    amt,
      debitAccount:   glExpense,
      debitCurrency:  currency,
      debitNarration: narration,
      debitProdRef:   `MED_${prefix}_${id}_EXP`,
      debitBranch:    branch,
    }],
    creditAccounts: [{
      creditAmount:    amt,
      creditAccount:   creditAccount,
      creditCurrency:  currency,
      creditNarration: narration,
      creditProdRef:   `MED_${prefix}_${id}_CR`,
      creditBranch:    branch,
    }],
  };
  console.log('[medical GL] payload:', JSON.stringify(payload, null, 2));
  const result = await postToGL(payload);
  return { ...result, _sentPayload: payload };
}

async function loadGLSettings() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT name, value FROM settings WHERE category = ?`, GL_CAT
  ).catch(() => []);
  const map = Object.fromEntries(rows.map(r => [r.name, r.value]));
  return {
    expenseGl: map[GL_EXPENSE_KEY] || '',
    whtGl:     map[GL_WHT_KEY]     || '',
    branch:    map[GL_BRANCH_KEY]  || glCfg.branch(),
    currency:  glCfg.currency(),
  };
}

// PUT /medical/settings — update WHT rates for hospitals and pharmacies; validates 0–100 range.
exports.updateMedicalSettings = asyncHandler(async (req, res) => {
  const { wht_rate_hospital, wht_rate_pharmacy } = req.body;
  const h = parseFloat(wht_rate_hospital ?? 0);
  const p = parseFloat(wht_rate_pharmacy  ?? 0);
  if (isNaN(h) || h < 0 || h > 100) return respond.badReq(res, 'Hospital WHT rate must be 0–100');
  if (isNaN(p) || p < 0 || p > 100) return respond.badReq(res, 'Pharmacy WHT rate must be 0–100');
  await upsertSetting(WHT_HOSPITAL_KEY, String(h), SETTINGS_CAT);
  await upsertSetting(WHT_PHARMACY_KEY, String(p), SETTINGS_CAT);
  respond.ok(res, 'Settings saved', { wht_rate_hospital: String(h), wht_rate_pharmacy: String(p) });
});

// ── STAFF MEDICAL ─────────────────────────────────────────────────────────────

// GET /medical/staff — list staff medical records. Anyone who can view Manage Medical
// (view_medical permission) sees all submitted records plus their own drafts; everyone
// else sees only their own records across all statuses.
exports.getStaffMedical = asyncHandler(async (req, res) => {
  const canViewAll = (req.user?.permissions ?? []).includes('view_medical');
  let rows;
  if (canViewAll) {
    // Manage Medical viewers see submitted records + their own Drafts
    rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM staffmedical WHERE status != 'Draft' OR posted_by = ? ORDER BY id DESC`,
      Number(req.user?.id || 0)
    );
  } else {
    // Employees only see their own records (all statuses including Draft)
    const [self] = await prisma.$queryRawUnsafe(
      `SELECT id FROM employee WHERE email = ? OR work_email = ? OR employee_id = ? LIMIT 1`,
      req.user?.email || '', req.user?.email || '', req.user?.username || ''
    ).catch(() => []);
    if (!self) return respond.ok(res, 'Staff medical records', []);
    rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM staffmedical WHERE employee = ? ORDER BY id DESC`,
      BigInt(self.id)
    );
  }
  const em  = await empMap(rows.map(r => r.employee));
  const um  = await userMap([
    ...rows.map(r => r.posted_by),
    ...rows.map(r => r.approved_by),
  ]);
  const toDateStr = v => v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : null);
  respond.ok(res, 'Staff medical records', rows.map(r => ({
    ...s(r),
    employee_name:    em[String(r.employee)]?.name        ?? r.employee,
    employee_empid:   em[String(r.employee)]?.employee_id ?? null,
    posted_by_name:   um[String(r.posted_by)]   ?? null,
    approved_by_name: um[String(r.approved_by)] ?? null,
    admission_date:   toDateStr(r.from_date),
    discharged_date:  toDateStr(r.to_date),
    illness_type:     r.type_of_illness,
    medication:       r.medication_given,
  })));
});

// POST /medical/staff — create a new staff medical record in Draft status.
exports.createStaffMedical = asyncHandler(async (req, res) => {
  const {
    employee, admission_date, discharged_date, admission_type,
    illness_type, medication, hospital, physician, cost,
    mode_of_payment, attachment1, status,
  } = req.body;

  if (!employee)       return respond.badReq(res, 'Employee is required');
  if (!admission_date) return respond.badReq(res, 'Admission date is required');
  if (!illness_type)   return respond.badReq(res, 'Illness type is required');
  if (!cost)           return respond.badReq(res, 'Cost is required');

  const row = await prisma.staffmedical.create({
    data: {
      employee:        String(employee),
      from_date:       new Date(admission_date),
      to_date:         discharged_date ? new Date(discharged_date) : null,
      admission_type:  admission_type  || '',
      type_of_illness: illness_type    || '',
      medication_given:medication      || '',
      cost:            parseFloat(cost),
      mode_of_payment: mode_of_payment || null,
      hospital:        hospital        || '',
      physician:       physician       || null,
      attachment1:     attachment1     || null,
      status:          'Draft',
      posted_by:       String(req.user?.id ?? ''),
      createdAt:       new Date(),
      updatedAt:       new Date(),
    },
  });

  const created = await prisma.$queryRawUnsafe(`SELECT * FROM staffmedical WHERE id = ?`, row.id);
  respond.created(res, 'Staff medical record created', s(created[0] ?? {}));
});

// PUT /medical/staff/:id — patch a staff medical record; handles status changes (approve/reject) separately
// from field edits. Editing a Rejected record automatically resets it to Draft for resubmission.
// A non-admin user may only mutate medical requests they originated themselves.
// Admin/HR holding the relevant medical permission can act on any record.
async function assertCanMutateMedical(req, res, table, id, perm) {
  const [rec] = await prisma.$queryRawUnsafe(`SELECT posted_by FROM ${table} WHERE id = ? LIMIT 1`, id);
  if (!rec) { respond.notFound(res, 'Record not found'); return false; }
  const owns    = String(rec.posted_by ?? '') === String(req.user?.id ?? '');
  const hasPerm = (req.user?.permissions ?? []).includes(perm);
  if (!owns && !hasPerm) { respond.forbidden(res, 'You can only modify medical requests you created'); return false; }
  return true;
}

// Enforce the "Allow Self-Approval" control (Settings → Medical Approval). When the setting is
// OFF, the user who originated a request may not approve it themselves — a different approver
// must act. Defaults to allowed when the setting has never been saved.
async function assertCanSelfApprove(req, res, record) {
  const sameUser = String(record.posted_by ?? '') === String(req.user?.id ?? '');
  if (!sameUser) return true;
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT value FROM settings WHERE name='approval_medical_self' AND category='app_controls' LIMIT 1`
  ).catch(() => []);
  const selfApprovalAllowed = row ? row.value === '1' : true;
  if (!selfApprovalAllowed) {
    respond.forbidden(res, 'Self-approval is disabled — a different approver must review this request');
    return false;
  }
  return true;
}

exports.updateStaffMedical = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  if (!(await assertCanMutateMedical(req, res, 'staffmedical', id, 'edit_medical'))) return;

  const {
    employee, admission_date, discharged_date, admission_type,
    illness_type, medication, hospital, physician, cost,
    mode_of_payment, status, attachment1, rejection_reason,
  } = req.body;

  // Status + approval tracking via raw SQL to avoid Prisma enum mapping issues
  if (status) {
    const approverId = (status === 'Approved' || status === 'Rejected') ? (req.user?.id ?? null) : null;
    const reason     = status === 'Rejected' ? (rejection_reason ?? null) : null;
    await prisma.$executeRawUnsafe(
      `UPDATE staffmedical SET status = ?, approved_by = ?, rejection_reason = ?, updatedAt = NOW() WHERE id = ?`,
      status, approverId, reason, id
    );
    try {
      const rec = (await prisma.$queryRawUnsafe(`SELECT employee FROM staffmedical WHERE id=?`, id))[0];
      notifyMedicalStatus(req, rec?.employee, status, reason, 'staff medical claim');
    } catch { /* non-blocking */ }
  }

  const hasOtherFields = employee || admission_date || discharged_date !== undefined ||
    admission_type !== undefined || illness_type || medication || hospital !== undefined ||
    physician !== undefined || cost || mode_of_payment !== undefined || attachment1 !== undefined;

  if (hasOtherFields) {
    await prisma.staffmedical.update({
      where: { id },
      data: {
        ...(employee        && { employee: String(employee) }),
        ...(admission_date  && { from_date: new Date(admission_date) }),
        ...(discharged_date !== undefined && { to_date: discharged_date ? new Date(discharged_date) : null }),
        ...(admission_type  !== undefined && { admission_type: admission_type  || '' }),
        ...(illness_type    && { type_of_illness: illness_type }),
        ...(medication      && { medication_given: medication }),
        ...(hospital        !== undefined && { hospital: hospital || '' }),
        ...(physician       !== undefined && { physician: physician || null }),
        ...(cost            && { cost: parseFloat(cost) }),
        ...(mode_of_payment !== undefined && { mode_of_payment: mode_of_payment || null }),
        ...(attachment1     !== undefined && { attachment1: attachment1 || null }),
        updatedAt: new Date(),
      },
    });
    // Editing a rejected record restores it to Draft so it can be resubmitted
    await prisma.$executeRawUnsafe(
      `UPDATE staffmedical SET status='Draft', rejection_reason=NULL, approved_by=NULL, updatedAt=NOW() WHERE id=? AND status='Rejected'`,
      id
    );
  }

  const updated = await prisma.$queryRawUnsafe(`SELECT * FROM staffmedical WHERE id = ?`, id);
  respond.ok(res, 'Staff medical record updated', s(updated[0] ?? {}));
});

// DELETE /medical/staff/:id — permanently remove a staff medical record.
exports.deleteStaffMedical = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  if (!(await assertCanMutateMedical(req, res, 'staffmedical', id, 'delete_medical'))) return;
  await prisma.staffmedical.delete({ where: { id } });
  respond.ok(res, 'Deleted');
});

// ── DEPENDENT MEDICAL ─────────────────────────────────────────────────────────

// GET /medical/dependent — list dependent medical records with the same view_medical/self visibility rules as staff medical.
// Resolves relationship labels from CodeListValue and resolves dependent name from the register.
exports.getDependentMedical = asyncHandler(async (req, res) => {
  const canViewAll = (req.user?.permissions ?? []).includes('view_medical');
  let rows;
  if (canViewAll) {
    rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM dependentmedical WHERE status != 'Draft' OR posted_by = ? ORDER BY id DESC`,
      Number(req.user?.id || 0)
    );
  } else {
    const [self] = await prisma.$queryRawUnsafe(
      `SELECT id FROM employee WHERE email = ? OR work_email = ? OR employee_id = ? LIMIT 1`,
      req.user?.email || '', req.user?.email || '', req.user?.username || ''
    ).catch(() => []);
    if (!self) return respond.ok(res, 'Dependent medical records', []);
    rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM dependentmedical WHERE employee = ? ORDER BY id DESC`,
      BigInt(self.id)
    );
  }
  const em  = await empMap(rows.map(r => r.employee));
  const um  = await userMap([
    ...rows.map(r => r.posted_by),
    ...rows.map(r => r.approved_by),
  ]);
  const cm  = await clvMap(rows.map(r => r.relation_to_dependent));
  const toDateStr = v => v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : null);
  respond.ok(res, 'Dependent medical records', rows.map(r => ({
    ...s(r),
    employee_name:    em[String(r.employee)]?.name        ?? r.employee,
    employee_empid:   em[String(r.employee)]?.employee_id ?? null,
    posted_by_name:   um[String(r.posted_by)]   ?? null,
    approved_by_name: um[String(r.approved_by)] ?? null,
    dependent_id:     r.dependent_id ? String(r.dependent_id) : null,
    dependent_name:   r.dependant_name,
    relationship:     r.relation_to_dependent
                        ? (cm[String(r.relation_to_dependent)] ?? r.relation_to_dependent)
                        : null,
    date_attended:    toDateStr(r.from_date),
    date_discharged:  toDateStr(r.to_date),
    illness_type:     r.type_of_illness,
    medication:       r.medication_given,
  })));
});

// POST /medical/dependent — create a dependent medical record in Draft status; looks up dependent name
// from the employeedependents register when dependent_id is provided.
exports.createDependentMedical = asyncHandler(async (req, res) => {
  const {
    employee, dependent_id, relationship, dob,
    date_attended, date_discharged, admission_type,
    illness_type, medication, hospital, physician, cost,
    mode_of_payment, attachment1, status,
  } = req.body;

  if (!employee)      return respond.badReq(res, 'Employee is required');
  if (!date_attended) return respond.badReq(res, 'Date attended is required');
  if (!illness_type)  return respond.badReq(res, 'Illness type is required');
  if (!cost)          return respond.badReq(res, 'Cost is required');

  // Look up dependent name
  let dependantName = '';
  if (dependent_id) {
    const dep = await prisma.employeedependents.findUnique({
      where: { id: toBigInt(dependent_id) },
      select: { name: true },
    }).catch(() => null);
    dependantName = dep?.name ?? '';
  }

  const row = await prisma.dependentmedical.create({
    data: {
      employee:             String(employee),
      from_date:            new Date(date_attended),
      to_date:              date_discharged ? new Date(date_discharged) : null,
      dependant_name:       dependantName,
      relation_to_dependent:relationship    || null,
      dob:                  dob ? new Date(dob) : null,
      admission_type:       admission_type  || '',
      type_of_illness:      illness_type    || '',
      medication_given:     medication      || '',
      cost:                 parseFloat(cost),
      mode_of_payment:      mode_of_payment || null,
      hospital:             hospital        || '',
      physician:            physician       || null,
      attachment1:          attachment1     || null,
      status:               'Draft',
      posted_by:            String(req.user?.id ?? ''),
    },
  });

  // Apply dependent_id via raw SQL (Prisma schema may not have this column yet)
  await prisma.$executeRawUnsafe(
    `UPDATE dependentmedical SET dependent_id = ? WHERE id = ?`,
    dependent_id ? toBigInt(dependent_id) : null,
    row.id
  ).catch(() => {});

  const created = await prisma.$queryRawUnsafe(`SELECT * FROM dependentmedical WHERE id = ?`, row.id);
  respond.created(res, 'Dependent medical record created', s(created[0] ?? {}));
});

// PUT /medical/dependent/:id — patch a dependent medical record; same approve/reject + auto-Draft-restore logic as updateStaffMedical.
exports.updateDependentMedical = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  if (!(await assertCanMutateMedical(req, res, 'dependentmedical', id, 'edit_medical'))) return;

  const {
    employee, dependent_id, relationship, dob,
    date_attended, date_discharged, admission_type,
    illness_type, medication, hospital, physician, cost,
    mode_of_payment, status, attachment1, rejection_reason,
  } = req.body;

  let dependantName;
  if (dependent_id) {
    const dep = await prisma.employeedependents.findUnique({
      where: { id: toBigInt(dependent_id) },
      select: { name: true },
    }).catch(() => null);
    dependantName = dep?.name;
  }

  if (status) {
    const approverId = (status === 'Approved' || status === 'Rejected') ? (req.user?.id ?? null) : null;
    const reason     = status === 'Rejected' ? (rejection_reason ?? null) : null;
    await prisma.$executeRawUnsafe(
      `UPDATE dependentmedical SET status = ?, approved_by = ?, rejection_reason = ? WHERE id = ?`,
      status, approverId, reason, id
    );
    try {
      const rec = (await prisma.$queryRawUnsafe(`SELECT employee FROM dependentmedical WHERE id=?`, id))[0];
      notifyMedicalStatus(req, rec?.employee, status, reason, 'dependent medical claim');
    } catch { /* non-blocking */ }
  }

  const hasOtherFieldsDep = employee || date_attended || date_discharged !== undefined ||
    dependantName !== undefined || relationship !== undefined || dob !== undefined ||
    admission_type !== undefined || illness_type || medication || hospital !== undefined ||
    physician !== undefined || cost || mode_of_payment !== undefined || attachment1 !== undefined;

  if (hasOtherFieldsDep) {
    await prisma.dependentmedical.update({
      where: { id },
      data: {
        ...(employee       && { employee: String(employee) }),
        ...(date_attended  && { from_date: new Date(date_attended) }),
        ...(date_discharged !== undefined && { to_date: date_discharged ? new Date(date_discharged) : null }),
        ...(dependantName  !== undefined && { dependant_name: dependantName }),
        ...(relationship   !== undefined && { relation_to_dependent: relationship || null }),
        ...(dob            !== undefined && { dob: dob ? new Date(dob) : null }),
        ...(admission_type !== undefined && { admission_type: admission_type || '' }),
        ...(illness_type   && { type_of_illness: illness_type }),
        ...(medication     && { medication_given: medication }),
        ...(hospital       !== undefined && { hospital: hospital || '' }),
        ...(physician      !== undefined && { physician: physician || null }),
        ...(cost           && { cost: parseFloat(cost) }),
        ...(mode_of_payment !== undefined && { mode_of_payment: mode_of_payment || null }),
        ...(attachment1     !== undefined && { attachment1: attachment1 || null }),
      },
    });
    // Editing a rejected record restores it to Draft so it can be resubmitted
    await prisma.$executeRawUnsafe(
      `UPDATE dependentmedical SET status='Draft', rejection_reason=NULL, approved_by=NULL WHERE id=? AND status='Rejected'`,
      id
    );
  }

  if (dependent_id) {
    await prisma.$executeRawUnsafe(
      `UPDATE dependentmedical SET dependent_id = ? WHERE id = ?`,
      toBigInt(dependent_id), id
    ).catch(() => {});
  }
  const updatedDep = await prisma.$queryRawUnsafe(`SELECT * FROM dependentmedical WHERE id = ?`, id);
  respond.ok(res, 'Dependent medical record updated', s(updatedDep[0] ?? {}));
});

// DELETE /medical/dependent/:id — permanently remove a dependent medical record.
exports.deleteDependentMedical = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  if (!(await assertCanMutateMedical(req, res, 'dependentmedical', id, 'delete_medical'))) return;
  await prisma.dependentmedical.delete({ where: { id } });
  respond.ok(res, 'Deleted');
});

// ── MEDICAL LIMITS ────────────────────────────────────────────────────────────

// GET /medical/limits — list all paygrade medical limits (max claimable amount per pay grade + currency).
exports.getMedicalLimits = asyncHandler(async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT ml.*, pg.name AS grade_name
    FROM medicallimit ml
    LEFT JOIN paygrades pg ON pg.id = ml.paygrade_id
    ORDER BY ml.id DESC
  `);
  respond.ok(res, 'Medical limits', rows.map(r => s({
    ...r,
    grade_name: r.grade_name ?? r.grade,
  })));
});

// POST /medical/limits — create a new medical limit for a pay grade; resolves grade name from the paygrades table.
exports.createMedicalLimit = asyncHandler(async (req, res) => {
  const { paygrade, currency, amount } = req.body;
  if (!paygrade) return respond.badReq(res, 'Pay grade is required');
  if (!currency) return respond.badReq(res, 'Currency is required');
  if (!amount)   return respond.badReq(res, 'Amount is required');

  const pgId = toBigInt(paygrade);
  // Get paygrade name for the grade field
  const pg = pgId ? await prisma.paygrades.findUnique({ where: { id: pgId }, select: { name: true } }).catch(() => null) : null;

  const row = await prisma.$queryRawUnsafe(
    `INSERT INTO medicallimit (grade, paygrade_id, currency, amount, posting_date, status)
     VALUES (?, ?, ?, ?, NOW(), 'Active')`,
    pg?.name ?? String(paygrade),
    pgId ? Number(pgId) : null,
    currency,
    parseFloat(amount),
  );
  respond.created(res, 'Medical limit created', { id: Number(row.insertId ?? 0) });
});

// PUT /medical/limits/:id — update a medical limit's pay grade, currency, or amount.
exports.updateMedicalLimit = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const { paygrade, currency, amount } = req.body;
  const pgId = toBigInt(paygrade);
  const pg   = pgId ? await prisma.paygrades.findUnique({ where: { id: pgId }, select: { name: true } }).catch(() => null) : null;

  await prisma.$executeRawUnsafe(
    `UPDATE medicallimit SET grade = ?, paygrade_id = ?, currency = ?, amount = ? WHERE id = ?`,
    pg?.name ?? String(paygrade),
    pgId ? Number(pgId) : null,
    currency,
    parseFloat(amount),
    id,
  );
  respond.ok(res, 'Medical limit updated');
});

// DELETE /medical/limits/:id — remove a medical limit entry.
exports.deleteMedicalLimit = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return respond.badReq(res, 'Invalid ID');
  await prisma.$executeRawUnsafe(`DELETE FROM medicallimit WHERE id = ?`, id);
  respond.ok(res, 'Deleted');
});

// ── STAFF MEDICAL ENQUIRY ─────────────────────────────────────────────────────

// GET /medical/enquiry — aggregate view of medical utilisation for all active employees: limit, staff-used,
// dependent-used, total utilised, and remaining balance. Includes amounts from approved hospital claim items.
exports.getMedicalEnquiry = asyncHandler(async (req, res) => {
  // Raw join: paygrades relation is not defined in Prisma schema
  const employees = await prisma.$queryRawUnsafe(`
    SELECT e.id, e.firstName, e.lastName, e.employee_id,
           pg.id AS pg_id, pg.name AS pg_name
    FROM employee e
    LEFT JOIN paygrades pg ON pg.id = e.paygradeId
    WHERE e.lifecycleStatus != 'TERMINATED'
    ORDER BY e.firstName ASC
  `);

  if (!employees.length) return respond.ok(res, 'Medical enquiry', []);

  const limits = await prisma.$queryRawUnsafe(`SELECT * FROM medicallimit WHERE paygrade_id IS NOT NULL`);
  const limitByGrade = {};
  for (const lim of limits) {
    if (lim.paygrade_id) limitByGrade[String(lim.paygrade_id)] = lim;
  }

  // Only Approved records on/after the current medical-year reset point count toward utilization
  const cut = await getUtilizationCutoff();
  const frag = cutoffFragments(cut);
  const staffCosts = await prisma.$queryRawUnsafe(
    `SELECT employee, SUM(cost) as total FROM staffmedical WHERE status = 'Approved'${frag.staff} GROUP BY employee`
  );
  const depCosts   = await prisma.$queryRawUnsafe(
    `SELECT employee, SUM(cost) as total FROM dependentmedical WHERE status = 'Approved'${frag.dep} GROUP BY employee`
  );

  const staffMap = Object.fromEntries((staffCosts ?? []).map(r => [String(r.employee), parseFloat(r.total ?? 0)]));
  const depMap   = Object.fromEntries((depCosts   ?? []).map(r => [String(r.employee), parseFloat(r.total ?? 0)]));

  // Include approved hospital claim items in utilisation
  const approvedClaims = await prisma.$queryRawUnsafe(
    `SELECT items FROM hospitalclaims WHERE status = 'Approved'${frag.claim}`
  ).catch(() => []);
  for (const claim of approvedClaims) {
    let claimItems = [];
    try { claimItems = JSON.parse(claim.items ?? '[]'); } catch {}
    for (const item of claimItems) {
      const empKey = String(item.employee_id);
      const amt    = parseFloat(item.amount ?? 0);
      if (item.type === 'dependent') {
        depMap[empKey]   = (depMap[empKey]   ?? 0) + amt;
      } else {
        staffMap[empKey] = (staffMap[empKey] ?? 0) + amt;
      }
    }
  }

  const rows = employees.map(emp => {
    const pgId         = emp.pg_id ? String(emp.pg_id) : null;
    const lim          = pgId ? limitByGrade[pgId] : null;
    const limit        = lim  ? parseFloat(lim.amount ?? 0) : null;
    const currency     = lim?.currency ?? '';
    const staffUsed    = staffMap[String(emp.id)] ?? 0;
    const depUsed      = depMap[String(emp.id)]   ?? 0;
    const utilized     = staffUsed + depUsed;

    return {
      employee_id:     String(emp.id),
      employee_empid:  emp.employee_id,
      employee_name:   `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim(),
      grade:           emp.pg_name ?? '—',
      currency,
      medical_limit:   limit,
      staff_utilized:  staffUsed,
      dep_utilized:    depUsed,
      total_utilized:  utilized,
      limit_balance:   limit !== null ? limit - utilized : null,
    };
  });

  respond.ok(res, 'Medical enquiry', s(rows));
});

// GET /medical/enquiry/:id — detailed utilisation breakdown for a single employee including all approved
// staff and dependent medical records and approved hospital claim line items.
exports.getMedicalEnquiryByEmployee = asyncHandler(async (req, res) => {
  const empIdStr = String(req.params.id);
  const empIdBig = toBigInt(empIdStr);
  if (!empIdBig) return respond.badReq(res, 'Invalid employee ID');

  const [emp] = await prisma.$queryRawUnsafe(`
    SELECT e.id, e.firstName, e.lastName, e.employee_id,
           pg.id AS pg_id, pg.name AS pg_name
    FROM employee e
    LEFT JOIN paygrades pg ON pg.id = e.paygradeId
    WHERE e.id = ?
    LIMIT 1
  `, empIdBig).catch(() => []);
  if (!emp) return respond.notFound(res, 'Employee not found');

  const pgId   = emp.pg_id ? String(emp.pg_id) : null;
  const limits = pgId
    ? await prisma.$queryRawUnsafe(`SELECT * FROM medicallimit WHERE paygrade_id = ? LIMIT 1`, Number(pgId)).catch(() => [])
    : [];
  const lim      = limits?.[0] ?? null;
  const limit    = lim ? parseFloat(lim.amount ?? 0) : null;
  const currency = lim?.currency ?? '';

  // Restrict utilization to the current medical year (records on/after the reset point)
  const cut  = await getUtilizationCutoff();
  const frag = cutoffFragments(cut);
  const [staffTotals] = await prisma.$queryRawUnsafe(
    `SELECT SUM(cost) AS total FROM staffmedical WHERE employee = ? AND status = 'Approved'${frag.staff}`, empIdStr
  ).catch(() => [{ total: 0 }]);
  const [depTotals] = await prisma.$queryRawUnsafe(
    `SELECT SUM(cost) AS total FROM dependentmedical WHERE employee = ? AND status = 'Approved'${frag.dep}`, empIdStr
  ).catch(() => [{ total: 0 }]);

  let staffUsed = parseFloat(staffTotals?.total ?? 0);
  let depUsed   = parseFloat(depTotals?.total  ?? 0);

  // Include approved hospital claim items
  const approvedClaims = await prisma.$queryRawUnsafe(
    `SELECT items FROM hospitalclaims WHERE status = 'Approved'${frag.claim}`
  ).catch(() => []);
  for (const claim of approvedClaims) {
    let claimItems = [];
    try { claimItems = JSON.parse(claim.items ?? '[]'); } catch {}
    for (const item of claimItems) {
      if (String(item.employee_id) !== empIdStr) continue;
      const amt = parseFloat(item.amount ?? 0);
      if (item.type === 'dependent') depUsed   += amt;
      else                           staffUsed += amt;
    }
  }

  const utilized = staffUsed + depUsed;
  const balance  = limit !== null ? limit - utilized : null;

  const toDateStr = v => v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : null);

  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM staffmedical WHERE employee = ? AND status = 'Approved'${frag.staff} ORDER BY id DESC`, empIdStr
  ).catch(() => []);
  const depRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM dependentmedical WHERE employee = ? AND status = 'Approved'${frag.dep} ORDER BY id DESC`, empIdStr
  ).catch(() => []);

  respond.ok(res, 'Employee medical enquiry', s({
    employee_id:    String(emp.id),
    employee_empid: emp.employee_id,
    employee_name:  `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim(),
    grade:          emp.pg_name ?? '—',
    currency,
    medical_limit:  limit,
    staff_utilized: staffUsed,
    dep_utilized:   depUsed,
    total_utilized: utilized,
    limit_balance:  balance,
    staff_records: staffRows.map(r => ({
      ...r,
      admission_date:  toDateStr(r.from_date),
      discharged_date: toDateStr(r.to_date),
      illness_type:    r.type_of_illness,
      hospital:        r.hospital,
      cost:            parseFloat(r.cost ?? 0),
    })),
    dependent_records: depRows.map(r => ({
      ...r,
      dependent_name:  r.dependant_name,
      date_attended:   toDateStr(r.from_date),
      date_discharged: toDateStr(r.to_date),
      illness_type:    r.type_of_illness,
      hospital:        r.hospital,
      cost:            parseFloat(r.cost ?? 0),
    })),
  }));
});

// ── PERSONAL MEDICAL ENQUIRY (current user's employee) ───────────────────────

// GET /medical/my-enquiry — return the authenticated user's own medical limit, utilisation, and full record history
// (all statuses). Utilisation includes Approved, Pending Approval, and Draft records to show worst-case balance.
exports.getMyMedicalEnquiry = asyncHandler(async (req, res) => {
  // Find the employee linked to this user
  const userRow = await prisma.$queryRawUnsafe(
    `SELECT u.employeeId FROM users u WHERE u.id = ? LIMIT 1`,
    Number(req.user?.id)
  ).catch(() => []);
  const empId = userRow?.[0]?.employeeId ? String(userRow[0].employeeId) : null;
  if (!empId) return respond.ok(res, 'My medical enquiry', null);

  const [emp] = await prisma.$queryRawUnsafe(`
    SELECT e.id, e.firstName, e.lastName, e.employee_id,
           pg.id AS pg_id, pg.name AS pg_name
    FROM employee e
    LEFT JOIN paygrades pg ON pg.id = e.paygradeId
    WHERE e.id = ?
    LIMIT 1
  `, BigInt(empId)).catch(() => []);
  if (!emp) return respond.ok(res, 'My medical enquiry', null);

  const pgId = emp.pg_id ? String(emp.pg_id) : null;
  const limits = pgId
    ? await prisma.$queryRawUnsafe(`SELECT * FROM medicallimit WHERE paygrade_id = ? LIMIT 1`, Number(pgId)).catch(() => [])
    : [];
  const lim    = limits?.[0] ?? null;
  const limit  = lim ? parseFloat(lim.amount ?? 0) : null;
  const currency = lim?.currency ?? '';

  // Count Approved records only from the current medical year; in-progress Draft/Pending always show.
  const cut  = await getUtilizationCutoff();
  const frag = cutoffFragments(cut);
  const [staffTotals] = await prisma.$queryRawUnsafe(
    `SELECT SUM(cost) AS total FROM staffmedical WHERE employee = ?
       AND (status IN ('Pending Approval','Draft') OR (status = 'Approved'${frag.staff}))`,
    empId
  ).catch(() => [{ total: 0 }]);
  const [depTotals] = await prisma.$queryRawUnsafe(
    `SELECT SUM(cost) AS total FROM dependentmedical WHERE employee = ?
       AND (status IN ('Pending Approval','Draft') OR (status = 'Approved'${frag.dep}))`,
    empId
  ).catch(() => [{ total: 0 }]);

  const utilized = parseFloat(staffTotals?.total ?? 0) + parseFloat(depTotals?.total ?? 0);
  const balance  = limit !== null ? Math.max(0, limit - utilized) : null;

  // Also return individual records for the history
  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM staffmedical WHERE employee = ? ORDER BY id DESC`, empId
  ).catch(() => []);
  const depRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM dependentmedical WHERE employee = ? ORDER BY id DESC`, empId
  ).catch(() => []);
  const toDateStr = v => v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : null);

  respond.ok(res, 'My medical enquiry', s({
    employee_name:   `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim(),
    employee_empid:  emp.employee_id,
    grade:           emp.pg_name ?? '—',
    currency,
    medical_limit:   limit,
    amount_utilized: utilized,
    limit_balance:   balance,
    staff_records:   staffRows.map(r => ({
      ...r,
      admission_date:  toDateStr(r.from_date),
      discharged_date: toDateStr(r.to_date),
      illness_type:    r.type_of_illness,
      medication:      r.medication_given,
    })),
    dependent_records: depRows.map(r => ({
      ...r,
      dependent_name:  r.dependant_name,
      relationship:    r.relation_to_dependent,
      date_attended:   toDateStr(r.from_date),
      date_discharged: toDateStr(r.to_date),
      illness_type:    r.type_of_illness,
      medication:      r.medication_given,
    })),
  }));
});

// ── REGISTERED HOSPITALS ──────────────────────────────────────────────────────

// GET /medical/hospitals — list all registered hospitals and pharmacies with their GL account and type.
exports.getHospitals = asyncHandler(async (req, res) => {
  const rows = await prisma.registeredhospitals.findMany({ orderBy: { id: 'desc' } });
  respond.ok(res, 'Hospitals', rows.map(r => s(r)));
});

// POST /medical/hospitals — register a new hospital or pharmacy with its GL credit account.
exports.createHospital = asyncHandler(async (req, res) => {
  const { name, account, type = 'Hospital' } = req.body;
  if (!name?.trim())    return respond.badReq(res, 'Name is required');
  if (!account?.trim()) return respond.badReq(res, 'Account is required');
  const row = await prisma.registeredhospitals.create({
    data: { name: name.trim(), account: account.trim(), type: type || 'Hospital', created_at: new Date() },
  });
  respond.created(res, 'Hospital registered', s(row));
});

// PUT /medical/hospitals/:id — update a registered hospital's name, account, or type.
exports.updateHospital = asyncHandler(async (req, res) => {
  const id  = toInt(req.params.id);
  if (!id)  return respond.badReq(res, 'Invalid ID');
  const { name, account, type } = req.body;
  const row = await prisma.registeredhospitals.update({
    where: { id },
    data: {
      ...(name?.trim()    && { name: name.trim() }),
      ...(account?.trim() && { account: account.trim() }),
      ...(type            && { type }),
      updated_at: new Date(),
    },
  });
  respond.ok(res, 'Hospital updated', s(row));
});

// DELETE /medical/hospitals/:id — remove a registered hospital from the system.
exports.deleteHospital = asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  await prisma.registeredhospitals.delete({ where: { id } });
  respond.ok(res, 'Hospital removed');
});

// ── HOSPITAL CLAIMS ───────────────────────────────────────────────────────────
// items = JSON array: [{ employee_id, employee_name, type:'self'|'dependent',
//                        dependent_id, dependent_name, narration, amount }]

// GET /medical/hospital-claims — list all hospital claims with resolved hospital name/type, item count, and totals.
exports.getHospitalClaims = asyncHandler(async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM hospitalclaims ORDER BY id DESC`);

  const hospIds = [...new Set(rows.map(r => r.hospital).filter(Boolean).map(Number))];
  const hospitals = hospIds.length
    ? await prisma.registeredhospitals.findMany({ where: { id: { in: hospIds } } })
    : [];
  const hospMap = Object.fromEntries(hospitals.map(h => [h.id, { name: h.name, type: h.type }]));

  respond.ok(res, 'Hospital claims', rows.map(r => {
    let items = [];
    try { items = JSON.parse(r.items ?? '[]'); } catch {}
    const hosp = hospMap[Number(r.hospital)] ?? {};
    return {
      ...s(r),
      hospital_name:  hosp.name  ?? null,
      hospital_type:  hosp.type  ?? null,
      item_count:     items.length,
      items,
      total_amount:        parseFloat(r.total_amount ?? 0),
      withholding_tax:     parseFloat(r.withholding_tax ?? 0),
      total_credit_amount: parseFloat(r.total_credit_amount ?? 0),
      date: r.posted_date ? r.posted_date.toISOString().slice(0, 10) : null,
    };
  }));
});

// POST /medical/hospital-claims — create a hospital claim in Draft status; automatically calculates
// withholding tax from the hospital's WHT rate and derives total_credit_amount = total - WHT.
exports.createHospitalClaim = asyncHandler(async (req, res) => {
  const { hospital, items, comment = '' } = req.body;
  if (!hospital)                                   return respond.badReq(res, 'Hospital is required');
  if (!Array.isArray(items) || items.length === 0) return respond.badReq(res, 'At least one item is required');

  const hospId = toInt(hospital);
  const [hosp] = await prisma.$queryRawUnsafe(
    `SELECT type FROM registeredhospitals WHERE id = ? LIMIT 1`, hospId
  ).catch(() => []);
  const rate = await getWhtRate(hosp?.type ?? 'Hospital');

  const total_amount        = items.reduce((s, i) => s + parseFloat(i.amount ?? 0), 0);
  const withholding_tax     = parseFloat((total_amount * rate / 100).toFixed(2));
  const total_credit_amount = parseFloat((total_amount - withholding_tax).toFixed(2));

  const row = await prisma.hospitalclaims.create({
    data: {
      hospital:           BigInt(hospId),
      items:              JSON.stringify(items),
      total_amount,
      withholding_tax,
      category:           0,
      total_credit_amount,
      comment,
      posted_by:          BigInt(req.user?.id ?? 0),
      posted_date:        new Date(),
      status:             'Draft',
    },
  });
  respond.created(res, 'Claim created', s(row));
});

// PUT /medical/hospital-claims/:id — replace items and recalculate WHT totals for a hospital claim.
exports.updateHospitalClaim = asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const { hospital, items, comment } = req.body;
  if (!Array.isArray(items) || items.length === 0) return respond.badReq(res, 'At least one item is required');

  const hospId = hospital ? toInt(hospital) : null;
  let rate = 0;
  if (hospId) {
    const [hosp] = await prisma.$queryRawUnsafe(
      `SELECT type FROM registeredhospitals WHERE id = ? LIMIT 1`, hospId
    ).catch(() => []);
    rate = await getWhtRate(hosp?.type ?? 'Hospital');
  }

  const total_amount        = items.reduce((s, i) => s + parseFloat(i.amount ?? 0), 0);
  const withholding_tax     = parseFloat((total_amount * rate / 100).toFixed(2));
  const total_credit_amount = parseFloat((total_amount - withholding_tax).toFixed(2));

  await prisma.hospitalclaims.update({
    where: { id },
    data: {
      ...(hospId && { hospital: BigInt(hospId) }),
      items:              JSON.stringify(items),
      total_amount,
      withholding_tax,
      total_credit_amount,
      ...(comment !== undefined && { comment }),
    },
  });
  respond.ok(res, 'Claim updated');
});

// DELETE /medical/hospital-claims/:id — permanently remove a hospital claim.
exports.deleteHospitalClaim = asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  await prisma.hospitalclaims.delete({ where: { id } });
  respond.ok(res, 'Deleted');
});

// POST /medical/hospital-claims/:id/submit — move a Draft hospital claim to Pending Approval.
exports.submitHospitalClaim = asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  await prisma.hospitalclaims.update({ where: { id }, data: { status: 'Pending Approval' } });
  notifyUsersWithPermission('approve_medical', {
    message: 'A hospital medical claim awaits your approval',
    action: 'AdminMedical', type: 'medical', fromUser: req.user?.id,
  }, req.user?.id);
  respond.ok(res, 'Claim submitted for approval');
});

// POST /medical/hospital-claims/:id/approve — approve a hospital claim and post to GL: debit medical expense
// per line item, credit hospital account (net of WHT), credit WHT payable GL. Sets status to 'GL Failed'
// on posting error so a retry is possible without re-approving.
exports.approveHospitalClaim = asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  // Fetch claim + hospital account
  const [claim] = await prisma.$queryRawUnsafe(`
    SELECT hc.id, hc.hospital, hc.items, hc.total_amount, hc.withholding_tax, hc.total_credit_amount, hc.posted_by,
           rh.name AS hospital_name, rh.account AS hospital_account
    FROM hospitalclaims hc
    JOIN registeredhospitals rh ON rh.id = hc.hospital
    WHERE hc.id = ? LIMIT 1
  `, id).catch(() => []);

  // Enforce the "Allow Self-Approval" control — the originator can't approve their own claim when it's off.
  if (claim && !(await assertCanSelfApprove(req, res, claim))) return;

  // Approve the claim
  await prisma.hospitalclaims.update({
    where: { id },
    data: { status: 'Approved', approved_by: BigInt(req.user?.id ?? 0), approved_date: new Date() },
  });
  if (claim?.posted_by && String(claim.posted_by) !== String(req.user?.id ?? '')) {
    notifyUser(claim.posted_by, { message: 'Your hospital medical claim was approved', action: 'AdminMedical', type: 'medical', fromUser: req.user?.id });
  }

  // GL posting (non-blocking — approval already committed above). Skipped in record-only mode.
  if (claim && (await medicalPaymentsEnabled()) && glCfg.url()) {
    try {
      const glRows = await prisma.$queryRawUnsafe(
        `SELECT name, value FROM settings WHERE category = ?`, GL_CAT
      ).catch(() => []);
      const glMap     = Object.fromEntries(glRows.map(r => [r.name, r.value]));
      const expenseGl = glMap[GL_EXPENSE_KEY] || '';
      const whtGl     = glMap[GL_WHT_KEY]     || '';
      const branch    = glMap[GL_BRANCH_KEY]  || glCfg.branch();
      const currency  = glCfg.currency();

      let items = [];
      try { items = JSON.parse(claim.items ?? '[]'); } catch {}

      const debitAccounts  = [];
      const creditAccounts = [];
      const approvedBy  = req.user?.username || req.user?.email || 'System';
      const referenceNo = `MC${id}${String(Date.now()).slice(-7)}`;

      // DEBIT: one entry per claim item → medical expense GL
      if (expenseGl) {
        for (const item of items) {
          const amt = parseFloat(item.amount ?? 0);
          if (!amt || amt <= 0) continue;
          const narration = [
            'Medical',
            item.employee_name,
            item.type === 'dependent' ? `Dep: ${item.dependent_name}` : null,
            item.narration || null,
          ].filter(Boolean).join(' - ');
          debitAccounts.push({
            debitAmount:    amt,
            debitAccount:   expenseGl,
            debitCurrency:  currency,
            debitNarration: narration,
            debitProdRef:   `MED_${id}_${item.employee_id}`,
            debitBranch:    branch,
          });
        }
      }

      // CREDIT: hospital account → total_credit_amount
      const creditAmt = parseFloat(String(claim.total_credit_amount ?? 0));
      if (creditAmt > 0 && claim.hospital_account) {
        creditAccounts.push({
          creditAmount:    creditAmt,
          creditAccount:   claim.hospital_account,
          creditCurrency:  currency,
          creditNarration: `Hospital Payment - ${claim.hospital_name}`,
          creditProdRef:   `MED_${id}`,
          creditBranch:    branch,
        });
      }

      // CREDIT: WHT payable GL → withholding_tax
      const whtAmt = parseFloat(String(claim.withholding_tax ?? 0));
      if (whtAmt > 0 && whtGl) {
        creditAccounts.push({
          creditAmount:    whtAmt,
          creditAccount:   whtGl,
          creditCurrency:  currency,
          creditNarration: `WHT - ${claim.hospital_name}`,
          creditProdRef:   `MED_${id}_WHT`,
          creditBranch:    branch,
        });
      }

      let documentRef = null;
      let paymentLog  = null;
      if (debitAccounts.length && creditAccounts.length) {
        const result = await postToGL({ approvedBy, referenceNo, debitAccounts, creditAccounts });
        documentRef = result.documentRef;
        paymentLog  = JSON.stringify(result.raw);
        console.log('[medical approve] GL posting success, ref:', documentRef);
      }

      if (documentRef !== null || paymentLog !== null) {
        await prisma.$executeRawUnsafe(
          `UPDATE hospitalclaims SET document_ref = ?, payment_log = ? WHERE id = ?`,
          documentRef, paymentLog, id
        );
      }
    } catch (e) {
      const errData = e.glResponse || e.response?.data || e.message;
      console.error('[medical approve] GL posting error:', errData);
      await prisma.$executeRawUnsafe(
        `UPDATE hospitalclaims SET status='GL Failed', payment_log = ? WHERE id = ?`,
        JSON.stringify({ error: errData }), id
      );
    }
  }

  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM hospitalclaims WHERE id = ?`, id);
  respond.ok(res, 'Claim approved', s(updated));
});

// POST /medical/hospital-claims/:id/reject — reject a hospital claim with an optional reason.
exports.rejectHospitalClaim = asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const { reason = '' } = req.body;
  await prisma.hospitalclaims.update({
    where: { id },
    data: { status: 'Rejected', approved_by: BigInt(req.user?.id ?? 0), response: reason },
  });
  respond.ok(res, 'Claim rejected');
});

// ── STAFF MEDICAL — Action endpoints (mirrors payroll submit/approve/reject/finalize) ──

// POST /medical/staff/:id/submit — move a Draft staff medical record to Pending Approval.
exports.submitStaffMedical = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  if (!(await assertCanMutateMedical(req, res, 'staffmedical', id, 'create_medical'))) return;
  const [rec] = await prisma.$queryRawUnsafe(`SELECT id, status FROM staffmedical WHERE id = ?`, id);
  if (!rec) return respond.notFound(res, 'Record not found');
  if (rec.status !== 'Draft') return respond.badReq(res, 'Only Draft records can be submitted');
  const userId = req.user?.id ? Number(req.user.id) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE staffmedical SET status='Pending Approval', submitted_by=?, updatedAt=NOW() WHERE id=?`,
    userId, id
  );
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM staffmedical WHERE id=?`, id);
  respond.ok(res, 'Submitted for approval', s(updated));
});

// POST /medical/staff/:id/approve — approve a staff medical claim and GL-post the reimbursement to the
// employee's bank account. Sets status to 'GL Failed' on posting error for retry without re-approving.
exports.approveStaffMedical = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const [rec] = await prisma.$queryRawUnsafe(`SELECT * FROM staffmedical WHERE id = ?`, id);
  if (!rec) return respond.notFound(res, 'Record not found');
  if (rec.status !== 'Pending Approval') return respond.badReq(res, 'Record is not pending approval');
  if (!(await assertCanSelfApprove(req, res, rec))) return;
  const userId = req.user?.id ? Number(req.user.id) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE staffmedical SET status='Approved', approved_by=?, updatedAt=NOW() WHERE id=?`,
    userId, id
  );
  let glPayload = null;
  if ((await medicalPaymentsEnabled()) && glCfg.url()) {
    try {
      const gl  = await loadGLSettings();
      const [emp] = await prisma.$queryRawUnsafe(
        `SELECT TRIM(CONCAT_WS(' ', firstName, lastName)) AS name, bankAccount FROM employee WHERE id = ? LIMIT 1`, rec.employee
      ).catch(() => []);
      const result = await postStaffMedicalGL({
        id: String(id), prefix: 'STF', employeeName: emp?.name ?? String(rec.employee),
        illnessType: rec.type_of_illness, cost: rec.cost,
        approvedBy:    req.user?.username || req.user?.email || 'System',
        glExpense:     gl.expenseGl,
        creditAccount: emp?.bankAccount || '',
        branch:        gl.branch,
        currency:      gl.currency,
      });
      if (result) {
        glPayload = result._sentPayload;
        await prisma.$executeRawUnsafe(
          `UPDATE staffmedical SET document_ref=?, payment_log=? WHERE id=?`,
          result.documentRef, JSON.stringify(result.raw), id
        );
      }
    } catch (e) {
      const errData = e.glResponse || e.response?.data || e.message;
      console.error('[staff medical approve] GL error:', errData);
      await prisma.$executeRawUnsafe(
        `UPDATE staffmedical SET status='GL Failed', payment_log=? WHERE id=?`,
        JSON.stringify({ error: errData }), id
      );
    }
  }
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM staffmedical WHERE id=?`, id);
  respond.ok(res, 'Approved', { ...s(updated), gl_payload: glPayload });
});

// POST /medical/staff/:id/reject — reject a Pending Approval staff medical record with an optional reason.
exports.rejectStaffMedical = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const { reason } = req.body;
  const [rec] = await prisma.$queryRawUnsafe(`SELECT id, status FROM staffmedical WHERE id = ?`, id);
  if (!rec) return respond.notFound(res, 'Record not found');
  if (rec.status !== 'Pending Approval') return respond.badReq(res, 'Record is not pending approval');
  const userId = req.user?.id ? Number(req.user.id) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE staffmedical SET status='Rejected', approved_by=?, rejection_reason=?, updatedAt=NOW() WHERE id=?`,
    userId, reason?.trim() || null, id
  );
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM staffmedical WHERE id=?`, id);
  respond.ok(res, 'Rejected', s(updated));
});

// POST /medical/staff/:id/finalize — directly approve a Draft record and trigger GL posting in one step,
// bypassing the submit → approve flow. Useful for HR entering retrospective claims.
exports.finalizeStaffMedical = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const [rec] = await prisma.$queryRawUnsafe(`SELECT * FROM staffmedical WHERE id = ?`, id);
  if (!rec) return respond.notFound(res, 'Record not found');
  if (rec.status !== 'Draft') return respond.badReq(res, 'Only Draft records can be finalized');
  const userId = req.user?.id ? Number(req.user.id) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE staffmedical SET status='Approved', approved_by=?, updatedAt=NOW() WHERE id=?`,
    userId, id
  );
  let glPayload = null;
  if ((await medicalPaymentsEnabled()) && glCfg.url()) {
    try {
      const gl  = await loadGLSettings();
      const [emp] = await prisma.$queryRawUnsafe(
        `SELECT TRIM(CONCAT_WS(' ', firstName, lastName)) AS name, bankAccount FROM employee WHERE id = ? LIMIT 1`, rec.employee
      ).catch(() => []);
      const result = await postStaffMedicalGL({
        id: String(id), prefix: 'STF', employeeName: emp?.name ?? String(rec.employee),
        illnessType: rec.type_of_illness, cost: rec.cost,
        approvedBy:    req.user?.username || req.user?.email || 'System',
        glExpense:     gl.expenseGl,
        creditAccount: emp?.bankAccount || '',
        branch:        gl.branch,
        currency:      gl.currency,
      });
      if (result) {
        glPayload = result._sentPayload;
        await prisma.$executeRawUnsafe(
          `UPDATE staffmedical SET document_ref=?, payment_log=? WHERE id=?`,
          result.documentRef, JSON.stringify(result.raw), id
        );
      }
    } catch (e) {
      const errData = e.glResponse || e.response?.data || e.message;
      console.error('[staff medical finalize] GL error:', errData);
      await prisma.$executeRawUnsafe(
        `UPDATE staffmedical SET status='GL Failed', payment_log=? WHERE id=?`,
        JSON.stringify({ error: errData }), id
      );
    }
  }
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM staffmedical WHERE id=?`, id);
  respond.ok(res, 'Finalized', { ...s(updated), gl_payload: glPayload });
});

// ── DEPENDENT MEDICAL — Action endpoints ──────────────────────────────────────

// POST /medical/dependent/:id/submit — move a Draft dependent medical record to Pending Approval.
exports.submitDependentMedical = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  if (!(await assertCanMutateMedical(req, res, 'dependentmedical', id, 'create_medical'))) return;
  const [rec] = await prisma.$queryRawUnsafe(`SELECT id, status FROM dependentmedical WHERE id = ?`, id);
  if (!rec) return respond.notFound(res, 'Record not found');
  if (rec.status !== 'Draft') return respond.badReq(res, 'Only Draft records can be submitted');
  const userId = req.user?.id ? Number(req.user.id) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE dependentmedical SET status='Pending Approval', submitted_by=? WHERE id=?`,
    userId, id
  );
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM dependentmedical WHERE id=?`, id);
  respond.ok(res, 'Submitted for approval', s(updated));
});

// POST /medical/dependent/:id/approve — approve a dependent medical claim and GL-post reimbursement to
// the employee's bank account. Sets status to 'GL Failed' on posting error for retry.
exports.approveDependentMedical = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const [rec] = await prisma.$queryRawUnsafe(`SELECT * FROM dependentmedical WHERE id = ?`, id);
  if (!rec) return respond.notFound(res, 'Record not found');
  if (rec.status !== 'Pending Approval') return respond.badReq(res, 'Record is not pending approval');
  if (!(await assertCanSelfApprove(req, res, rec))) return;
  const userId = req.user?.id ? Number(req.user.id) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE dependentmedical SET status='Approved', approved_by=? WHERE id=?`,
    userId, id
  );
  let glPayload = null;
  if ((await medicalPaymentsEnabled()) && glCfg.url()) {
    try {
      const gl  = await loadGLSettings();
      const [emp] = await prisma.$queryRawUnsafe(
        `SELECT TRIM(CONCAT_WS(' ', firstName, lastName)) AS name, bankAccount FROM employee WHERE id = ? LIMIT 1`, rec.employee
      ).catch(() => []);
      const desc = [rec.dependant_name, rec.type_of_illness].filter(Boolean).join(' - ');
      const result = await postStaffMedicalGL({
        id: String(id), prefix: 'DEP', employeeName: emp?.name ?? String(rec.employee),
        illnessType: desc, cost: rec.cost,
        approvedBy:    req.user?.username || req.user?.email || 'System',
        glExpense:     gl.expenseGl,
        creditAccount: emp?.bankAccount || '',
        branch:        gl.branch,
        currency:      gl.currency,
      });
      if (result) {
        glPayload = result._sentPayload;
        await prisma.$executeRawUnsafe(
          `UPDATE dependentmedical SET document_ref=?, payment_log=? WHERE id=?`,
          result.documentRef, JSON.stringify(result.raw), id
        );
      }
    } catch (e) {
      const errData = e.glResponse || e.response?.data || e.message;
      console.error('[dep medical approve] GL error:', errData);
      await prisma.$executeRawUnsafe(
        `UPDATE dependentmedical SET status='GL Failed', payment_log=? WHERE id=?`,
        JSON.stringify({ error: errData }), id
      );
    }
  }
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM dependentmedical WHERE id=?`, id);
  respond.ok(res, 'Approved', { ...s(updated), gl_payload: glPayload });
});

// POST /medical/dependent/:id/reject — reject a Pending Approval dependent medical record with an optional reason.
exports.rejectDependentMedical = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const { reason } = req.body;
  const [rec] = await prisma.$queryRawUnsafe(`SELECT id, status FROM dependentmedical WHERE id = ?`, id);
  if (!rec) return respond.notFound(res, 'Record not found');
  if (rec.status !== 'Pending Approval') return respond.badReq(res, 'Record is not pending approval');
  const userId = req.user?.id ? Number(req.user.id) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE dependentmedical SET status='Rejected', approved_by=?, rejection_reason=? WHERE id=?`,
    userId, reason?.trim() || null, id
  );
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM dependentmedical WHERE id=?`, id);
  respond.ok(res, 'Rejected', s(updated));
});

// POST /medical/dependent/:id/finalize — directly approve a Draft dependent record and GL-post in one step.
exports.finalizeDependentMedical = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const [rec] = await prisma.$queryRawUnsafe(`SELECT * FROM dependentmedical WHERE id = ?`, id);
  if (!rec) return respond.notFound(res, 'Record not found');
  if (rec.status !== 'Draft') return respond.badReq(res, 'Only Draft records can be finalized');
  const userId = req.user?.id ? Number(req.user.id) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE dependentmedical SET status='Approved', approved_by=? WHERE id=?`,
    userId, id
  );
  let glPayload = null;
  if ((await medicalPaymentsEnabled()) && glCfg.url()) {
    try {
      const gl  = await loadGLSettings();
      const [emp] = await prisma.$queryRawUnsafe(
        `SELECT TRIM(CONCAT_WS(' ', firstName, lastName)) AS name, bankAccount FROM employee WHERE id = ? LIMIT 1`, rec.employee
      ).catch(() => []);
      const desc = [rec.dependant_name, rec.type_of_illness].filter(Boolean).join(' - ');
      const result = await postStaffMedicalGL({
        id: String(id), prefix: 'DEP', employeeName: emp?.name ?? String(rec.employee),
        illnessType: desc, cost: rec.cost,
        approvedBy:    req.user?.username || req.user?.email || 'System',
        glExpense:     gl.expenseGl,
        creditAccount: emp?.bankAccount || '',
        branch:        gl.branch,
        currency:      gl.currency,
      });
      if (result) {
        glPayload = result._sentPayload;
        await prisma.$executeRawUnsafe(
          `UPDATE dependentmedical SET document_ref=?, payment_log=? WHERE id=?`,
          result.documentRef, JSON.stringify(result.raw), id
        );
      }
    } catch (e) {
      const errData = e.glResponse || e.response?.data || e.message;
      console.error('[dep medical finalize] GL error:', errData);
      await prisma.$executeRawUnsafe(
        `UPDATE dependentmedical SET status='GL Failed', payment_log=? WHERE id=?`,
        JSON.stringify({ error: errData }), id
      );
    }
  }
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM dependentmedical WHERE id=?`, id);
  respond.ok(res, 'Finalized', { ...s(updated), gl_payload: glPayload });
});

// ── GL Retry endpoints ────────────────────────────────────────────────────────

async function retryMedicalGL(table, id, req) {
  const [rec] = await prisma.$queryRawUnsafe(`SELECT * FROM ${table} WHERE id = ?`, id);
  if (!rec) return null;

  const gl = await loadGLSettings();
  const [emp] = await prisma.$queryRawUnsafe(
    `SELECT TRIM(CONCAT_WS(' ', firstName, lastName)) AS name, bankAccount FROM employee WHERE id = ? LIMIT 1`,
    rec.employee
  ).catch(() => []);

  const prefix   = table === 'staffmedical' ? 'STF' : 'DEP';
  const desc     = table === 'staffmedical'
    ? rec.type_of_illness
    : [rec.dependant_name, rec.type_of_illness].filter(Boolean).join(' - ');

  const result = await postStaffMedicalGL({
    id: String(id), prefix,
    employeeName:  emp?.name ?? String(rec.employee),
    illnessType:   desc,
    cost:          rec.cost,
    approvedBy:    req.user?.username || req.user?.email || 'System',
    glExpense:     gl.expenseGl,
    creditAccount: emp?.bankAccount || '',
    branch:        gl.branch,
    currency:      gl.currency,
  });
  return result;
}

// POST /medical/staff/:id/retry-gl — re-attempt GL posting for a staff medical record stuck in 'GL Failed'.
// Blocked if the GL already posted (document_ref exists) or POSTING_API_URL is not configured.
exports.retryStaffMedicalGL = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const [rec] = await prisma.$queryRawUnsafe(`SELECT id, status, document_ref FROM staffmedical WHERE id = ?`, id);
  if (!rec) return respond.notFound(res, 'Record not found');
  if (rec.status !== 'GL Failed') return respond.badReq(res, 'Only GL Failed records can retry posting');
  if (rec.document_ref) return respond.badReq(res, 'GL already posted for this record');
  if (!(await medicalPaymentsEnabled())) return respond.badReq(res, 'Medical GL posting is disabled in settings');
  if (!glCfg.url()) return respond.badReq(res, 'POSTING_API_URL not configured');
  try {
    const result = await retryMedicalGL('staffmedical', id, req);
    if (result) {
      await prisma.$executeRawUnsafe(
        `UPDATE staffmedical SET status='Approved', document_ref=?, payment_log=? WHERE id=?`,
        result.documentRef, JSON.stringify(result.raw), id
      );
    }
  } catch (e) {
    const errData = e.glResponse || e.response?.data || e.message;
    await prisma.$executeRawUnsafe(
      `UPDATE staffmedical SET payment_log=? WHERE id=?`,
      JSON.stringify({ error: errData }), id
    );
  }
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM staffmedical WHERE id=?`, id);
  respond.ok(res, 'GL retry complete', s(updated));
});

// POST /medical/dependent/:id/retry-gl — re-attempt GL posting for a dependent medical record stuck in 'GL Failed'.
exports.retryDependentMedicalGL = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const [rec] = await prisma.$queryRawUnsafe(`SELECT id, status, document_ref FROM dependentmedical WHERE id = ?`, id);
  if (!rec) return respond.notFound(res, 'Record not found');
  if (rec.status !== 'GL Failed') return respond.badReq(res, 'Only GL Failed records can retry posting');
  if (rec.document_ref) return respond.badReq(res, 'GL already posted for this record');
  if (!(await medicalPaymentsEnabled())) return respond.badReq(res, 'Medical GL posting is disabled in settings');
  if (!glCfg.url()) return respond.badReq(res, 'POSTING_API_URL not configured');
  try {
    const result = await retryMedicalGL('dependentmedical', id, req);
    if (result) {
      await prisma.$executeRawUnsafe(
        `UPDATE dependentmedical SET status='Approved', document_ref=?, payment_log=? WHERE id=?`,
        result.documentRef, JSON.stringify(result.raw), id
      );
    }
  } catch (e) {
    const errData = e.glResponse || e.response?.data || e.message;
    await prisma.$executeRawUnsafe(
      `UPDATE dependentmedical SET payment_log=? WHERE id=?`,
      JSON.stringify({ error: errData }), id
    );
  }
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM dependentmedical WHERE id=?`, id);
  respond.ok(res, 'GL retry complete', s(updated));
});

// POST /medical/hospital-claims/:id/retry-gl — re-attempt full GL posting for a hospital claim stuck in 'GL Failed';
// rebuilds the same debit/credit/WHT journal as the original approve.
exports.retryHospitalClaimGL = asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const [claim] = await prisma.$queryRawUnsafe(`
    SELECT hc.*, rh.name AS hospital_name, rh.account AS hospital_account
    FROM hospitalclaims hc
    JOIN registeredhospitals rh ON rh.id = hc.hospital
    WHERE hc.id = ? LIMIT 1
  `, id).catch(() => []);
  if (!claim) return respond.notFound(res, 'Claim not found');
  if (claim.status !== 'GL Failed') return respond.badReq(res, 'Only GL Failed claims can retry posting');
  if (claim.document_ref) return respond.badReq(res, 'GL already posted for this claim');
  if (!(await medicalPaymentsEnabled())) return respond.badReq(res, 'Medical GL posting is disabled in settings');
  if (!glCfg.url()) return respond.badReq(res, 'POSTING_API_URL not configured');

  try {
    const glRows = await prisma.$queryRawUnsafe(`SELECT name, value FROM settings WHERE category = ?`, GL_CAT).catch(() => []);
    const glMap  = Object.fromEntries(glRows.map(r => [r.name, r.value]));
    const expenseGl = glMap[GL_EXPENSE_KEY] || '';
    const whtGl     = glMap[GL_WHT_KEY]     || '';
    const branch    = glMap[GL_BRANCH_KEY]  || glCfg.branch();
    const currency  = glCfg.currency();
    let items = [];
    try { items = JSON.parse(claim.items ?? '[]'); } catch {}

    const debitAccounts = [];
    const creditAccounts = [];
    const approvedBy  = req.user?.username || req.user?.email || 'System';
    const referenceNo = `MC${id}${String(Date.now()).slice(-7)}`;

    if (expenseGl) {
      for (const item of items) {
        const amt = parseFloat(item.amount ?? 0);
        if (!amt || amt <= 0) continue;
        const narration = ['Medical', item.employee_name, item.type === 'dependent' ? `Dep: ${item.dependent_name}` : null, item.narration || null].filter(Boolean).join(' - ');
        debitAccounts.push({ debitAmount: amt, debitAccount: expenseGl, debitCurrency: currency, debitNarration: narration, debitProdRef: `MED_${id}_${item.employee_id}`, debitBranch: branch });
      }
    }
    const creditAmt = parseFloat(String(claim.total_credit_amount ?? 0));
    if (creditAmt > 0 && claim.hospital_account) {
      creditAccounts.push({ creditAmount: creditAmt, creditAccount: claim.hospital_account, creditCurrency: currency, creditNarration: `Hospital Payment - ${claim.hospital_name}`, creditProdRef: `MED_${id}`, creditBranch: branch });
    }
    const whtAmt = parseFloat(String(claim.withholding_tax ?? 0));
    if (whtAmt > 0 && whtGl) {
      creditAccounts.push({ creditAmount: whtAmt, creditAccount: whtGl, creditCurrency: currency, creditNarration: `WHT - ${claim.hospital_name}`, creditProdRef: `MED_${id}_WHT`, creditBranch: branch });
    }

    if (debitAccounts.length && creditAccounts.length) {
      const result = await postToGL({ approvedBy, referenceNo, debitAccounts, creditAccounts });
      await prisma.$executeRawUnsafe(
        `UPDATE hospitalclaims SET status='Approved', document_ref=?, payment_log=? WHERE id=?`,
        result.documentRef, JSON.stringify(result.raw), id
      );
    }
  } catch (e) {
    const errData = e.glResponse || e.response?.data || e.message;
    await prisma.$executeRawUnsafe(
      `UPDATE hospitalclaims SET payment_log=? WHERE id=?`,
      JSON.stringify({ error: errData }), id
    );
  }
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM hospitalclaims WHERE id = ?`, id);
  respond.ok(res, 'GL retry complete', s(updated));
});

// ── YEAR-END UTILIZATION RESET ──────────────────────────────────────────────────

// GET /medical/utilization/history — closing snapshots from past medical years.
// Optional ?period= filters to a single closed year.
exports.getUtilizationHistory = asyncHandler(async (req, res) => {
  const { period } = req.query;
  const rows = period
    ? await prisma.$queryRawUnsafe(
        `SELECT * FROM medicalutilizationhistory WHERE period_label = ? ORDER BY employee_name ASC`, String(period)
      ).catch(() => [])
    : await prisma.$queryRawUnsafe(
        `SELECT * FROM medicalutilizationhistory ORDER BY closed_at DESC, employee_name ASC`
      ).catch(() => []);
  respond.ok(res, 'Medical utilization history', rows.map(r => s(r)));
});

// POST /medical/utilization/reset — start a new medical year. Snapshots every active employee's
// current utilization into medicalutilizationhistory, then advances the reset point so the
// enquiries recompute from 0. Non-destructive: no medical records or GL postings are touched.
exports.resetMedicalUtilization = asyncHandler(async (req, res) => {
  const periodLabel = String(req.body?.period_label ?? '').trim() || String(new Date().getFullYear());

  // Block an accidental second close of the same year.
  const dup = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS n FROM medicalutilizationhistory WHERE period_label = ?`, periodLabel
  ).catch(() => [{ n: 0 }]);
  if (Number(dup?.[0]?.n ?? 0) > 0) {
    return respond.badReq(res, tmsg('medical.year_closed', { period: periodLabel }));
  }

  // Compute current utilization for every active employee (same logic as getMedicalEnquiry).
  const employees = await prisma.$queryRawUnsafe(`
    SELECT e.id, e.firstName, e.lastName, e.employee_id,
           pg.id AS pg_id, pg.name AS pg_name
    FROM employee e
    LEFT JOIN paygrades pg ON pg.id = e.paygradeId
    WHERE e.lifecycleStatus != 'TERMINATED'
    ORDER BY e.firstName ASC
  `);

  const limits = await prisma.$queryRawUnsafe(`SELECT * FROM medicallimit WHERE paygrade_id IS NOT NULL`);
  const limitByGrade = {};
  for (const lim of limits) { if (lim.paygrade_id) limitByGrade[String(lim.paygrade_id)] = lim; }

  const cut  = await getUtilizationCutoff();
  const frag = cutoffFragments(cut);
  const staffCosts = await prisma.$queryRawUnsafe(
    `SELECT employee, SUM(cost) as total FROM staffmedical WHERE status = 'Approved'${frag.staff} GROUP BY employee`
  );
  const depCosts = await prisma.$queryRawUnsafe(
    `SELECT employee, SUM(cost) as total FROM dependentmedical WHERE status = 'Approved'${frag.dep} GROUP BY employee`
  );
  const staffMap = Object.fromEntries((staffCosts ?? []).map(r => [String(r.employee), parseFloat(r.total ?? 0)]));
  const depMap   = Object.fromEntries((depCosts   ?? []).map(r => [String(r.employee), parseFloat(r.total ?? 0)]));

  const approvedClaims = await prisma.$queryRawUnsafe(
    `SELECT items FROM hospitalclaims WHERE status = 'Approved'${frag.claim}`
  ).catch(() => []);
  for (const claim of approvedClaims) {
    let claimItems = [];
    try { claimItems = JSON.parse(claim.items ?? '[]'); } catch {}
    for (const item of claimItems) {
      const empKey = String(item.employee_id);
      const amt    = parseFloat(item.amount ?? 0);
      if (item.type === 'dependent') depMap[empKey]   = (depMap[empKey]   ?? 0) + amt;
      else                           staffMap[empKey] = (staffMap[empKey] ?? 0) + amt;
    }
  }

  const now      = new Date();
  const closedBy = req.user?.id ? BigInt(req.user.id) : null;
  const { userName } = fromReq(req);

  let count = 0;
  for (const emp of employees) {
    const pgId      = emp.pg_id ? String(emp.pg_id) : null;
    const lim       = pgId ? limitByGrade[pgId] : null;
    const limit     = lim ? parseFloat(lim.amount ?? 0) : null;
    const currency  = lim?.currency ?? '';
    const staffUsed = staffMap[String(emp.id)] ?? 0;
    const depUsed   = depMap[String(emp.id)]   ?? 0;
    const utilized  = staffUsed + depUsed;
    const balance   = limit !== null ? limit - utilized : null;
    const name      = `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim();

    await prisma.$executeRawUnsafe(
      `INSERT INTO medicalutilizationhistory
         (period_label, employee_id, employee_name, grade, currency, medical_limit,
          staff_utilized, dep_utilized, total_utilized, limit_balance, closed_at, closed_by, closed_by_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      periodLabel, BigInt(emp.id), name, emp.pg_name ?? null, currency,
      limit, staffUsed, depUsed, utilized, balance, now, closedBy, userName ?? null
    );
    count++;
  }

  // Advance the reset point — from now on utilization recomputes from 0.
  await upsertSetting(RESET_AT_KEY, now.toISOString(), SETTINGS_CAT);

  logActivity({
    module: 'Medical', action: 'reset_utilization', entityName: periodLabel,
    details: { period_label: periodLabel, employees: count }, ...fromReq(req),
  });

  respond.ok(res, tmsg('medical.year_started', { count }), {
    period_label: periodLabel, employees: count,
  });
});
