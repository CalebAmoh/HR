const { prisma } = require('../helpers/dbQueryHelper');
const asyncHandler = require('../middleware/asyncHandler');
const respond = require('../helpers/respondHelper');

function serialize(obj) {
  if (typeof obj === 'bigint') return obj.toString();
  if (obj && typeof obj === 'object' && typeof obj.toString === 'function' && obj.constructor?.name === 'Decimal') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serialize);
  if (obj !== null && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serialize(v);
    return out;
  }
  return obj;
}

function toBigInt(val) {
  if (!val && val !== 0) return null;
  try { return BigInt(val); } catch { return null; }
}

function toDecimalString(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(4) : null;
}

async function query(sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return serialize(rows);
}

async function exec(sql, ...params) {
  return prisma.$executeRawUnsafe(sql, ...params);
}

// Auto-create tables on startup
(async () => {
  try {
    await exec(`CREATE TABLE IF NOT EXISTS calculationgroups (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      details TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await exec(`CREATE TABLE IF NOT EXISTS savedcalculations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      target_type VARCHAR(20) NOT NULL DEFAULT 'component',
      target_id BIGINT NULL,
      target_name VARCHAR(200) NULL,
      calculation_group_id BIGINT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await exec(`CREATE TABLE IF NOT EXISTS calculationprocessitems (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      saved_calculation_id BIGINT NOT NULL,
      lower_limit_condition VARCHAR(50) NOT NULL DEFAULT 'NO_LOWER_LIMIT',
      lower_limit DECIMAL(18,4) NULL,
      upper_limit_condition VARCHAR(50) NOT NULL DEFAULT 'NO_UPPER_LIMIT',
      upper_limit DECIMAL(18,4) NULL,
      value VARCHAR(200) NOT NULL DEFAULT '0',
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    // Migrate existing installations: widen value column to VARCHAR so formulas like X*0.05 can be stored
    await exec(`ALTER TABLE calculationprocessitems MODIFY COLUMN value VARCHAR(200) NOT NULL DEFAULT '0'`).catch(() => {});

    // Migrate payrollemployees.currency from BIGINT to VARCHAR (store code string like 'USD')
    await exec(`ALTER TABLE payrollemployees MODIFY COLUMN currency VARCHAR(20) NULL`).catch(() => {});

    // Add pay_frequency filter to payrollcolumns so each column can be restricted to a specific frequency
    await exec(`ALTER TABLE payrollcolumns ADD COLUMN pay_frequency INT NULL`).catch(() => {});

    // Add direct calculation rule assignment to payroll columns
    await exec(`ALTER TABLE payrollcolumns ADD COLUMN calculation_rule INT NULL`).catch(() => {});

    // Allow columns to be hidden from the report while still participating in calculations
    await exec(`ALTER TABLE payrollcolumns ADD COLUMN visible TINYINT(1) NOT NULL DEFAULT 1`).catch(() => {});

    // Control whether a column's value is included in the Net Pay calculation
    await exec(`ALTER TABLE payrollcolumns ADD COLUMN include_in_net TINYINT(1) NOT NULL DEFAULT 1`).catch(() => {});

    // GL posting branch code for this column (used during payroll finalization)
    await exec(`ALTER TABLE payrollcolumns ADD COLUMN posting_branch VARCHAR(20) NULL`).catch(() => {});

    // Short display name shown on payslips instead of the full column name
    await exec(`ALTER TABLE payrollcolumns ADD COLUMN payslip_label VARCHAR(100) NULL`).catch(() => {});

    await exec(`CREATE TABLE IF NOT EXISTS payfrequencies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(200) NULL,
      sort_order INT NOT NULL DEFAULT 99,
      is_active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    // Seed default pay frequencies if the table is empty
    const [{ cnt }] = await query('SELECT COUNT(*) AS cnt FROM payfrequencies');
    if (!Number(cnt)) {
      const defaults = [
        ['Weekly',       'Pay every week',          1],
        ['Bi-Weekly',    'Pay every two weeks',     2],
        ['Semi-Monthly', 'Pay twice per month',     3],
        ['Monthly',      'Pay once per month',      4],
        ['Quarterly',    'Pay every quarter',       5],
        ['Yearly',       'Pay once per year',       6],
      ];
      for (const [name, desc, sort] of defaults) {
        await exec('INSERT INTO payfrequencies (name, description, sort_order) VALUES (?, ?, ?)', name, desc, sort);
      }
    }
  } catch (e) {
    console.error('[calculationController] table init error:', e.message);
  }
})();

// ─── Payroll Columns ──────────────────────────────────────────────────────────

const getPayrollColumns = asyncHandler(async (_req, res) => {
  const rows = await query(`
    SELECT id, name,
           COALESCE(function_type, 'Simple') AS function_type,
           COALESCE(enabled,       'Yes')    AS enabled,
           COALESCE(editable,      'Yes')    AS editable,
           colorder, default_value, payment_deduction,
           salarycomponent_gl, posting_column, posting_branch, calculation_hook,
           deduction_group, salary_components, calculation_columns,
           add_columns, sub_columns, calculation_function, calculation_rule,
           COALESCE(visible, 1) AS visible, COALESCE(include_in_net, 1) AS include_in_net,
           payslip_label
    FROM payrollcolumns
    ORDER BY COALESCE(colorder, 9999) ASC, name ASC
  `);
  respond.ok(res, 'Payroll columns retrieved', rows);
});

const createPayrollColumn = asyncHandler(async (req, res) => {
  const {
    name, function_type = 'Simple', enabled = 'Yes', editable = 'Yes', colorder, default_value, payment_deduction,
    salarycomponent_gl, posting_column, posting_branch, calculation_hook, deduction_group,
    salary_components, calculation_columns, add_columns, sub_columns, calculation_function,
    calculation_rule, visible = 1, include_in_net = 1, payslip_label,
  } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Name is required');

  const dup = await query('SELECT id FROM payrollcolumns WHERE UPPER(name) = UPPER(?) LIMIT 1', name.trim());
  if (dup.length) return respond.conflict(res, 'A column with this name already exists');

  const [{ nextId }] = await query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM payrollcolumns');
  const colorderVal = (colorder !== undefined && colorder !== '')
    ? parseInt(colorder)
    : Number((await query('SELECT COALESCE(MAX(colorder), 0) + 1 AS nextOrder FROM payrollcolumns'))[0].nextOrder);
  await exec(
    `INSERT INTO payrollcolumns (
      id, name, function_type, enabled, editable, colorder, default_value, payment_deduction,
      salarycomponent_gl, posting_column, posting_branch, calculation_hook, deduction_group,
      salary_components, calculation_columns, add_columns, sub_columns, calculation_function,
      calculation_rule, visible, include_in_net, payslip_label
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    nextId, name.trim(), function_type, enabled, editable,
    colorderVal,
    default_value?.trim() || null,
    payment_deduction?.trim() || null,
    salarycomponent_gl?.trim() || null,
    posting_column?.trim() || 'Yes',
    posting_branch?.trim() || null,
    calculation_hook?.trim() || null,
    deduction_group ? toBigInt(deduction_group) : null,
    salary_components?.trim() || null,
    calculation_columns?.trim() || null,
    add_columns?.trim() || null,
    sub_columns?.trim() || null,
    calculation_function?.trim() || null,
    calculation_rule ? parseInt(calculation_rule) : null,
    visible !== undefined && visible !== '' ? parseInt(visible) : 1,
    include_in_net !== undefined && include_in_net !== '' ? parseInt(include_in_net) : 1,
    payslip_label?.trim() || null
  );
  const [created] = await query(`
    SELECT id, name, COALESCE(function_type,'Simple') AS function_type,
           COALESCE(enabled,'Yes') AS enabled, COALESCE(editable,'Yes') AS editable,
           colorder, default_value, payment_deduction,
           salarycomponent_gl, posting_column, posting_branch, calculation_hook,
           deduction_group, salary_components, calculation_columns,
           add_columns, sub_columns, calculation_function, calculation_rule,
           COALESCE(visible, 1) AS visible, COALESCE(include_in_net, 1) AS include_in_net,
           payslip_label
    FROM payrollcolumns WHERE id = ?`, nextId);
  respond.created(res, 'Payroll column created', created);
});

const updatePayrollColumn = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const {
    name, function_type, enabled, editable, colorder, default_value, payment_deduction,
    salarycomponent_gl, posting_column, posting_branch, calculation_hook, deduction_group,
    salary_components, calculation_columns, add_columns, sub_columns, calculation_function,
    calculation_rule, visible, include_in_net, payslip_label,
  } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Name is required');

  const existing = await query('SELECT id FROM payrollcolumns WHERE id = ? LIMIT 1', id);
  if (!existing.length) return respond.notFound(res, 'Payroll column not found');

  const dup = await query('SELECT id FROM payrollcolumns WHERE UPPER(name) = UPPER(?) AND id <> ? LIMIT 1', name.trim(), id);
  if (dup.length) return respond.conflict(res, 'A column with this name already exists');

  await exec(
    `UPDATE payrollcolumns SET
      name=?, function_type=?, enabled=?, editable=?, colorder=?, default_value=?, payment_deduction=?,
      salarycomponent_gl=?, posting_column=?, posting_branch=?, calculation_hook=?, deduction_group=?,
      salary_components=?, calculation_columns=?, add_columns=?, sub_columns=?, calculation_function=?,
      calculation_rule=?, visible=?, include_in_net=?, payslip_label=?
    WHERE id=?`,
    name.trim(), function_type || 'Simple', enabled || 'Yes', editable || 'Yes',
    colorder !== undefined && colorder !== '' ? parseInt(colorder) : null,
    default_value?.trim() || null,
    payment_deduction?.trim() || null,
    salarycomponent_gl?.trim() || null,
    posting_column?.trim() || 'Yes',
    posting_branch?.trim() || null,
    calculation_hook?.trim() || null,
    deduction_group ? toBigInt(deduction_group) : null,
    salary_components?.trim() || null,
    calculation_columns?.trim() || null,
    add_columns?.trim() || null,
    sub_columns?.trim() || null,
    calculation_function?.trim() || null,
    calculation_rule ? parseInt(calculation_rule) : null,
    visible !== undefined && visible !== '' ? parseInt(visible) : 1,
    include_in_net !== undefined && include_in_net !== '' ? parseInt(include_in_net) : 1,
    payslip_label?.trim() || null,
    id
  );
  const [updated] = await query(`
    SELECT id, name, COALESCE(function_type,'Simple') AS function_type,
           COALESCE(enabled,'Yes') AS enabled, COALESCE(editable,'Yes') AS editable,
           colorder, default_value, payment_deduction,
           salarycomponent_gl, posting_column, posting_branch, calculation_hook,
           deduction_group, salary_components, calculation_columns,
           add_columns, sub_columns, calculation_function, calculation_rule,
           COALESCE(visible, 1) AS visible, COALESCE(include_in_net, 1) AS include_in_net,
           payslip_label
    FROM payrollcolumns WHERE id = ?`, id);
  respond.ok(res, 'Payroll column updated', updated);
});

const deletePayrollColumn = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const existing = await query('SELECT id FROM payrollcolumns WHERE id = ? LIMIT 1', id);
  if (!existing.length) return respond.notFound(res, 'Payroll column not found');

  await exec('DELETE FROM payrollcolumns WHERE id = ?', id);
  respond.ok(res, 'Payroll column deleted');
});

const reorderPayrollColumns = asyncHandler(async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || !updates.length) return respond.badReq(res, 'Array of {id, colorder} required');
  for (const u of updates) {
    if (u.id == null || u.colorder == null) return respond.badReq(res, 'Each item needs id and colorder');
    await exec('UPDATE payrollcolumns SET colorder=? WHERE id=?', parseInt(u.colorder), toBigInt(u.id));
  }
  respond.ok(res, 'Column order updated');
});

// ─── Calculation Groups ───────────────────────────────────────────────────────

const getCalcGroups = asyncHandler(async (_req, res) => {
  const rows = await query('SELECT id, name, details, created_at FROM calculationgroups ORDER BY name ASC');
  respond.ok(res, 'Calculation groups retrieved', rows);
});

const createCalcGroup = asyncHandler(async (req, res) => {
  const { name, details } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Name is required');

  const dup = await query('SELECT id FROM calculationgroups WHERE UPPER(name) = UPPER(?) LIMIT 1', name.trim());
  if (dup.length) return respond.conflict(res, 'A calculation group with this name already exists');

  const [{ nextId }] = await query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM calculationgroups');
  await exec(
    'INSERT INTO calculationgroups (id, name, details) VALUES (?, ?, ?)',
    nextId, name.trim(), details?.trim() || null
  );
  const [created] = await query('SELECT id, name, details, created_at FROM calculationgroups WHERE id = ?', nextId);
  respond.created(res, 'Calculation group created', created);
});

const updateCalcGroup = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const { name, details } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Name is required');

  const existing = await query('SELECT id FROM calculationgroups WHERE id = ? LIMIT 1', id);
  if (!existing.length) return respond.notFound(res, 'Calculation group not found');

  const dup = await query('SELECT id FROM calculationgroups WHERE UPPER(name) = UPPER(?) AND id <> ? LIMIT 1', name.trim(), id);
  if (dup.length) return respond.conflict(res, 'A calculation group with this name already exists');

  await exec('UPDATE calculationgroups SET name = ?, details = ? WHERE id = ?', name.trim(), details?.trim() || null, id);
  const [updated] = await query('SELECT id, name, details, created_at FROM calculationgroups WHERE id = ?', id);
  respond.ok(res, 'Calculation group updated', updated);
});

const deleteCalcGroup = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const existing = await query('SELECT id FROM calculationgroups WHERE id = ? LIMIT 1', id);
  if (!existing.length) return respond.notFound(res, 'Calculation group not found');

  const inUse = await query('SELECT id FROM savedcalculations WHERE calculation_group_id = ? LIMIT 1', id);
  if (inUse.length) return respond.conflict(res, 'Cannot delete: group is in use by saved calculations');

  await exec('DELETE FROM calculationgroups WHERE id = ?', id);
  respond.ok(res, 'Calculation group deleted');
});

// ─── Saved Calculations ───────────────────────────────────────────────────────

const getSavedCalculations = asyncHandler(async (_req, res) => {
  const rows = await query(`
    SELECT sc.id, sc.name, sc.target_type, sc.target_id, sc.target_name, sc.calculation_group_id,
           cg.name AS group_name
    FROM savedcalculations sc
    LEFT JOIN calculationgroups cg ON cg.id = sc.calculation_group_id
    ORDER BY sc.name ASC
  `);
  respond.ok(res, 'Saved calculations retrieved', rows);
});

const getSavedCalculationById = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const rows = await query(`
    SELECT sc.id, sc.name, sc.target_type, sc.target_id, sc.target_name, sc.calculation_group_id,
           cg.name AS group_name
    FROM savedcalculations sc
    LEFT JOIN calculationgroups cg ON cg.id = sc.calculation_group_id
    WHERE sc.id = ? LIMIT 1
  `, id);
  if (!rows.length) return respond.notFound(res, 'Saved calculation not found');

  const items = await query(`
    SELECT id,
           lower_limit_condition, CAST(lower_limit AS CHAR) AS lower_limit,
           upper_limit_condition, CAST(upper_limit AS CHAR) AS upper_limit,
           value, sort_order
    FROM calculationprocessitems
    WHERE saved_calculation_id = ?
    ORDER BY sort_order ASC, id ASC
  `, id);

  respond.ok(res, 'Saved calculation retrieved', { ...rows[0], items });
});

const createSavedCalculation = asyncHandler(async (req, res) => {
  const { name, target_type, target_id, target_name, calculation_group_id, items = [] } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Name is required');
  if (!['component', 'column'].includes(target_type)) return respond.badReq(res, 'Invalid target type');

  const dup = await query('SELECT id FROM savedcalculations WHERE UPPER(name) = UPPER(?) LIMIT 1', name.trim());
  if (dup.length) return respond.conflict(res, 'A saved calculation with this name already exists');

  const [{ nextId }] = await query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM savedcalculations');
  const groupId = calculation_group_id ? toBigInt(calculation_group_id) : null;
  const targetId = target_id ? toBigInt(target_id) : null;

  await exec(
    'INSERT INTO savedcalculations (id, name, target_type, target_id, target_name, calculation_group_id) VALUES (?, ?, ?, ?, ?, ?)',
    nextId, name.trim(), target_type, targetId, target_name?.trim() || null, groupId
  );

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const [{ nextItemId }] = await query('SELECT COALESCE(MAX(id), 0) + 1 AS nextItemId FROM calculationprocessitems');
    await exec(
      `INSERT INTO calculationprocessitems
        (id, saved_calculation_id, lower_limit_condition, lower_limit, upper_limit_condition, upper_limit, value, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      nextItemId, nextId,
      item.lower_limit_condition || 'NO_LOWER_LIMIT',
      toDecimalString(item.lower_limit),
      item.upper_limit_condition || 'NO_UPPER_LIMIT',
      toDecimalString(item.upper_limit),
      item.value?.toString().trim() || '0',
      i
    );
  }

  const [created] = await query(
    'SELECT id, name, target_type, target_id, target_name, calculation_group_id FROM savedcalculations WHERE id = ?',
    nextId
  );
  respond.created(res, 'Saved calculation created', created);
});

const updateSavedCalculation = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const { name, target_type, target_id, target_name, calculation_group_id, items = [] } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Name is required');
  if (!['component', 'column'].includes(target_type)) return respond.badReq(res, 'Invalid target type');

  const existing = await query('SELECT id FROM savedcalculations WHERE id = ? LIMIT 1', id);
  if (!existing.length) return respond.notFound(res, 'Saved calculation not found');

  const dup = await query('SELECT id FROM savedcalculations WHERE UPPER(name) = UPPER(?) AND id <> ? LIMIT 1', name.trim(), id);
  if (dup.length) return respond.conflict(res, 'A saved calculation with this name already exists');

  const groupId = calculation_group_id ? toBigInt(calculation_group_id) : null;
  const targetId = target_id ? toBigInt(target_id) : null;

  await exec(
    'UPDATE savedcalculations SET name = ?, target_type = ?, target_id = ?, target_name = ?, calculation_group_id = ? WHERE id = ?',
    name.trim(), target_type, targetId, target_name?.trim() || null, groupId, id
  );

  await exec('DELETE FROM calculationprocessitems WHERE saved_calculation_id = ?', id);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const [{ nextItemId }] = await query('SELECT COALESCE(MAX(id), 0) + 1 AS nextItemId FROM calculationprocessitems');
    await exec(
      `INSERT INTO calculationprocessitems
        (id, saved_calculation_id, lower_limit_condition, lower_limit, upper_limit_condition, upper_limit, value, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      nextItemId, id,
      item.lower_limit_condition || 'NO_LOWER_LIMIT',
      toDecimalString(item.lower_limit),
      item.upper_limit_condition || 'NO_UPPER_LIMIT',
      toDecimalString(item.upper_limit),
      item.value?.toString().trim() || '0',
      i
    );
  }

  const [updated] = await query(
    'SELECT id, name, target_type, target_id, target_name, calculation_group_id FROM savedcalculations WHERE id = ?',
    id
  );
  respond.ok(res, 'Saved calculation updated', updated);
});

const deleteSavedCalculation = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');

  const existing = await query('SELECT id FROM savedcalculations WHERE id = ? LIMIT 1', id);
  if (!existing.length) return respond.notFound(res, 'Saved calculation not found');

  await exec('DELETE FROM calculationprocessitems WHERE saved_calculation_id = ?', id);
  await exec('DELETE FROM savedcalculations WHERE id = ?', id);
  respond.ok(res, 'Saved calculation deleted');
});

// ─── Pay Frequencies ─────────────────────────────────────────────────────────

const getPayFrequencies = asyncHandler(async (_req, res) => {
  const rows = await query('SELECT id, name, description, is_active, sort_order FROM payfrequencies ORDER BY sort_order ASC, name ASC');
  respond.ok(res, 'Pay frequencies retrieved', rows);
});

const createPayFrequency = asyncHandler(async (req, res) => {
  const { name, description, sort_order } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Name is required');
  const dup = await query('SELECT id FROM payfrequencies WHERE UPPER(name) = UPPER(?) LIMIT 1', name.trim());
  if (dup.length) return respond.conflict(res, 'A pay frequency with this name already exists');
  await exec(
    'INSERT INTO payfrequencies (name, description, sort_order) VALUES (?, ?, ?)',
    name.trim(), description?.trim() || null, sort_order != null && sort_order !== '' ? parseInt(sort_order) : 99
  );
  const [created] = await query('SELECT id, name, description, is_active, sort_order FROM payfrequencies WHERE id = LAST_INSERT_ID()');
  respond.created(res, 'Pay frequency created', created);
});

const updatePayFrequency = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const { name, description, sort_order, is_active } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Name is required');
  const existing = await query('SELECT id FROM payfrequencies WHERE id = ? LIMIT 1', id);
  if (!existing.length) return respond.notFound(res, 'Pay frequency not found');
  const dup = await query('SELECT id FROM payfrequencies WHERE UPPER(name) = UPPER(?) AND id <> ? LIMIT 1', name.trim(), id);
  if (dup.length) return respond.conflict(res, 'A pay frequency with this name already exists');
  await exec(
    'UPDATE payfrequencies SET name=?, description=?, sort_order=?, is_active=? WHERE id=?',
    name.trim(), description?.trim() || null,
    sort_order != null && sort_order !== '' ? parseInt(sort_order) : 99,
    is_active !== undefined ? (is_active ? 1 : 0) : 1,
    id
  );
  const [updated] = await query('SELECT id, name, description, is_active, sort_order FROM payfrequencies WHERE id = ?', id);
  respond.ok(res, 'Pay frequency updated', updated);
});

const deletePayFrequency = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const existing = await query('SELECT id FROM payfrequencies WHERE id = ? LIMIT 1', id);
  if (!existing.length) return respond.notFound(res, 'Pay frequency not found');
  const inUse = await query('SELECT id FROM payrollemployees WHERE pay_frequency = ? LIMIT 1', id);
  if (inUse.length) return respond.conflict(res, 'Cannot delete: frequency is used by payroll employees');
  await exec('DELETE FROM payfrequencies WHERE id = ?', id);
  respond.ok(res, 'Pay frequency deleted');
});

// ─── Payroll Employees ────────────────────────────────────────────────────────

const PE_SELECT = `
  SELECT pe.id, pe.employee,
         TRIM(CONCAT(IFNULL(e.firstName,''), ' ', IFNULL(e.lastName,''))) AS emp_name,
         pe.pay_frequency, pf.name AS freq_name,
         pe.currency,
         pe.deduction_group, cg.name AS group_name,
         pe.deduction_exemptions
  FROM payrollemployees pe
  LEFT JOIN employee e  ON e.id  = pe.employee
  LEFT JOIN payfrequencies pf ON pf.id = pe.pay_frequency
  LEFT JOIN calculationgroups cg ON cg.id = pe.deduction_group
`;

const getPayrollEmployees = asyncHandler(async (_req, res) => {
  const rows = await query(`${PE_SELECT} ORDER BY emp_name ASC`);
  respond.ok(res, 'Payroll employees retrieved', rows);
});

const createPayrollEmployee = asyncHandler(async (req, res) => {
  const { employee, pay_frequency, currency, deduction_group, deduction_exemptions } = req.body;
  if (!employee)      return respond.badReq(res, 'Employee is required');
  if (!pay_frequency) return respond.badReq(res, 'Pay frequency is required');
  if (!currency)      return respond.badReq(res, 'Currency is required');

  const empId = toBigInt(employee);
  const dup = await query('SELECT id FROM payrollemployees WHERE employee = ? LIMIT 1', empId);
  if (dup.length) return respond.conflict(res, 'This employee already has a payroll record');

  const [{ nextId }] = await query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM payrollemployees');
  await exec(
    'INSERT INTO payrollemployees (id, employee, pay_frequency, currency, deduction_group, deduction_exemptions) VALUES (?, ?, ?, ?, ?, ?)',
    nextId, empId, toBigInt(pay_frequency), currency?.trim() || null,
    deduction_group ? toBigInt(deduction_group) : null,
    deduction_exemptions?.trim() || null
  );
  const [created] = await query(`${PE_SELECT} WHERE pe.id = ?`, nextId);
  respond.created(res, 'Payroll employee created', created);
});

const updatePayrollEmployee = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const { employee, pay_frequency, currency, deduction_group, deduction_exemptions } = req.body;
  if (!employee)      return respond.badReq(res, 'Employee is required');
  if (!pay_frequency) return respond.badReq(res, 'Pay frequency is required');
  if (!currency)      return respond.badReq(res, 'Currency is required');

  const existing = await query('SELECT id FROM payrollemployees WHERE id = ? LIMIT 1', id);
  if (!existing.length) return respond.notFound(res, 'Payroll employee not found');

  const empId = toBigInt(employee);
  const dup = await query('SELECT id FROM payrollemployees WHERE employee = ? AND id <> ? LIMIT 1', empId, id);
  if (dup.length) return respond.conflict(res, 'This employee already has a payroll record');

  await exec(
    'UPDATE payrollemployees SET employee=?, pay_frequency=?, currency=?, deduction_group=?, deduction_exemptions=? WHERE id=?',
    empId, toBigInt(pay_frequency), currency?.trim() || null,
    deduction_group ? toBigInt(deduction_group) : null,
    deduction_exemptions?.trim() || null,
    id
  );
  const [updated] = await query(`${PE_SELECT} WHERE pe.id = ?`, id);
  respond.ok(res, 'Payroll employee updated', updated);
});

const deletePayrollEmployee = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const existing = await query('SELECT id FROM payrollemployees WHERE id = ? LIMIT 1', id);
  if (!existing.length) return respond.notFound(res, 'Payroll employee not found');
  await exec('DELETE FROM payrollemployees WHERE id = ?', id);
  respond.ok(res, 'Payroll employee deleted');
});

// ── Payslip templates ─────────────────────────────────────────────────────────
(async () => {
  await exec(`
    CREATE TABLE IF NOT EXISTS payslip_settings (
      id                 INT AUTO_INCREMENT PRIMARY KEY,
      template_name      VARCHAR(100) NOT NULL DEFAULT 'Default',
      deduction_group_id BIGINT NULL,
      company_name       VARCHAR(200) NULL,
      company_address    TEXT NULL,
      company_logo_url   VARCHAR(500) NULL,
      header_note        TEXT NULL,
      footer_note        TEXT NULL,
      accent_color       VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
      show_emp_id        TINYINT(1) NOT NULL DEFAULT 1,
      show_department    TINYINT(1) NOT NULL DEFAULT 1,
      show_position      TINYINT(1) NOT NULL DEFAULT 1,
      show_bank_account  TINYINT(1) NOT NULL DEFAULT 0,
      visible_columns    TEXT NULL,
      net_columns        TEXT NULL,
      payment_type_id    BIGINT NULL,
      updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `).catch(() => {});
  // Add new columns to existing installs that have the old single-row table
  await exec(`ALTER TABLE payslip_settings ADD COLUMN template_name VARCHAR(100) NOT NULL DEFAULT 'Default'`).catch(() => {});
  await exec(`ALTER TABLE payslip_settings ADD COLUMN deduction_group_id BIGINT NULL`).catch(() => {});
  await exec(`ALTER TABLE payslip_settings ADD COLUMN visible_columns TEXT NULL`).catch(() => {});
  await exec(`ALTER TABLE payslip_settings ADD COLUMN net_columns TEXT NULL`).catch(() => {});
  await exec(`ALTER TABLE payslip_settings ADD COLUMN payment_type_id BIGINT NULL`).catch(() => {});
  // Rename the fixed-id seed row to 'Default' if it exists
  await exec(`UPDATE payslip_settings SET template_name='Default' WHERE id=1 AND template_name=''`).catch(() => {});
})();

const PAYSLIP_SELECT = `
  SELECT ps.*, cg.name AS group_name, pt.name AS type_name
  FROM payslip_settings ps
  LEFT JOIN calculationgroups cg ON cg.id = ps.deduction_group_id
  LEFT JOIN paymenttype pt ON pt.id = ps.payment_type_id
  ORDER BY ps.id ASC
`;

const getPayslipTemplates = asyncHandler(async (_req, res) => {
  const rows = await query(PAYSLIP_SELECT);
  respond.ok(res, 'Payslip templates retrieved', rows);
});

const createPayslipTemplate = asyncHandler(async (req, res) => {
  const { template_name, deduction_group_id, payment_type_id, company_name, company_address, company_logo_url,
          header_note, footer_note, accent_color, show_emp_id, show_department,
          show_position, show_bank_account, visible_columns, net_columns } = req.body;
  if (!template_name?.trim()) return respond.badReq(res, 'Template name is required');
  await exec(
    `INSERT INTO payslip_settings
       (template_name, deduction_group_id, payment_type_id, company_name, company_address, company_logo_url,
        header_note, footer_note, accent_color, show_emp_id, show_department,
        show_position, show_bank_account, visible_columns, net_columns)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    template_name.trim(),
    deduction_group_id ? BigInt(deduction_group_id) : null,
    payment_type_id ? BigInt(payment_type_id) : null,
    company_name || null, company_address || null, company_logo_url || null,
    header_note || null, footer_note || null, accent_color || '#3B82F6',
    show_emp_id ? 1 : 0, show_department ? 1 : 0,
    show_position ? 1 : 0, show_bank_account ? 1 : 0,
    visible_columns?.length ? JSON.stringify(visible_columns) : null,
    net_columns?.length ? JSON.stringify(net_columns) : null
  );
  const rows = await query(PAYSLIP_SELECT);
  respond.created(res, 'Template created', rows[rows.length - 1] ?? null);
});

const updatePayslipTemplate = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  const { template_name, deduction_group_id, payment_type_id, company_name, company_address, company_logo_url,
          header_note, footer_note, accent_color, show_emp_id, show_department,
          show_position, show_bank_account, visible_columns, net_columns } = req.body;
  if (!template_name?.trim()) return respond.badReq(res, 'Template name is required');
  await exec(
    `UPDATE payslip_settings SET
       template_name=?, deduction_group_id=?, payment_type_id=?, company_name=?, company_address=?,
       company_logo_url=?, header_note=?, footer_note=?, accent_color=?,
       show_emp_id=?, show_department=?, show_position=?, show_bank_account=?,
       visible_columns=?, net_columns=?
     WHERE id=?`,
    template_name.trim(),
    deduction_group_id ? BigInt(deduction_group_id) : null,
    payment_type_id ? BigInt(payment_type_id) : null,
    company_name || null, company_address || null, company_logo_url || null,
    header_note || null, footer_note || null, accent_color || '#3B82F6',
    show_emp_id ? 1 : 0, show_department ? 1 : 0,
    show_position ? 1 : 0, show_bank_account ? 1 : 0,
    visible_columns?.length ? JSON.stringify(visible_columns) : null,
    net_columns?.length ? JSON.stringify(net_columns) : null,
    id
  );
  const [row] = await query(`${PAYSLIP_SELECT.replace('ORDER BY ps.id ASC', 'WHERE ps.id = ?')}`, id);
  respond.ok(res, 'Template updated', row ?? null);
});

const deletePayslipTemplate = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid ID');
  await exec('DELETE FROM payslip_settings WHERE id = ?', id);
  respond.ok(res, 'Template deleted', null);
});

module.exports = {
  getPayrollColumns, createPayrollColumn, updatePayrollColumn, deletePayrollColumn, reorderPayrollColumns,
  getPayFrequencies, createPayFrequency, updatePayFrequency, deletePayFrequency,
  getPayrollEmployees, createPayrollEmployee, updatePayrollEmployee, deletePayrollEmployee,
  getCalcGroups, createCalcGroup, updateCalcGroup, deleteCalcGroup,
  getSavedCalculations, getSavedCalculationById,
  createSavedCalculation, updateSavedCalculation, deleteSavedCalculation,
  getPayslipTemplates, createPayslipTemplate, updatePayslipTemplate, deletePayslipTemplate,
};
