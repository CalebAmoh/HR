const { prisma }    = require('../helpers/dbQueryHelper');
const asyncHandler  = require('../middleware/asyncHandler');
const respond       = require('../helpers/respondHelper');
const { tmsg }      = require('../helpers/messageStore');
const { toBigInt, s, safeAlter } = require('../helpers/controllerHelpers');

// Schema patches — per-slot seat cap; wider currency for CUR code-list labels (no-ops once applied)
safeAlter(`ALTER TABLE trainingcatalogslot ADD COLUMN max_seats INT NULL`);
safeAlter(`ALTER TABLE trainingcatalog MODIFY currency VARCHAR(50) NULL`);
safeAlter(`ALTER TABLE trainingnomination MODIFY currency VARCHAR(50) NULL`);

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const toDateStr = v => v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : null);

// True when the employee already has a nomination for the same training on the same start date.
// Rejected and No Show nominations don't block a re-application.
async function duplicateNominationExists(employee, trainingName, startDate, excludeId = null) {
  const params = [BigInt(employee), String(trainingName).trim(), new Date(startDate)];
  if (excludeId) params.push(excludeId);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM trainingnomination
     WHERE employee = ?
       AND LOWER(training_name) = LOWER(?)
       AND DATE(start_date) = DATE(?)
       AND status NOT IN ('Rejected', 'No Show')
       ${excludeId ? 'AND id != ?' : ''}
     LIMIT 1`,
    ...params
  ).catch(() => []);
  return rows.length > 0;
}

// Returns an error message when approving one more nomination would exceed the seat cap, else null.
// Slot caps (per start date) take precedence; courses without slots fall back to the course-level cap.
async function seatLimitViolation(catalogId, startDate) {
  if (!catalogId) return null;
  const cat = await prisma.trainingcatalog.findUnique({ where: { id: catalogId } }).catch(() => null);
  if (!cat) return null;

  const [slot] = await prisma.$queryRawUnsafe(
    `SELECT * FROM trainingcatalogslot WHERE catalog_id = ? AND start_date = DATE(?) LIMIT 1`,
    catalogId, new Date(startDate)
  ).catch(() => []);

  const max = slot ? (slot.max_seats != null ? Number(slot.max_seats) : null)
                   : (cat.max_seats  != null ? Number(cat.max_seats)  : null);
  if (max == null) return null;

  const [row] = await prisma.$queryRawUnsafe(
    slot
      ? `SELECT COUNT(*) AS cnt FROM trainingnomination WHERE training_catalog_id = ? AND DATE(start_date) = DATE(?) AND status = 'Approved'`
      : `SELECT COUNT(*) AS cnt FROM trainingnomination WHERE training_catalog_id = ? AND status = 'Approved'`,
    ...(slot ? [catalogId, new Date(startDate)] : [catalogId])
  ).catch(() => []);
  const taken = Number(row?.cnt ?? 0);

  if (taken >= max) {
    return slot
      ? `This training date is fully booked — all ${max} seats are taken`
      : `This training is fully booked — all ${max} seats are taken`;
  }
  return null;
}

// ── TRAINING CATALOG ──────────────────────────────────────────────────────────

// GET /training/catalog
exports.getCatalog = asyncHandler(async (req, res) => {
  // Screen access governs who can manage the catalog — ?all=1 (management view) includes inactive courses
  const showAll = req.query.all === '1';
  const where   = showAll ? {} : { is_active: true };
  const rows    = await prisma.trainingcatalog.findMany({ where, orderBy: { id: 'desc' } });

  if (!rows.length) return respond.ok(res, 'Training catalog', []);

  const ids = rows.map(r => r.id);
  const allSlots = await prisma.$queryRawUnsafe(
    `SELECT * FROM trainingcatalogslot WHERE catalog_id IN (${ids.join(',')}) ORDER BY start_date ASC`
  ).catch(() => []);

  // Approved-nomination counts per catalog course and start date (seats taken)
  const counts = await prisma.$queryRawUnsafe(
    `SELECT training_catalog_id AS cid, DATE(start_date) AS sd, COUNT(*) AS cnt
     FROM trainingnomination
     WHERE training_catalog_id IN (${ids.join(',')}) AND status = 'Approved'
     GROUP BY training_catalog_id, DATE(start_date)`
  ).catch(() => []);
  const slotTaken = {};
  const catTaken  = {};
  for (const c of counts) {
    slotTaken[`${c.cid}|${toDateStr(c.sd)}`] = Number(c.cnt);
    catTaken[String(c.cid)] = (catTaken[String(c.cid)] ?? 0) + Number(c.cnt);
  }

  const slotMap = {};
  for (const sl of allSlots) {
    const key   = String(sl.catalog_id);
    const taken = slotTaken[`${sl.catalog_id}|${toDateStr(sl.start_date)}`] ?? 0;
    const max   = sl.max_seats != null ? Number(sl.max_seats) : null;
    if (!slotMap[key]) slotMap[key] = [];
    slotMap[key].push({
      id:         String(sl.id),
      start_date: toDateStr(sl.start_date),
      end_date:   toDateStr(sl.end_date),
      venue:      sl.venue || null,
      max_seats:  max,
      seats_left: max != null ? Math.max(0, max - taken) : null,
    });
  }

  respond.ok(res, 'Training catalog', rows.map(r => {
    const max = r.max_seats != null ? Number(r.max_seats) : null;
    return {
      ...s(r),
      slots:      slotMap[String(r.id)] ?? [],
      seats_left: max != null ? Math.max(0, max - (catTaken[String(r.id)] ?? 0)) : null,
    };
  }));
});

// POST /training/catalog
exports.createCatalog = asyncHandler(async (req, res) => {
  const { code, name, category, type, provider, description, cost, currency, max_seats } = req.body;

  if (!code)     return respond.badReq(res, 'Course code is required');
  if (!name)     return respond.badReq(res, 'Course name is required');
  if (!category) return respond.badReq(res, 'Category is required');
  if (!type)     return respond.badReq(res, 'Type is required');

  const row = await prisma.trainingcatalog.create({
    data: {
      code:        String(code).trim(),
      name:        String(name).trim(),
      category:    String(category),
      type:        String(type),
      provider:    provider    ? String(provider).trim()    : null,
      description: description ? String(description).trim() : null,
      cost:        cost        ? parseFloat(cost)           : 0,
      currency:    currency    ? String(currency).trim()    : null,
      max_seats:   max_seats   ? parseInt(max_seats, 10)    : null,
      is_active:   true,
      created_by:  String(req.user?.username ?? req.user?.id ?? ''),
      created_at:  new Date(),
      updated_at:  new Date(),
    },
  });
  respond.created(res, 'Course created', { ...s(row), slots: [] });
});

// PUT /training/catalog/:id
exports.updateCatalog = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const { code, name, category, type, provider, description, cost, currency, max_seats, is_active } = req.body;

  const updated = await prisma.trainingcatalog.update({
    where: { id },
    data: {
      ...(code        !== undefined && { code:        String(code).trim() }),
      ...(name        !== undefined && { name:        String(name).trim() }),
      ...(category    !== undefined && { category:    String(category) }),
      ...(type        !== undefined && { type:        String(type) }),
      ...(provider    !== undefined && { provider:    provider ? String(provider).trim() : null }),
      ...(description !== undefined && { description: description ? String(description).trim() : null }),
      ...(cost        !== undefined && { cost:        parseFloat(cost) }),
      ...(currency    !== undefined && { currency:    currency ? String(currency).trim() : null }),
      ...(max_seats   !== undefined && { max_seats:   max_seats ? parseInt(max_seats, 10) : null }),
      ...(is_active   !== undefined && { is_active:   is_active === true || is_active === 'true' || is_active === 1 }),
      updated_at: new Date(),
    },
  });
  respond.ok(res, 'Course updated', s(updated));
});

// DELETE /training/catalog/:id
exports.deleteCatalog = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  await prisma.$executeRawUnsafe(`DELETE FROM trainingcatalogslot WHERE catalog_id = ?`, id);
  await prisma.trainingcatalog.delete({ where: { id } });
  respond.ok(res, 'Deleted');
});

// GET /training/catalog/:id/slots
exports.getCatalogSlots = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const slots = await prisma.$queryRawUnsafe(
    `SELECT * FROM trainingcatalogslot WHERE catalog_id = ? ORDER BY start_date ASC`, id
  ).catch(() => []);
  respond.ok(res, 'Slots', slots.map(sl => ({
    id:         String(sl.id),
    catalog_id: String(sl.catalog_id),
    start_date: toDateStr(sl.start_date),
    end_date:   toDateStr(sl.end_date),
    venue:      sl.venue || null,
    max_seats:  sl.max_seats != null ? Number(sl.max_seats) : null,
  })));
});

// POST /training/catalog/:id/slots — replace all slots for this course
exports.saveCatalogSlots = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const slots = Array.isArray(req.body.slots) ? req.body.slots : [];

  if (slots.some(sl => sl.start_date && !String(sl.venue ?? '').trim())) {
    return respond.badReq(res, 'Venue is required for each date slot');
  }

  await prisma.$executeRawUnsafe(`DELETE FROM trainingcatalogslot WHERE catalog_id = ?`, id);

  for (const sl of slots.filter(sl => sl.start_date)) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO trainingcatalogslot (catalog_id, start_date, end_date, venue, max_seats, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      id,
      new Date(sl.start_date),
      sl.end_date ? new Date(sl.end_date) : null,
      sl.venue    ? String(sl.venue).trim() : null,
      sl.max_seats ? parseInt(sl.max_seats, 10) : null
    );
  }
  respond.ok(res, 'Slots saved');
});

// ── TRAINING NOMINATIONS ──────────────────────────────────────────────────────

// GET /training/nominations
exports.getNominations = asyncHandler(async (req, res) => {
  // Screen access is controlled by menu/permission assignment on the client —
  // anyone who can open the approval list sees the full list. ?personal=1 returns own records only.
  const personalView = req.query.personal === '1';
  let rows;

  if (!personalView) {
    // Approval list: never show Drafts (they are private to the originator)
    rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM trainingnomination WHERE status != 'Draft' ORDER BY id DESC`
    );
  } else {
    // Personal view: join on users table; Drafts only visible when self-originated
    rows = await prisma.$queryRawUnsafe(
      `SELECT tn.* FROM trainingnomination tn
       INNER JOIN users u ON u.employeeId = tn.employee
       WHERE u.id = ? AND (tn.status != 'Draft' OR tn.nomination_type = 'Self')
       ORDER BY tn.id DESC`,
      Number(req.user?.id || 0)
    ).catch(err => { console.error('getNominations personal query failed:', err); return []; });
  }

  const em = await empMap(rows.map(r => r.employee));
  const um = await userMap([
    ...rows.map(r => r.nominated_by ? Number(r.nominated_by) : null),
    ...rows.map(r => r.approved_by  ? Number(r.approved_by)  : null),
  ]);

  respond.ok(res, 'Training nominations', rows.map(r => ({
    ...s(r),
    employee_name:    em[String(r.employee)]?.name        ?? null,
    employee_empid:   em[String(r.employee)]?.employee_id ?? null,
    nominated_by_name:um[String(r.nominated_by)] ?? null,
    approved_by_name: um[String(r.approved_by)]  ?? null,
    start_date:       toDateStr(r.start_date),
    end_date:         toDateStr(r.end_date),
    approved_at:      toDateStr(r.approved_at),
    completed_at:     toDateStr(r.completed_at),
  })));
});

