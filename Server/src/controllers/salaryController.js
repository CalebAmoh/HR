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

function toInt(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toDecimalString(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

async function query(sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return serialize(rows);
}

async function exec(sql, ...params) {
  return prisma.$executeRawUnsafe(sql, ...params);
}

// ── Auto-add is_notch_linked column if missing ────────────────────────────────
(async () => {
  try {
    const { prisma: _p } = require('../helpers/dbQueryHelper');
    await _p.$executeRawUnsafe(`ALTER TABLE salarycomponent ADD COLUMN is_notch_linked TINYINT(1) NOT NULL DEFAULT 0`).catch(() => {});
  } catch (e) { /* ignore */ }
})();

// Salary component types use raw SQL because the Prisma model is @@ignore.
const getSalaryComponentTypes = asyncHandler(async (_req, res) => {
  const rows = await query('SELECT id, code, name, description FROM salarycomponenttype ORDER BY name ASC');
  respond.ok(res, 'Salary component types retrieved', rows);
});

const createSalaryComponentType = asyncHandler(async (req, res) => {
  const { code, name, description } = req.body;
  if (!code?.trim()) return respond.badReq(res, 'Code is required');
  if (!name?.trim()) return respond.badReq(res, 'Name is required');

  const dup = await query('SELECT id FROM salarycomponenttype WHERE UPPER(code) = UPPER(?) LIMIT 1', code.trim());
  if (dup.length) return respond.conflict(res, 'Component type code already exists');

  const [{ nextId }] = await query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM salarycomponenttype');
  await exec(
    'INSERT INTO salarycomponenttype (id, code, name, description) VALUES (?, ?, ?, ?)',
    nextId,
    code.trim().toUpperCase(),
    name.trim(),
    description?.trim() || null
  );
  const [created] = await query('SELECT id, code, name, description FROM salarycomponenttype WHERE id = ?', nextId);
  respond.created(res, 'Salary component type created', created);
});

const updateSalaryComponentType = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid component type ID');
  const { code, name, description } = req.body;
  if (!code?.trim()) return respond.badReq(res, 'Code is required');
  if (!name?.trim()) return respond.badReq(res, 'Name is required');

  const existing = await query('SELECT id FROM salarycomponenttype WHERE id = ? LIMIT 1', id);
  if (!existing.length) return respond.notFound(res, 'Salary component type not found');
  const dup = await query('SELECT id FROM salarycomponenttype WHERE UPPER(code) = UPPER(?) AND id <> ? LIMIT 1', code.trim(), id);
  if (dup.length) return respond.conflict(res, 'Component type code already exists');

  await exec(
    'UPDATE salarycomponenttype SET code = ?, name = ?, description = ? WHERE id = ?',
    code.trim().toUpperCase(),
    name.trim(),
    description?.trim() || null,
    id
  );
  const [updated] = await query('SELECT id, code, name, description FROM salarycomponenttype WHERE id = ?', id);
  respond.ok(res, 'Salary component type updated', updated);
});

const deleteSalaryComponentType = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid component type ID');
  const inUse = await prisma.salarycomponent.count({ where: { componentType: id } });
  if (inUse) return respond.badReq(res, 'Cannot delete: component type is used by salary components');
  await exec('DELETE FROM salarycomponenttype WHERE id = ?', id);
  respond.ok(res, 'Salary component type deleted', null);
});

const getSalaryComponents = asyncHandler(async (_req, res) => {
  const rows = await query(`
    SELECT sc.id, sc.name, sc.salarycomp_gl, sc.branch, sc.summary, sc.processing_code,
           sc.componentType, sc.details, sc.is_notch_linked,
           sct.name AS componentTypeName
    FROM salarycomponent sc
    LEFT JOIN salarycomponenttype sct ON sct.id = sc.componentType
    ORDER BY sc.name ASC
  `);
  respond.ok(res, 'Salary components retrieved', rows);
});

