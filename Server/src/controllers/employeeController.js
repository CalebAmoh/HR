const axios = require('axios');
const { prisma } = require('../helpers/dbQueryHelper');
const asyncHandler = require('../middleware/asyncHandler');
const respond = require('../helpers/respondHelper');
const { logActivity, fromReq } = require('./auditController');

// ─── Lifecycle constants ───────────────────────────────────────────────────────
const LIFECYCLE = {
  PENDING:    'PENDING',
  ACTIVE:     'ACTIVE',
  SUSPENDED:  'SUSPENDED',
  TERMINATED: 'TERMINATED',
  RESIGNED:   'RESIGNED',
};

const APPROVAL = {
  PENDING:  'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeBigInt(obj) {
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (obj !== null && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serializeBigInt(v);
    return out;
  }
  return obj;
}

function toBigInt(val) {
  if (!val && val !== 0) return null;
  try { return BigInt(val); } catch { return null; }
}

/** Push employee data to the external HR system and record the result. */
async function pushEmployeeToExternalSystem(e) {
  const url = process.env.EMPLOYEE_SYNC_URL;
  if (!url) return;
  const id = toBigInt(e.id);
  if (!id) return;

  const fmtDate = d => d ? String(d).substring(0, 10) : '';
  const payload = {
    address1:          e.address1                 || '',
    address2:          '',
    alias:             e.employee_id              || '',
    approvedBy:        '',
    approvedDate:      fmtDate(e.approved_date),
    bankAccountNumber: e.bankAccount              || '',
    bankName:          '',
    branch:            e.branch?.comp_code         || '',
    check:             1,
    costCenter:        '',
    dateAppiont:       fmtDate(e.hireDate),
    dateOfBirth:       fmtDate(e.dateOfBirth),
    department:        e.department?.comp_code     || '',
    doe:               fmtDate(e.hireDate),
    emCode:            e.employee_id              || '',
    emType:            e.employmentStatus?.label  || '',
    employeeID:        e.employee_id              || '',
    employmentStatus:  e.employmentStatus?.label  || '',
    employmentType:    e.staffRole?.label         || '',
    endOfProb:         fmtDate(e.confirmationDate),
    fatherName:        e.father_name              || '',
    firstName:         e.firstName                || '',
    gender:            (e.gender?.label || '').charAt(0).toUpperCase(),
    lastName:          e.lastName                 || '',
    maritalStatus:     e.marital_status           || '',
    middleName:        e.middleName               || '',
    motherName:        e.mother_name              || '',
    nationality:       e.nationality?.label       || '',
    notch:             e.notch                    || '',
    notes:             '',
    phone:             e.mobilePhone              || '',
    phoneCountryCode:  '',
    placeOfBirth:      e.place_of_birth           || '',
    position:          e.jobTitleId               || '',
    postedBy:          e.posted_by                || '',
    proof:             '',
    spouse:            e.spouse_name              || '',
    ssn:               e.ssn_num                  || '',
    staffCat:          e.staffLevel?.label        || '',
    staffGrade:        e.paygradeId               || '',
    staffStatus:       e.lifecycleStatus          || '',
    supervisorID:      e.supervisor?.employee_id  || '',
    unit:              e.unit?.comp_code           || '',
    workEmail:         e.work_email               || '',
  };

  try {
    const r = await axios.post(url, payload, {
      headers: {
        'x-api-key':    process.env.POSTING_API_KEY    || '',
        'x-api-secret': process.env.POSTING_API_SECRET || '',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    console.log('[EmployeeSync] pushed', e.employee_id, '→ status:', r.status, '| response:', JSON.stringify(r.data));
    await prisma.$executeRawUnsafe(
      `UPDATE employee SET sync_status='synced', sync_error=NULL WHERE id=?`, id
    );
    return { success: true, httpStatus: r.status, data: r.data };
  } catch (err) {
    const msg = (err.response?.data ? JSON.stringify(err.response.data) : err.message) || 'Unknown error';
    console.error('[EmployeeSync] failed for', e.employee_id,
      '| http status:', err.response?.status,
      '| response:', JSON.stringify(err.response?.data),
      '| message:', err.message
    );
    await prisma.$executeRawUnsafe(
      `UPDATE employee SET sync_status='failed', sync_error=? WHERE id=?`,
      msg.substring(0, 500), id
    );
    return { success: false, httpStatus: err.response?.status, data: err.response?.data, message: err.message };
  }
}

/** Auto-generate employee ID from the BigInt primary key */
function makeEmployeeId(id) {
  const year = new Date().getFullYear();
  return `EMP-${year}-${String(id).padStart(4, '0')}`;
}

/**
 * Batch-resolve code list values and company structures referenced by employees.
 * Returns the same array of employees with extra shaped fields attached.
 */
async function enrichEmployees(employees) {
  // Collect all IDs to fetch
  const clvIds    = new Set();
  const structIds = new Set();
  const supIds    = new Set();
  const pgIds     = new Set();
  const ncIds     = new Set();

  for (const emp of employees) {
    [emp.titleId, emp.genderId, emp.nationalityId, emp.religionId,
     emp.jobTitleId, emp.employmentStatusId, emp.staff_level, emp.staff_role]
      .filter(Boolean).forEach(id => clvIds.add(id));
    [emp.departmentId, emp.branchId, emp.unitId, emp.outletId]
      .filter(Boolean).forEach(id => structIds.add(id));
    if (emp.supervisorId) supIds.add(emp.supervisorId);
    if (emp.paygradeId)   pgIds.add(emp.paygradeId);
    if (emp.notcheId)     ncIds.add(emp.notcheId);
  }

  // Batch fetch code list values
  const clvMap = {};
  if (clvIds.size > 0) {
    const vals = await prisma.codeListValue.findMany({
      where:  { id: { in: [...clvIds] } },
      select: { id: true, label: true, code: true },
    });
    vals.forEach(v => { clvMap[v.id] = v; });
  }

  // Batch fetch company structures
  const structMap = {};
  if (structIds.size > 0) {
    const structs = await prisma.companystructures.findMany({
      where:  { id: { in: [...structIds] } },
      select: { id: true, title: true, type: true, comp_code: true },
    });
    structs.forEach(s => { structMap[s.id.toString()] = serializeBigInt(s); });
  }

  // Batch fetch supervisors
  const supMap = {};
  if (supIds.size > 0) {
    const sups = await prisma.employee.findMany({
      where:  { id: { in: [...supIds] } },
      select: { id: true, firstName: true, lastName: true, employee_id: true },
    });
    sups.forEach(s => { supMap[s.id.toString()] = s; });
  }

  // Batch fetch paygrades
  const pgMap = {};
  if (pgIds.size > 0) {
    const pgs = await prisma.paygrades.findMany({
      where:  { id: { in: [...pgIds] } },
      select: { id: true, name: true },
    });
    pgs.forEach(p => { pgMap[p.id.toString()] = p.name; });
  }

  // Batch fetch notches
  const ncMap = {};
  if (ncIds.size > 0) {
    const ncs = await prisma.notches.findMany({
      where:  { id: { in: [...ncIds] } },
      select: { id: true, name: true },
    });
    ncs.forEach(n => { ncMap[n.id.toString()] = n.name; });
  }

  const mapCLV  = id => id ? (clvMap[id] ?? { id, label: null, code: null }) : null;
  const mapStruct = id => {
    if (!id) return null;
    const key = id.toString();
    return structMap[key] ?? { id: key, title: null };
  };
  const mapSup = id => {
    if (!id) return null;
    const s = supMap[id.toString()];
    return s ? { id: s.id.toString(), name: `${s.firstName} ${s.lastName}`, employee_id: s.employee_id } : null;
  };

  return employees.map(emp => ({
    ...serializeBigInt(emp),
    title:            mapCLV(emp.titleId),
    gender:           mapCLV(emp.genderId),
    nationality:      mapCLV(emp.nationalityId),
    religion:         mapCLV(emp.religionId),
    jobTitle:         mapCLV(emp.jobTitleId),
    employmentStatus: mapCLV(emp.employmentStatusId),
    staffLevel:       mapCLV(emp.staff_level),
    staffRole:        mapCLV(emp.staff_role),
    department:       mapStruct(emp.departmentId),
    branch:           mapStruct(emp.branchId),
    unit:             mapStruct(emp.unitId),
    outlet:           mapStruct(emp.outletId),
    supervisor:       mapSup(emp.supervisorId),
    paygrade:         emp.paygradeId ? (pgMap[emp.paygradeId.toString()] ?? null) : null,
    notch:            emp.notcheId   ? (ncMap[emp.notcheId.toString()]   ?? null) : null,
  }));
}

// ─── Controllers ──────────────────────────────────────────────────────────────

// GET /employees
const getAllEmployees = asyncHandler(async (req, res) => {
  const { search, lifecycle, approval } = req.query;

  const where = {};
  if (lifecycle) where.lifecycleStatus = lifecycle;
  if (approval)  where.approvalStatus  = approval;
  if (search) {
    where.OR = [
      { firstName:   { contains: search } },
      { lastName:    { contains: search } },
      { employee_id: { contains: search } },
      { email:       { contains: search } },
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  const enriched = await enrichEmployees(employees);
  respond.ok(res, 'Employees retrieved', enriched);
});

// GET /employees/active  — lightweight list for supervisor dropdowns
const getActiveEmployees = asyncHandler(async (req, res) => {
  const { search } = req.query;

  const where = { lifecycleStatus: LIFECYCLE.ACTIVE, approvalStatus: APPROVAL.APPROVED };
  if (search) {
    where.OR = [
      { firstName:   { contains: search } },
      { lastName:    { contains: search } },
      { employee_id: { contains: search } },
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
    select: {
      id: true, employee_id: true, firstName: true, lastName: true,
      jobTitleId: true,
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    take: 100,
  });

  // Resolve job titles
  const jtIds = [...new Set(employees.map(e => e.jobTitleId).filter(Boolean))];
  const jtMap = {};
  if (jtIds.length > 0) {
    const jts = await prisma.codeListValue.findMany({
      where: { id: { in: jtIds } }, select: { id: true, label: true },
    });
    jts.forEach(j => { jtMap[j.id] = j.label; });
  }

  respond.ok(res, 'Active employees retrieved', employees.map(e => ({
    id:          e.id.toString(),
    employee_id: e.employee_id,
    name:        `${e.firstName} ${e.lastName}`.trim(),
    jobTitle:    e.jobTitleId ? (jtMap[e.jobTitleId] ?? null) : null,
  })));
});

// GET /employees/:id
const getEmployeeById = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid employee ID');

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return respond.notFound(res, 'Employee not found');

  const [enriched] = await enrichEmployees([emp]);
  respond.ok(res, 'Employee retrieved', enriched);
});

// POST /employees
const createEmployee = asyncHandler(async (req, res) => {
  const d = req.body;

  // Required
  if (!d.firstName?.trim())      return respond.badReq(res, 'First name is required');
  if (!d.lastName?.trim())       return respond.badReq(res, 'Last name is required');
  if (!d.work_email?.trim())     return respond.badReq(res, 'Work email is required');
  if (!d.jobTitleId)             return respond.badReq(res, 'Job title is required');
  if (!d.employmentStatusId)     return respond.badReq(res, 'Employment status is required');

  const workEmail = d.work_email.trim().toLowerCase();

  // Email uniqueness (work_email is stored in both email and work_email columns)
  const dupe = await prisma.employee.findFirst({
    where: { OR: [{ email: workEmail }, { work_email: workEmail }] },
  });
  if (dupe) return respond.conflict(res, 'An employee with this work email already exists');

  if (d.personal_email?.trim()) {
    const pdupe = await prisma.employee.findUnique({ where: { personal_email: d.personal_email.trim().toLowerCase() } });
    if (pdupe) return respond.conflict(res, 'An employee with this personal email already exists');
  }

  // Validate code list IDs
  const clvIds = [
    d.titleId, d.genderId, d.nationalityId, d.religionId,
    d.jobTitleId, d.employmentStatusId, d.staff_level, d.staff_role,
  ].filter(Boolean);
  if (clvIds.length > 0) {
    const found = await prisma.codeListValue.findMany({
      where: { id: { in: clvIds }, isActive: true }, select: { id: true },
    });
    const foundSet = new Set(found.map(v => v.id));
    const missing = clvIds.filter(id => !foundSet.has(id));
    if (missing.length > 0) return respond.badReq(res, 'One or more selected options are invalid or inactive');
  }

  const postedBy = toBigInt(req.user?.id);

  // Step 1 — create without large blob fields to avoid max_allowed_packet issues
  const employee = await prisma.employee.create({
    data: {
      // Personal
      titleId:            d.titleId            || null,
      firstName:          d.firstName.trim(),
      middleName:         d.middleName?.trim() || null,
      lastName:           d.lastName.trim(),
      genderId:           d.genderId           || null,
      dateOfBirth:        d.dateOfBirth        ? new Date(d.dateOfBirth) : null,
      place_of_birth:     d.place_of_birth?.trim()   || null,
      nationalityId:      d.nationalityId      || null,
      religionId:         d.religionId         || null,
      marital_status:     d.marital_status     || null,
      spouse_name:        d.spouse_name?.trim()       || null,
      father_name:        d.father_name?.trim()       || null,
      mother_name:        d.mother_name?.trim()       || null,
      address1:           d.address1?.trim()   || null,
      city:               d.city?.trim()       || null,
      country:            d.country?.trim()    || null,
      // Contact
      email:              workEmail,
      work_email:         workEmail,
      personal_email:     d.personal_email?.trim().toLowerCase() || null,
      mobilePhone:        d.mobilePhone?.trim() || null,
      // Employment
      jobTitleId:         d.jobTitleId,
      employmentStatusId: d.employmentStatusId,
      staff_level:        d.staff_level        || null,
      staff_role:         d.staff_role         || null,
      ssn_num:            d.ssn_num?.trim()    || null,
      departmentId:       toBigInt(d.departmentId),
      branchId:           toBigInt(d.branchId),
      unitId:             toBigInt(d.unitId)        || null,
      outletId:           toBigInt(d.outletId)      || null,
      supervisorId:       toBigInt(d.supervisorId)  || null,
      hireDate:           d.hireDate           ? new Date(d.hireDate)           : null,
      confirmationDate:   d.confirmationDate   ? new Date(d.confirmationDate)   : null,
      // Next of Kin
      nxt_kin_fname:      d.nxt_kin_fname?.trim()   || null,
      nxt_kin_phone:      d.nxt_kin_phone?.trim()   || null,
      nxt_kin_email:      d.nxt_kin_email?.trim()   || null,
      nxt_kin_address:    d.nxt_kin_address?.trim() || null,
      // Financial
      bankAccount:        d.bankAccount?.trim()     || null,
      paygradeId:         toBigInt(d.paygradeId)   || null,
      notcheId:           toBigInt(d.notcheId)     || null,
      // Documents (identity only — no blobs)
      nationalIdNumber:   d.nationalIdNumber?.trim()  || null,
      nationalIdExpiry:   d.nationalIdExpiry  ? new Date(d.nationalIdExpiry)  : null,
      passportNumber:     d.passportNumber?.trim()    || null,
      passportExpiry:     d.passportExpiry    ? new Date(d.passportExpiry)    : null,
      driverLicenseNum:   d.driverLicenseNum?.trim()  || null,
      driverLicenseExp:   d.driverLicenseExp  ? new Date(d.driverLicenseExp)  : null,
      // System
      posted_by:          postedBy,
      approvalStatus:     APPROVAL.PENDING,
      lifecycleStatus:    LIFECYCLE.PENDING,
      status:             '1',
    },
  });

  // Step 2 — set employee_id + document filenames (short references, not blobs)
  const employeeId = d.employee_id?.trim() || makeEmployeeId(employee.id);
  await prisma.employee.update({
    where: { id: employee.id },
    data: {
      employee_id:      employeeId,
      fit_and_proper:   d.fit_and_proper   || null,
      policeClearance:  d.policeClearance  || null,
      medicalClearance: d.medicalClearance || null,
    },
  });

  const refreshed = await prisma.employee.findUnique({ where: { id: employee.id } });
  const [enriched] = await enrichEmployees([refreshed]);
  logActivity({ module: 'Employees', action: 'create', entityId: String(employee.id), entityName: `${d.firstName} ${d.lastName}`, ...fromReq(req) });
  respond.created(res, 'Employee created successfully. Awaiting approval.', enriched);
});

// PUT /employees/:id
const updateEmployee = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid employee ID');

  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Employee not found');

  const d = req.body;
  const updateData = { updatedAt: new Date() };

  // Personal
  if ('firstName'          in d) updateData.firstName          = d.firstName?.trim()          || existing.firstName;
  if ('middleName'         in d) updateData.middleName         = d.middleName?.trim()         || null;
  if ('lastName'           in d) updateData.lastName           = d.lastName?.trim()           || existing.lastName;
  if ('titleId'            in d) updateData.titleId            = d.titleId                    || null;
  if ('genderId'           in d) updateData.genderId           = d.genderId                   || null;
  if ('nationalityId'      in d) updateData.nationalityId      = d.nationalityId              || null;
  if ('religionId'         in d) updateData.religionId         = d.religionId                 || null;
  if ('dateOfBirth'        in d) updateData.dateOfBirth        = d.dateOfBirth ? new Date(d.dateOfBirth) : null;
  if ('place_of_birth'     in d) updateData.place_of_birth     = d.place_of_birth?.trim()     || null;
  if ('marital_status'     in d) updateData.marital_status     = d.marital_status             || null;
  if ('spouse_name'        in d) updateData.spouse_name        = d.spouse_name?.trim()        || null;
  if ('father_name'        in d) updateData.father_name        = d.father_name?.trim()        || null;
  if ('mother_name'        in d) updateData.mother_name        = d.mother_name?.trim()        || null;
  if ('address1'           in d) updateData.address1           = d.address1?.trim()           || null;
  if ('city'               in d) updateData.city               = d.city?.trim()               || null;
  if ('country'            in d) updateData.country            = d.country?.trim()            || null;
  if ('mobilePhone'        in d) updateData.mobilePhone        = d.mobilePhone?.trim()        || null;
  // Employment
  if ('jobTitleId'         in d) updateData.jobTitleId         = d.jobTitleId                 || null;
  if ('employmentStatusId' in d) updateData.employmentStatusId = d.employmentStatusId          || null;
  if ('staff_level'        in d) updateData.staff_level        = d.staff_level                || null;
  if ('staff_role'         in d) updateData.staff_role         = d.staff_role                 || null;
  if ('ssn_num'            in d) updateData.ssn_num            = d.ssn_num?.trim()            || null;
  if ('departmentId'       in d) updateData.departmentId       = toBigInt(d.departmentId);
  if ('branchId'           in d) updateData.branchId           = toBigInt(d.branchId);
  if ('unitId'             in d) updateData.unitId             = toBigInt(d.unitId);
  if ('outletId'           in d) updateData.outletId           = toBigInt(d.outletId);
  if ('supervisorId'       in d) updateData.supervisorId       = toBigInt(d.supervisorId);
  if ('hireDate'           in d) updateData.hireDate           = d.hireDate         ? new Date(d.hireDate)         : null;
  if ('confirmationDate'   in d) updateData.confirmationDate   = d.confirmationDate ? new Date(d.confirmationDate) : null;
  // Next of Kin
  if ('nxt_kin_fname'      in d) updateData.nxt_kin_fname      = d.nxt_kin_fname?.trim()      || null;
  if ('nxt_kin_phone'      in d) updateData.nxt_kin_phone      = d.nxt_kin_phone?.trim()      || null;
  if ('nxt_kin_email'      in d) updateData.nxt_kin_email      = d.nxt_kin_email?.trim()      || null;
  if ('nxt_kin_address'    in d) updateData.nxt_kin_address    = d.nxt_kin_address?.trim()    || null;
  // Financial
  if ('bankAccount'            in d) updateData.bankAccount        = d.bankAccount?.trim()           || null;
  if ('paygradeId'             in d) updateData.paygradeId         = toBigInt(d.paygradeId)          || null;
  if ('notcheId'               in d) updateData.notcheId           = toBigInt(d.notcheId)            || null;
  // Profile photo
  if ('profile_imagebase64'    in d) updateData.profile_imagebase64 = d.profile_imagebase64          || null;
  // Documents
  if ('nationalIdNumber'   in d) updateData.nationalIdNumber   = d.nationalIdNumber?.trim()  || null;
  if ('nationalIdExpiry'   in d) updateData.nationalIdExpiry   = d.nationalIdExpiry  ? new Date(d.nationalIdExpiry)  : null;
  if ('passportNumber'     in d) updateData.passportNumber     = d.passportNumber?.trim()    || null;
  if ('passportExpiry'     in d) updateData.passportExpiry     = d.passportExpiry    ? new Date(d.passportExpiry)    : null;
  if ('driverLicenseNum'   in d) updateData.driverLicenseNum   = d.driverLicenseNum?.trim()  || null;
  if ('driverLicenseExp'   in d) updateData.driverLicenseExp   = d.driverLicenseExp  ? new Date(d.driverLicenseExp)  : null;
  if ('fit_and_proper'     in d) updateData.fit_and_proper     = d.fit_and_proper               || null;
  if ('policeClearance'    in d) updateData.policeClearance    = d.policeClearance              || null;
  if ('medicalClearance'   in d) updateData.medicalClearance   = d.medicalClearance             || null;

  // Work email update (keeps email column in sync for login)
  if ('work_email' in d && d.work_email?.trim()) {
    const we = d.work_email.trim().toLowerCase();
    if (we !== existing.work_email) {
      const dupe = await prisma.employee.findFirst({ where: { OR: [{ email: we }, { work_email: we }], NOT: { id } } });
      if (dupe) return respond.conflict(res, 'Work email already in use by another employee');
    }
    updateData.email      = we;
    updateData.work_email = we;
  }

  if ('personal_email' in d) {
    const pe = d.personal_email?.trim().toLowerCase() || null;
    if (pe && pe !== existing.personal_email) {
      const dupe = await prisma.employee.findUnique({ where: { personal_email: pe } });
      if (dupe) return respond.conflict(res, 'Personal email already in use by another employee');
    }
    updateData.personal_email = pe;
  }

  // Every update resets the employee to pending approval
  updateData.approvalStatus  = APPROVAL.PENDING;
  updateData.lifecycleStatus = LIFECYCLE.PENDING;
  updateData.actionReason    = null;

  await prisma.employee.update({ where: { id }, data: updateData });
  await prisma.$executeRawUnsafe(
    `UPDATE employee SET sync_status=NULL, sync_error=NULL WHERE id=?`, id
  );

  const refreshed = await prisma.employee.findUnique({ where: { id } });
  const [enriched] = await enrichEmployees([refreshed]);
  logActivity({ module: 'Employees', action: 'update', entityId: String(id), entityName: `${existing.firstName} ${existing.lastName}`, ...fromReq(req) });
  respond.ok(res, 'Employee updated', enriched);
});

// PUT /employees/:id/approve
const approveEmployee = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid employee ID');

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return respond.notFound(res, 'Employee not found');
  if (emp.approvalStatus !== APPROVAL.PENDING)
    return respond.badReq(res, `Employee is already ${emp.approvalStatus.toLowerCase()}`);

  const approvedBy = toBigInt(req.user?.id);
  await prisma.employee.update({
    where: { id },
    data:  {
      approvalStatus:  APPROVAL.APPROVED,
      lifecycleStatus: LIFECYCLE.ACTIVE,
      approved_date:   new Date(),
      approved_by:     approvedBy,
      updatedAt:       new Date(),
    },
  });

  const refreshed = await prisma.employee.findUnique({ where: { id } });
  const [enriched] = await enrichEmployees([refreshed]);
  logActivity({ module: 'Employees', action: 'approve', entityId: String(id), entityName: `${emp.firstName} ${emp.lastName}`, ...fromReq(req) });
  const syncResult = await pushEmployeeToExternalSystem(enriched);
  res.status(200).json({ status: '200', message: 'Employee approved and is now active', data: enriched, syncResult });
});