// POST /training/nominations
exports.createNomination = asyncHandler(async (req, res) => {
  const {
    employee, training_catalog_id,
    training_name, provider, category, type,
    start_date, end_date, venue,
    cost, currency, nomination_type, notes,
  } = req.body;

  if (!employee)      return respond.badReq(res, 'Employee is required');
  if (!training_name) return respond.badReq(res, 'Training name is required');
  if (!start_date)    return respond.badReq(res, 'Start date is required');

  // Look up employee_id string
  const [emp] = await prisma.$queryRawUnsafe(
    `SELECT employee_id FROM employee WHERE id = ? LIMIT 1`,
    BigInt(employee)
  ).catch(() => []);
  const empId = emp?.employee_id ?? '';

  // Back-fill from catalog if linked
  let catName     = training_name;
  let catProvider = provider     ?? null;
  let catCategory = category     ?? null;
  let catType     = type         ?? null;
  let catCost     = cost         != null ? parseFloat(cost) : null;
  let catCurrency = currency     ?? null;
  let catalogId   = null;

  if (training_catalog_id) {
    catalogId = toBigInt(training_catalog_id);
    if (catalogId) {
      const cat = await prisma.trainingcatalog.findUnique({ where: { id: catalogId } }).catch(() => null);
      if (cat) {
        catName     = training_name || cat.name;
        catProvider = provider      ?? cat.provider ?? null;
        catCategory = category      ?? cat.category ?? null;
        catType     = type          ?? cat.type     ?? null;
        catCost     = cost != null  ? parseFloat(cost) : (cat.cost != null ? parseFloat(String(cat.cost)) : null);
        catCurrency = currency      ?? cat.currency ?? null;
      }
    }
  }

  if (await duplicateNominationExists(employee, catName, start_date)) {
    return respond.badReq(res, 'A nomination for this training on the same start date already exists for this employee');
  }

  const seatErr = await seatLimitViolation(catalogId, start_date);
  if (seatErr) return respond.badReq(res, seatErr);

  const row = await prisma.trainingnomination.create({
    data: {
      employee:            BigInt(employee),
      employee_id:         empId,
      training_catalog_id: catalogId,
      training_name:       String(catName).trim(),
      provider:            catProvider ? String(catProvider).trim() : null,
      category:            catCategory ? String(catCategory)        : null,
      type:                catType     ? String(catType)            : null,
      start_date:          new Date(start_date),
      end_date:            end_date ? new Date(end_date) : null,
      venue:               venue       ? String(venue).trim()       : null,
      cost:                catCost,
      currency:            catCurrency ? String(catCurrency).trim() : null,
      nomination_type:     nomination_type ? String(nomination_type) : 'Self',
      // Supervisor/Admin nominations are pre-approved at supervisor level
      status:              ['Supervisor', 'Admin'].includes(nomination_type) ? 'Pending HR Approval' : 'Draft',
      notes:               notes ? String(notes).trim() : null,
      nominated_by:        String(req.user?.id ?? ''),
      created_at:          new Date(),
      updated_at:          new Date(),
    },
  });

  respond.created(res, 'Nomination created', s(row));
});