const createSalaryComponent = asyncHandler(async (req, res) => {
  const { name, componentType, details, salarycomp_gl, branch, summary, processing_code, is_notch_linked } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Name is required');
  const isNotchLinked = is_notch_linked ? 1 : 0;
  if (isNotchLinked) {
    await exec(`UPDATE salarycomponent SET is_notch_linked = 0`);
  }
  await exec(
    `INSERT INTO salarycomponent (name, componentType, details, salarycomp_gl, branch, summary, processing_code, is_notch_linked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    name.trim(),
    toBigInt(componentType),
    details?.trim() || null,
    salarycomp_gl?.trim() || null,
    branch?.trim() || null,
    summary?.trim() || null,
    processing_code?.trim() || null,
    isNotchLinked
  );
  const [row] = await query(
    `SELECT sc.id, sc.name, sc.salarycomp_gl, sc.branch, sc.summary, sc.processing_code,
            sc.componentType, sc.details, sc.is_notch_linked,
            sct.name AS componentTypeName
     FROM salarycomponent sc
     LEFT JOIN salarycomponenttype sct ON sct.id = sc.componentType
     ORDER BY sc.id DESC LIMIT 1`
  );
  respond.created(res, 'Salary component created', row);
});

const updateSalaryComponent = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid salary component ID');
  const [existing] = await query(`SELECT id, name, is_notch_linked FROM salarycomponent WHERE id = ? LIMIT 1`, id);
  if (!existing) return respond.notFound(res, 'Salary component not found');
  const { name, componentType, details, salarycomp_gl, branch, summary, processing_code, is_notch_linked } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Name is required');

  const isNotchLinked = is_notch_linked ? 1 : 0;
  if (isNotchLinked) {
    await exec(`UPDATE salarycomponent SET is_notch_linked = 0 WHERE id != ?`, id);
  }

  await exec(
    `UPDATE salarycomponent
     SET name=?, componentType=?, details=?, salarycomp_gl=?, branch=?, summary=?, processing_code=?, is_notch_linked=?
     WHERE id=?`,
    name.trim(),
    toBigInt(componentType),
    details?.trim() || null,
    salarycomp_gl?.trim() || null,
    branch?.trim() || null,
    summary?.trim() || null,
    processing_code?.trim() || null,
    isNotchLinked,
    id
  );

  // Cascade rename: update anywhere the old name is stored as a plain string.
  const oldName = existing.name;
  const newName = name.trim();
  if (oldName !== newName) {
    // Fix salary_components CSV on every payroll column that referenced the old name.
    const cols = await query('SELECT id, salary_components FROM payrollcolumns WHERE salary_components IS NOT NULL');
    for (const col of cols) {
      const parts = col.salary_components.split(',').map(s => s.trim());
      const updated = parts.map(p => p.toLowerCase() === oldName.toLowerCase() ? newName : p);
      if (updated.some((p, i) => p !== parts[i])) {
        await exec('UPDATE payrollcolumns SET salary_components = ? WHERE id = ?', updated.join(', '), BigInt(col.id));
      }
    }
    await exec(
      `UPDATE savedcalculations SET target_name = ? WHERE target_type = 'component' AND LOWER(target_name) = LOWER(?)`,
      newName, oldName
    );
  }

  const [row] = await query(
    `SELECT sc.id, sc.name, sc.salarycomp_gl, sc.branch, sc.summary, sc.processing_code,
            sc.componentType, sc.details, sc.is_notch_linked,
            sct.name AS componentTypeName
     FROM salarycomponent sc
     LEFT JOIN salarycomponenttype sct ON sct.id = sc.componentType
     WHERE sc.id = ?`, id
  );
  respond.ok(res, 'Salary component updated', row);
});

const deleteSalaryComponent = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid salary component ID');
  const inUse = await prisma.employeesalary.count({ where: { component: id } });
  if (inUse) return respond.badReq(res, 'Cannot delete: component is assigned to employees');
  await prisma.salarycomponent.delete({ where: { id } });
  respond.ok(res, 'Salary component deleted', null);
});

const getEmployeeSalaryComponents = asyncHandler(async (_req, res) => {
  const rows = await query(`
    SELECT es.id, es.employee, es.component, es.working_days, es.pay_frequency, es.currency,
           CAST(es.amount AS CHAR) AS amount,
           CAST(es.original_amount AS CHAR) AS original_amount,
           TRIM(CONCAT(IFNULL(e.firstName,''), ' ', IFNULL(e.lastName,''))) AS emp_name,
           e.employee_id,
           sc.name AS component_name
    FROM employeesalary es
    LEFT JOIN employee e ON e.id = es.employee
    LEFT JOIN salarycomponent sc ON sc.id = es.component
    ORDER BY es.id DESC
  `);
  const data = rows.map(r => ({
    ...r,
    employeeName: r.emp_name ? (r.emp_name + (r.employee_id ? ` (${r.employee_id})` : '')) : null,
    componentName: r.component_name ?? null,
  }));
  respond.ok(res, 'Employee salary components retrieved', data);
});

async function enrichEmployeeSalaries(rows) {
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const enriched = await query(`
    SELECT es.id, es.employee, es.component, es.working_days, es.pay_frequency, es.currency,
           CAST(es.amount AS CHAR) AS amount,
           CAST(es.original_amount AS CHAR) AS original_amount,
           TRIM(CONCAT(IFNULL(e.firstName,''), ' ', IFNULL(e.lastName,''))) AS emp_name,
           e.employee_id,
           sc.name AS component_name
    FROM employeesalary es
    LEFT JOIN employee e ON e.id = es.employee
    LEFT JOIN salarycomponent sc ON sc.id = es.component
    WHERE es.id IN (${ids.map(() => '?').join(',')})
  `, ...ids.map(BigInt));
  return enriched.map(r => ({
    ...r,
    employeeName: r.emp_name ? (r.emp_name + (r.employee_id ? ` (${r.employee_id})` : '')) : null,
    componentName: r.component_name ?? null,
  }));
}

// ── Salary history ────────────────────────────────────────────────────────────
(async () => {
  await exec(`
    CREATE TABLE IF NOT EXISTS salary_history (
      id             BIGINT AUTO_INCREMENT PRIMARY KEY,
      employee_id    BIGINT NOT NULL,
      component_id   BIGINT NOT NULL,
      component_name VARCHAR(200) NULL,
      action         ENUM('created','updated','deleted') NOT NULL,
      old_amount     VARCHAR(30) NULL,
      new_amount     VARCHAR(30) NULL,
      old_currency   VARCHAR(10) NULL,
      new_currency   VARCHAR(10) NULL,
      changed_by     VARCHAR(200) NULL,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
})();

async function recordHistory({ employeeId, componentId, componentName, action, oldAmount, newAmount, oldCurrency, newCurrency, changedBy }) {
  await exec(
    `INSERT INTO salary_history (employee_id, component_id, component_name, action, old_amount, new_amount, old_currency, new_currency, changed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    BigInt(employeeId), BigInt(componentId), componentName || null, action,
    oldAmount || null, newAmount || null, oldCurrency || null, newCurrency || null, changedBy || null
  ).catch(() => {});
}

const getEmployeeSalaryHistory = asyncHandler(async (req, res) => {
  const empId = toBigInt(req.params.employeeId);
  if (!empId) return respond.badReq(res, 'Invalid employee ID');
  const rows = await query(
    `SELECT id, employee_id, component_id, component_name, action, old_amount, new_amount, old_currency, new_currency, changed_by, created_at
     FROM salary_history WHERE employee_id = ? ORDER BY created_at DESC LIMIT 200`,
    empId
  );
  respond.ok(res, 'Salary history retrieved', rows);
});

const createEmployeeSalaryComponent = asyncHandler(async (req, res) => {
  const { employee, component, working_days, pay_frequency, currency, amount } = req.body;
  const employeeId = toBigInt(employee);
  const componentId = toBigInt(component);
  if (!employeeId) return respond.badReq(res, 'Employee is required');
  if (!componentId) return respond.badReq(res, 'Component is required');
  const amountValue = toDecimalString(amount);
  const originalAmount = amountValue === null ? null : String(Math.round(Number(amountValue)));
  const row = await prisma.employeesalary.create({
    data: {
      employee: employeeId,
      component: componentId,
      working_days: toInt(working_days),
      pay_frequency: pay_frequency || null,
      currency: toBigInt(currency),
      amount: amountValue,
      original_amount: originalAmount,
    },
  });
  const [enriched] = await enrichEmployeeSalaries([row]);
  await recordHistory({
    employeeId, componentId, componentName: enriched?.component_name,
    action: 'created', newAmount: amountValue,
    newCurrency: enriched?.currency ? String(enriched.currency) : null,
    changedBy: req.user?.username || req.user?.email || null,
  });
  respond.created(res, 'Employee salary component created', enriched);
});

const updateEmployeeSalaryComponent = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid employee salary component ID');
  const existing = await prisma.employeesalary.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Employee salary component not found');
  const { employee, component, working_days, pay_frequency, currency, amount } = req.body;
  const employeeId = toBigInt(employee);
  const componentId = toBigInt(component);
  if (!employeeId) return respond.badReq(res, 'Employee is required');
  if (!componentId) return respond.badReq(res, 'Component is required');
  const amountValue = toDecimalString(amount);
  const row = await prisma.employeesalary.update({
    where: { id },
    data: {
      employee: employeeId,
      component: componentId,
      working_days: toInt(working_days),
      pay_frequency: pay_frequency || null,
      currency: toBigInt(currency),
      amount: amountValue,
    },
  });
  const [enriched] = await enrichEmployeeSalaries([row]);
  await recordHistory({
    employeeId, componentId, componentName: enriched?.component_name,
    action: 'updated',
    oldAmount: existing.amount != null ? String(existing.amount) : null,
    newAmount: amountValue,
    oldCurrency: existing.currency ? String(existing.currency) : null,
    newCurrency: toBigInt(currency) ? String(toBigInt(currency)) : null,
    changedBy: req.user?.username || req.user?.email || null,
  });
  respond.ok(res, 'Employee salary component updated', enriched);
});

const deleteEmployeeSalaryComponent = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid employee salary component ID');
  const existing = await prisma.employeesalary.findUnique({ where: { id } });
  if (existing) {
    const [comp] = await query('SELECT name FROM salarycomponent WHERE id = ? LIMIT 1', BigInt(existing.component));
    await recordHistory({
      employeeId: existing.employee, componentId: existing.component,
      componentName: comp?.name || null,
      action: 'deleted',
      oldAmount: existing.amount != null ? String(existing.amount) : null,
      oldCurrency: existing.currency ? String(existing.currency) : null,
      changedBy: req.user?.username || req.user?.email || null,
    });
  }
  await prisma.employeesalary.delete({ where: { id } });
  respond.ok(res, 'Employee salary component deleted', null);
});

const getNotches = asyncHandler(async (_req, res) => {
  const rows = await query(
    'SELECT id, name, paygrade, currency, CAST(amount AS CHAR) AS amount FROM notches ORDER BY name ASC'
  );
  respond.ok(res, 'Notches retrieved', rows);
});

const createNotch = asyncHandler(async (req, res) => {
  const { name, paygrade, currency, amount } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Notch name is required');
  if (!paygrade?.trim()) return respond.badReq(res, 'Paygrade is required');

  const amountVal = toDecimalString(amount);
  if (amountVal !== null) {
    const dup = await query('SELECT id FROM notches WHERE paygrade = ? AND amount = ? LIMIT 1', paygrade.trim(), amountVal);
    if (dup.length) return respond.conflict(res, 'A notch with this amount already exists for this paygrade');

    const [pg] = await query(
      'SELECT CAST(min_salary AS CHAR) AS min_salary, CAST(max_salary AS CHAR) AS max_salary FROM paygrades WHERE name = ? LIMIT 1',
      paygrade.trim()
    );
    if (pg && pg.min_salary != null && pg.max_salary != null) {
      const amt = Number(amountVal);
      const min = Number(pg.min_salary);
      const max = Number(pg.max_salary);
      if (amt < min || amt > max) {
        return respond.badReq(res, `Amount must be between ${min.toLocaleString()} and ${max.toLocaleString()} for paygrade "${paygrade.trim()}"`);
      }
    }
  }

  const row = await prisma.notches.create({
    data: { name: name.trim(), paygrade: paygrade.trim(), currency: currency?.trim() || null, amount: amountVal },
  });
  respond.created(res, 'Notch created', serialize(row));
});

const updateNotch = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid notch ID');
  const { name, paygrade, currency, amount } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Notch name is required');
  if (!paygrade?.trim()) return respond.badReq(res, 'Paygrade is required');

  const amountVal = toDecimalString(amount);
  if (amountVal !== null) {
    const dup = await query('SELECT id FROM notches WHERE paygrade = ? AND amount = ? AND id != ? LIMIT 1', paygrade.trim(), amountVal, id);
    if (dup.length) return respond.conflict(res, 'A notch with this amount already exists for this paygrade');

    const [pg] = await query(
      'SELECT CAST(min_salary AS CHAR) AS min_salary, CAST(max_salary AS CHAR) AS max_salary FROM paygrades WHERE name = ? LIMIT 1',
      paygrade.trim()
    );
    if (pg && pg.min_salary != null && pg.max_salary != null) {
      const amt = Number(amountVal);
      const min = Number(pg.min_salary);
      const max = Number(pg.max_salary);
      if (amt < min || amt > max) {
        return respond.badReq(res, `Amount must be between ${min.toLocaleString()} and ${max.toLocaleString()} for paygrade "${paygrade.trim()}"`);
      }
    }
  }

  const row = await prisma.notches.update({
    where: { id },
    data: { name: name.trim(), paygrade: paygrade.trim(), currency: currency?.trim() || null, amount: amountVal },
  });
  respond.ok(res, 'Notch updated', serialize(row));
});

const deleteNotch = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid notch ID');
  await prisma.notches.delete({ where: { id } });
  respond.ok(res, 'Notch deleted', null);
});

// ─── Paygrades ────────────────────────────────────────────────────────────────

// Widen paygrades.currency once so labels like "Cedis" (>3 chars) fit.
// Safe to run on every startup — MODIFY COLUMN is a no-op if already wide enough.
(async () => {
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `paygrades` MODIFY COLUMN `currency` VARCHAR(50) NOT NULL DEFAULT \'\''
    );
  } catch { /* column already correct or table doesn't exist yet */ }
})();

const getPaygrades = asyncHandler(async (_req, res) => {
  const rows = await query(
    'SELECT id, name, currency, CAST(min_salary AS CHAR) AS min_salary, CAST(max_salary AS CHAR) AS max_salary FROM paygrades ORDER BY name ASC'
  );
  respond.ok(res, 'Paygrades retrieved', rows);
});

const createPaygrade = asyncHandler(async (req, res) => {
  const { name, currency, min_salary, max_salary } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Paygrade name is required');
  if (!currency?.trim()) return respond.badReq(res, 'Currency is required');

  const dup = await prisma.paygrades.findFirst({ where: { name: name.trim() } });
  if (dup) return respond.conflict(res, 'Paygrade name already exists');

  const row = await prisma.paygrades.create({
    data: {
      name:       name.trim(),
      currency:   currency.trim().toUpperCase(),
      min_salary: toDecimalString(min_salary),
      max_salary: toDecimalString(max_salary),
    },
  });
  respond.created(res, 'Paygrade created', serialize(row));
});

const updatePaygrade = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid paygrade ID');

  const existing = await prisma.paygrades.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Paygrade not found');

  const { name, currency, min_salary, max_salary } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Paygrade name is required');
  if (!currency?.trim()) return respond.badReq(res, 'Currency is required');

  const dup = await prisma.paygrades.findFirst({ where: { name: name.trim(), id: { not: id } } });
  if (dup) return respond.conflict(res, 'Paygrade name already exists');

  const row = await prisma.paygrades.update({
    where: { id },
    data: {
      name:       name.trim(),
      currency:   currency.trim().toUpperCase(),
      min_salary: toDecimalString(min_salary),
      max_salary: toDecimalString(max_salary),
    },
  });
  respond.ok(res, 'Paygrade updated', serialize(row));
});

const deletePaygrade = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid paygrade ID');

  const existing = await prisma.paygrades.findUnique({ where: { id } });
  if (!existing) return respond.notFound(res, 'Paygrade not found');

  // Block deletion when notches reference this paygrade by name
  const notchCount = await prisma.notches.count({ where: { paygrade: existing.name ?? '' } });
  if (notchCount > 0) {
    return respond.badReq(res, `Cannot delete: ${notchCount} notch${notchCount > 1 ? 'es are' : ' is'} assigned to this paygrade`);
  }

  await prisma.paygrades.delete({ where: { id } });
  respond.ok(res, 'Paygrade deleted', null);
});

// ─────────────────────────────────────────────────────────────────────────────

const getPaymentTypes = asyncHandler(async (_req, res) => {
  const rows = await prisma.paymenttype.findMany({ orderBy: { name: 'asc' } });
  respond.ok(res, 'Payment types retrieved', serialize(rows));
});

const createPaymentType = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Payment type is required');
  const row = await prisma.paymenttype.create({ data: { name: name.trim(), description: description?.trim() || null } });
  respond.created(res, 'Payment type created', serialize(row));
});

const updatePaymentType = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid payment type ID');
  const { name, description } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Payment type is required');
  const row = await prisma.paymenttype.update({ where: { id }, data: { name: name.trim(), description: description?.trim() || null } });
  respond.ok(res, 'Payment type updated', serialize(row));
});

const deletePaymentType = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid payment type ID');
  await prisma.paymenttype.delete({ where: { id } });
  respond.ok(res, 'Payment type deleted', null);
});

const getNotchMovements = asyncHandler(async (_req, res) => {
  const rows = await query('SELECT id, date, employees, no_notches FROM notchmovement ORDER BY date DESC, id DESC');
  respond.ok(res, 'Salary increment/decrement records retrieved', rows);
});

const createNotchMovement = asyncHandler(async (req, res) => {
  const { notchId, operation, percentage, date } = req.body;
  const id = toBigInt(notchId);
  if (!id) return respond.badReq(res, 'Notch is required');
  const pct = Number(percentage);
  if (!Number.isFinite(pct) || pct <= 0) return respond.badReq(res, 'Change percentage must be greater than zero');
  if (!['Increment', 'Decrement'].includes(operation)) return respond.badReq(res, 'Operation must be Increment or Decrement');

  const notch = await prisma.notches.findUnique({ where: { id } });
  if (!notch) return respond.notFound(res, 'Notch not found');

  const current = Number(notch.amount ?? 0);
  const delta = current * (pct / 100);
  const next = operation === 'Increment' ? current + delta : current - delta;
  await prisma.notches.update({ where: { id }, data: { amount: next.toFixed(2) } });

  const [{ nextId }] = await query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM notchmovement');
  const movementDate = date ? new Date(date) : new Date();
  const note = `${operation} ${pct}%`;
  await exec('INSERT INTO notchmovement (id, date, employees, no_notches) VALUES (?, ?, ?, ?)', nextId, movementDate, notch.name, note);
  const [created] = await query('SELECT id, date, employees, no_notches FROM notchmovement WHERE id = ?', nextId);
  respond.created(res, 'Salary increment/decrement applied', created);
});

const getSalaryRefs = asyncHandler(async (_req, res) => {
  const [employees, components, componentTypes, notches, paygrades, paymentTypes] = await Promise.all([
    prisma.employee.findMany({ select: { id: true, firstName: true, lastName: true, employee_id: true }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
    prisma.salarycomponent.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    query('SELECT id, code, name, description FROM salarycomponenttype ORDER BY name ASC'),
    query('SELECT id, name, paygrade, currency, CAST(amount AS CHAR) AS amount FROM notches ORDER BY name ASC'),
    query('SELECT id, name, currency, CAST(min_salary AS CHAR) AS min_salary, CAST(max_salary AS CHAR) AS max_salary FROM paygrades ORDER BY name ASC'),
    prisma.paymenttype.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  respond.ok(res, 'Salary references retrieved', {
    employees: serialize(employees.map(e => ({ id: e.id, label: `${e.firstName} ${e.lastName}`.trim() + (e.employee_id ? ` (${e.employee_id})` : '') }))),
    components: serialize(components.map(c => ({ id: c.id, label: c.name }))),
    componentTypes,
    notches: notches.map(n => ({ id: n.id, label: `${n.name}${n.amount ? ` (${n.currency ?? ''} ${n.amount})` : ''}`, ...n })),
    paygrades: paygrades.map(p => ({ id: p.id, label: `${p.name}${p.currency ? ` (${p.currency})` : ''}`, name: p.name, currency: p.currency, min_salary: p.min_salary, max_salary: p.max_salary })),
    paymentTypes: serialize(paymentTypes.map(p => ({ id: p.id, label: p.name }))),
  });
});

module.exports = {
  getSalaryComponentTypes,
  createSalaryComponentType,
  updateSalaryComponentType,
  deleteSalaryComponentType,

  getSalaryComponents,
  createSalaryComponent,
  updateSalaryComponent,
  deleteSalaryComponent,

  getEmployeeSalaryComponents,
  getEmployeeSalaryHistory,
  createEmployeeSalaryComponent,
  updateEmployeeSalaryComponent,
  deleteEmployeeSalaryComponent,
  
  getPaygrades,
  createPaygrade,
  updatePaygrade,
  deletePaygrade,

  getNotches,
  createNotch,
  updateNotch,
  deleteNotch,
  getPaymentTypes,
  createPaymentType,
  updatePaymentType,
  deletePaymentType,
  getNotchMovements,
  createNotchMovement,
  getSalaryRefs,
};