// PUT /employees/:id/status  — suspend | terminate | reinstate
const changeEmployeeStatus = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid employee ID');

  const { status, reason } = req.body;
  const validStatuses = [LIFECYCLE.ACTIVE, LIFECYCLE.SUSPENDED, LIFECYCLE.TERMINATED];
  if (!validStatuses.includes(status))
    return respond.badReq(res, `Status must be one of: ${validStatuses.join(', ')}`);

  if ([LIFECYCLE.SUSPENDED, LIFECYCLE.TERMINATED].includes(status) && !reason?.trim())
    return respond.badReq(res, `A reason is required when setting status to ${status}`);

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return respond.notFound(res, 'Employee not found');

  if (emp.approvalStatus !== APPROVAL.APPROVED)
    return respond.badReq(res, 'Cannot change status of an unapproved employee');
  if (emp.lifecycleStatus === LIFECYCLE.TERMINATED)
    return respond.badReq(res, 'Terminated employees cannot be modified');
  if (emp.lifecycleStatus === LIFECYCLE.RESIGNED)
    return respond.badReq(res, 'Resigned employees cannot be modified');

  await prisma.employee.update({
    where: { id },
    data: {
      lifecycleStatus: status,
      actionReason:    reason?.trim() || null,
      status:          status === LIFECYCLE.TERMINATED ? '0' : '1',
      updatedAt:       new Date(),
    },
  });

  const refreshed = await prisma.employee.findUnique({ where: { id } });
  const [enriched] = await enrichEmployees([refreshed]);
  logActivity({ module: 'Employees', action: status.toLowerCase(), entityId: String(id), entityName: `${emp.firstName} ${emp.lastName}`, details: { reason }, ...fromReq(req) });
  respond.ok(res, `Employee status changed to ${status}`, enriched);
});