// PUT /training/nominations/:id
exports.updateNomination = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const existing = await prisma.trainingnomination.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Nomination not found');
  if (existing.status !== 'Draft') return respond.badReq(res, 'Only Draft nominations can be edited');

  const {
    training_name, provider, category, type,
    start_date, end_date, venue, cost, currency,
    nomination_type, notes,
  } = req.body;

  const effName  = training_name !== undefined ? training_name : existing.training_name;
  const effStart = start_date    !== undefined ? start_date    : existing.start_date;
  if (await duplicateNominationExists(existing.employee, effName, effStart, id)) {
    return respond.badReq(res, 'A nomination for this training on the same start date already exists for this employee');
  }

  const updated = await prisma.trainingnomination.update({
    where: { id },
    data: {
      ...(training_name  !== undefined && { training_name:  String(training_name).trim() }),
      ...(provider       !== undefined && { provider:       provider ? String(provider).trim() : null }),
      ...(category       !== undefined && { category:       category ? String(category)        : null }),
      ...(type           !== undefined && { type:           type     ? String(type)            : null }),
      ...(start_date     !== undefined && { start_date:     new Date(start_date) }),
      ...(end_date       !== undefined && { end_date:       end_date ? new Date(end_date) : null }),
      ...(venue          !== undefined && { venue:          venue ? String(venue).trim() : null }),
      ...(cost           !== undefined && { cost:           cost != null ? parseFloat(cost) : null }),
      ...(currency       !== undefined && { currency:       currency ? String(currency).trim() : null }),
      ...(nomination_type !== undefined && { nomination_type: String(nomination_type) }),
      ...(notes          !== undefined && { notes:          notes ? String(notes).trim() : null }),
      updated_at: new Date(),
    },
  });
  respond.ok(res, 'Nomination updated', s(updated));
});