// POST /employees/:id/resign
const initiateResignation = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid employee ID');

  const { reason, effectiveDate } = req.body;

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return respond.notFound(res, 'Employee not found');
  if (emp.approvalStatus !== APPROVAL.APPROVED)
    return respond.badReq(res, 'Employee is not yet approved');
  if (emp.lifecycleStatus !== LIFECYCLE.ACTIVE)
    return respond.badReq(res, 'Only active employees can initiate resignation');

  await prisma.employee.update({
    where: { id },
    data: {
      lifecycleStatus: LIFECYCLE.RESIGNED,
      actionReason:    reason?.trim() || 'Resignation initiated',
      status:          '0',
      updatedAt:       new Date(),
    },
  });

  const refreshed = await prisma.employee.findUnique({ where: { id } });
  const [enriched] = await enrichEmployees([refreshed]);
  logActivity({ module: 'Employees', action: 'resign', entityId: String(id), entityName: `${emp.firstName} ${emp.lastName}`, details: { reason, effectiveDate }, ...fromReq(req) });
  respond.ok(res, 'Resignation recorded', enriched);
});

// GET /paygrades
const getAllPaygrades = asyncHandler(async (req, res) => {
  const rows = await prisma.paygrades.findMany({
    select: { id: true, name: true, currency: true, min_salary: true, max_salary: true },
    orderBy: { name: 'asc' },
  });
  respond.ok(res, 'Paygrades retrieved', rows.map(r => ({ ...serializeBigInt(r) })));
});