// DELETE /training/nominations/:id
exports.deleteNomination = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const existing = await prisma.trainingnomination.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Nomination not found');
  if (existing.status !== 'Draft') return respond.badReq(res, 'Only Draft nominations can be deleted');

  await prisma.trainingnomination.delete({ where: { id } });
  respond.ok(res, 'Deleted');
});

// ── TRAINING SETTINGS ─────────────────────────────────────────────────────────

async function readApprovalFlow() {
  try {
    const [row] = await prisma.$queryRawUnsafe(
      `SELECT setting_value FROM app_settings WHERE setting_key = 'training_approval_flow' LIMIT 1`
    );
    return row?.setting_value ?? 'direct';
  } catch { return 'direct'; }
}

exports.getTrainingSettings = asyncHandler(async (req, res) => {
  const approval_flow = await readApprovalFlow();
  respond.ok(res, 'Training settings', { approval_flow });
});

exports.saveTrainingSettings = asyncHandler(async (req, res) => {
  const flow = ['direct', 'supervisor_first'].includes(req.body.approval_flow)
    ? req.body.approval_flow : 'direct';
  await prisma.$executeRawUnsafe(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    'training_approval_flow', flow
  );
  respond.ok(res, 'Training settings saved');
});

// GET /training/subordinates
exports.getSubordinates = asyncHandler(async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT e.id, e.employee_id, TRIM(CONCAT_WS(' ', e.firstName, e.lastName)) AS name
     FROM employee e
     WHERE e.supervisorid = (SELECT employeeId FROM users WHERE id = ? LIMIT 1)
     AND e.status = '1'
     ORDER BY name ASC`,
    Number(req.user?.id || 0)
  ).catch(() => []);
  respond.ok(res, 'Subordinates', rows.map(r => ({
    id: String(r.id),
    employee_id: r.employee_id,
    name: r.name?.trim() || `Employee ${r.id}`,
  })));
});

// POST /training/nominations/:id/submit — Draft → Pending Supervisor Approval or Pending Approval
exports.submitNomination = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const existing = await prisma.trainingnomination.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Nomination not found');
  if (existing.status !== 'Draft') return respond.badReq(res, 'Only Draft nominations can be submitted');

  // Supervisor/Admin nominations bypass the supervisor stage
  const isBypassNom = ['Supervisor', 'Admin'].includes(existing.nomination_type ?? '');
  const flow = isBypassNom ? 'direct' : await readApprovalFlow();
  const nextStatus = flow === 'supervisor_first' ? 'Pending Supervisor Approval' : 'Pending HR Approval';

  await prisma.$executeRawUnsafe(
    `UPDATE trainingnomination SET status = ?, updated_at = NOW() WHERE id = ?`,
    nextStatus, id
  );
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM trainingnomination WHERE id = ?`, id);
  respond.ok(res, 'Submitted for approval', s(updated ?? {}));
});

// POST /training/nominations/:id/approve — Pending Approval → Approved
exports.approveNomination = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const existing = await prisma.trainingnomination.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Nomination not found');
  if (existing.status !== 'Pending HR Approval') return respond.badReq(res, 'Only Pending HR Approval nominations can be approved');

  const seatErr = await seatLimitViolation(existing.training_catalog_id, existing.start_date);
  if (seatErr) return respond.badReq(res, tmsg('training.approve_seat_error', { reason: seatErr.charAt(0).toLowerCase() + seatErr.slice(1) }));

  await prisma.$executeRawUnsafe(
    `UPDATE trainingnomination SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?`,
    'Approved', String(req.user?.id ?? ''), id
  );
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM trainingnomination WHERE id = ?`, id);
  respond.ok(res, 'Nomination approved', s(updated ?? {}));
});

// POST /training/nominations/:id/reject — Pending Approval → Rejected
exports.rejectNomination = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const existing = await prisma.trainingnomination.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Nomination not found');
  if (existing.status !== 'Pending HR Approval') return respond.badReq(res, 'Only Pending HR Approval nominations can be rejected');

  const reason = req.body?.reason ? String(req.body.reason).trim() : null;

  await prisma.$executeRawUnsafe(
    `UPDATE trainingnomination SET status = ?, approved_by = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?`,
    'Rejected', String(req.user?.id ?? ''), reason, id
  );
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM trainingnomination WHERE id = ?`, id);
  respond.ok(res, 'Nomination rejected', s(updated ?? {}));
});