// GET /notches
const getAllNotches = asyncHandler(async (req, res) => {
  const rows = await prisma.notches.findMany({
    select: { id: true, name: true, paygrade: true, currency: true, amount: true },
    orderBy: { name: 'asc' },
  });
  respond.ok(res, 'Notches retrieved', rows.map(r => ({
    ...serializeBigInt(r),
    amount: r.amount ? r.amount.toString() : null,
  })));
});

// PUT /employees/:id/reject
const rejectEmployee = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid employee ID');

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return respond.notFound(res, 'Employee not found');
  if (emp.approvalStatus !== APPROVAL.PENDING)
    return respond.badReq(res, `Employee is already ${emp.approvalStatus.toLowerCase()}`);

  const { reason } = req.body;
  await prisma.employee.update({
    where: { id },
    data:  {
      approvalStatus: APPROVAL.REJECTED,
      actionReason:   reason?.trim() || null,
      updatedAt:      new Date(),
    },
  });

  logActivity({ module: 'Employees', action: 'reject', entityId: String(id), entityName: `${emp.firstName} ${emp.lastName}`, reason: reason || null, ...fromReq(req) });
  respond.ok(res, 'Employee application rejected');
});

// POST /employees/:id/sync — manual retry of external system push
const syncEmployee = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid employee ID');

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return respond.notFound(res, 'Employee not found');
  if (emp.approvalStatus !== APPROVAL.APPROVED)
    return respond.badReq(res, 'Only approved employees can be synced');

  const [enriched] = await enrichEmployees([emp]);
  await pushEmployeeToExternalSystem(enriched);

  const updated = await prisma.employee.findUnique({ where: { id } });
  if (updated?.sync_status === 'failed')
    return respond.badReq(res, `Sync failed: ${updated.sync_error || 'Unknown error'}`);

  respond.ok(res, 'Employee synced successfully');
});

module.exports = {
  getAllEmployees,
  getActiveEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  approveEmployee,
  rejectEmployee,
  changeEmployeeStatus,
  initiateResignation,
  getAllPaygrades,
  getAllNotches,
  syncEmployee,
};