// POST /training/nominations/:id/complete — Approved → Completed
exports.completeNomination = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const existing = await prisma.trainingnomination.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Nomination not found');
  if (existing.status !== 'Approved') return respond.badReq(res, 'Only Approved nominations can be marked complete');

  const score       = req.body?.score       != null ? parseFloat(req.body.score) : null;
  const certificate = req.body?.certificate ? String(req.body.certificate).trim() : null;

  await prisma.$executeRawUnsafe(
    `UPDATE trainingnomination SET status = ?, score = ?, certificate = ?, completed_at = NOW(), updated_at = NOW() WHERE id = ?`,
    'Completed', isNaN(score) ? null : score, certificate, id
  );
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM trainingnomination WHERE id = ?`, id);
  respond.ok(res, 'Marked as completed', s(updated ?? {}));
});

// POST /training/nominations/:id/no-show — Approved → No Show
exports.noShowNomination = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const existing = await prisma.trainingnomination.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Nomination not found');
  if (existing.status !== 'Approved') return respond.badReq(res, 'Only Approved nominations can be marked as No Show');

  await prisma.$executeRawUnsafe(
    `UPDATE trainingnomination SET status = ?, updated_at = NOW() WHERE id = ?`,
    'No Show', id
  );
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM trainingnomination WHERE id = ?`, id);
  respond.ok(res, 'Marked as No Show', s(updated ?? {}));
});

// POST /training/nominations/:id/supervisor-approve — Pending Supervisor Approval → Pending Approval
exports.supervisorApproveNomination = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const existing = await prisma.trainingnomination.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Nomination not found');
  if (existing.status !== 'Pending Supervisor Approval')
    return respond.badReq(res, 'Only Pending Supervisor Approval nominations can be approved here');

  await prisma.$executeRawUnsafe(
    `UPDATE trainingnomination SET status = ?, updated_at = NOW() WHERE id = ?`,
    'Pending HR Approval', id
  );
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM trainingnomination WHERE id = ?`, id);
  respond.ok(res, 'Approved — forwarded to HR for final approval', s(updated ?? {}));
});

// POST /training/nominations/:id/supervisor-reject — Pending Supervisor Approval → Rejected
exports.supervisorRejectNomination = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const existing = await prisma.trainingnomination.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Nomination not found');
  if (existing.status !== 'Pending Supervisor Approval')
    return respond.badReq(res, 'Only Pending Supervisor Approval nominations can be rejected here');

  const reason = req.body?.reason ? String(req.body.reason).trim() : null;

  await prisma.$executeRawUnsafe(
    `UPDATE trainingnomination SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?`,
    'Rejected', reason, id
  );
  const [updated] = await prisma.$queryRawUnsafe(`SELECT * FROM trainingnomination WHERE id = ?`, id);
  respond.ok(res, 'Nomination rejected', s(updated ?? {}));
});

// GET /training/nominations/subordinate — nominations for the current user's direct reports
exports.getSubordinateNominations = asyncHandler(async (req, res) => {
  const subordinates = await prisma.$queryRawUnsafe(
    `SELECT id FROM employee WHERE supervisorid = (SELECT employeeId FROM users WHERE id = ? LIMIT 1)`,
    Number(req.user?.id || 0)
  ).catch(() => []);

  if (!subordinates.length) return respond.ok(res, 'Subordinate nominations', []);

  const ids = subordinates.map(r => r.id);
  // Show all submitted records; Drafts only when supervisor originated them
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM trainingnomination WHERE employee IN (${ids.join(',')}) AND (status != 'Draft' OR nomination_type = 'Supervisor') ORDER BY id DESC`
  );

  const em = await empMap(rows.map(r => r.employee));
  const um = await userMap([
    ...rows.map(r => r.nominated_by ? Number(r.nominated_by) : null),
    ...rows.map(r => r.approved_by  ? Number(r.approved_by)  : null),
  ]);

  respond.ok(res, 'Subordinate nominations', rows.map(r => ({
    ...s(r),
    employee_name:    em[String(r.employee)]?.name        ?? null,
    employee_empid:   em[String(r.employee)]?.employee_id ?? null,
    nominated_by_name:um[String(r.nominated_by)] ?? null,
    approved_by_name: um[String(r.approved_by)]  ?? null,
    start_date:       toDateStr(r.start_date),
    end_date:         toDateStr(r.end_date),
    approved_at:      toDateStr(r.approved_at),
    completed_at:     toDateStr(r.completed_at),
  })));
});
