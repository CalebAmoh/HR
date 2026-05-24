const { prisma } = require('../helpers/dbQueryHelper');
const asyncHandler = require('../middleware/asyncHandler');
const respond = require('../helpers/respondHelper');
const { Parser } = require('expr-eval');
const { logActivity, fromReq } = require('./auditController');
const axios = require('axios');
const _parser = new Parser({ operators: { logical: false, comparison: false, conditional: false } });

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

async function query(sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return serialize(rows);
}

async function exec(sql, ...params) {
  return prisma.$executeRawUnsafe(sql, ...params);
}

// ── Auto-create tables ────────────────────────────────────────────────────────
(async () => {
  try {
    await exec(`
      CREATE TABLE IF NOT EXISTS payrollruns (
        id              BIGINT AUTO_INCREMENT PRIMARY KEY,
        name            VARCHAR(200) NOT NULL,
        pay_frequency   INT NULL,
        date_start      DATE NULL,
        date_end        DATE NULL,
        deduction_group BIGINT NULL,
        status          ENUM('Draft','Processing','Completed') DEFAULT 'Draft',
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await exec(`ALTER TABLE payrollruns ADD COLUMN payment_type_id BIGINT NULL`).catch(() => {});
    await exec(`ALTER TABLE payrollruns MODIFY COLUMN status ENUM('Draft','Processing','Pending Approval','Rejected','Approved','Completed') DEFAULT 'Draft'`).catch(() => {});
    await exec(`ALTER TABLE payrollruns ADD COLUMN submitted_by BIGINT NULL`).catch(() => {});
    await exec(`ALTER TABLE payrollruns ADD COLUMN approved_by BIGINT NULL`).catch(() => {});
    await exec(`ALTER TABLE payrollruns ADD COLUMN approved_at DATETIME NULL`).catch(() => {});
    await exec(`ALTER TABLE payrollruns ADD COLUMN rejection_reason TEXT NULL`).catch(() => {});
    await exec(`ALTER TABLE payrollruns ADD COLUMN document_ref VARCHAR(100) NULL`).catch(() => {});
    await exec(`ALTER TABLE payrollruns ADD COLUMN payment_log TEXT NULL`).catch(() => {});
    await exec(`ALTER TABLE payrollruns ADD COLUMN finalized_at DATETIME NULL`).catch(() => {});
    await exec(`
      CREATE TABLE IF NOT EXISTS payrollrunaudit (
        id         BIGINT AUTO_INCREMENT PRIMARY KEY,
        run_id     BIGINT NOT NULL,
        action     VARCHAR(50) NOT NULL,
        user_id    BIGINT NULL,
        user_name  VARCHAR(200) NULL,
        details    TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await exec(`
      CREATE TABLE IF NOT EXISTS payrolldata (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        payroll      BIGINT NOT NULL,
        employee     BIGINT NOT NULL,
        payroll_item INT NOT NULL,
        amount       VARCHAR(25) NULL
      )
    `);
    console.log('[payrollRunController] Tables ready');
  } catch (e) {
    console.error('[payrollRunController] Table setup error', e.message);
  }
})();

// ── Formula evaluator ─────────────────────────────────────────────────────────
function safeEval(formula, vars = {}) {
  let expr = String(formula || '0');
  // Substitute variable names with their numeric values (longest names first to avoid partial matches)
  Object.entries(vars)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([name, val]) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expr = expr.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), String(Number(val) || 0));
    });
  try {
    const result = _parser.evaluate(expr);
    return typeof result === 'number' && isFinite(result) ? result : 0;
  } catch { return 0; }
}

function matchesBracket(item, amount) {
  const lo = item.lower_limit_condition;
  const hi = item.upper_limit_condition;
  const ll = parseFloat(item.lower_limit) || 0;
  const ul = parseFloat(item.upper_limit) || 0;
  const lowerOk = lo === 'NO_LOWER_LIMIT' ||
    (lo === 'GREATER_THAN' && amount > ll) ||
    (lo === 'GREATER_THAN_OR_EQUAL' && amount >= ll);
  const upperOk = hi === 'NO_UPPER_LIMIT' ||
    (hi === 'LESS_THAN' && amount < ul) ||
    (hi === 'LESS_THAN_OR_EQUAL' && amount <= ul);
  return lowerOk && upperOk;
}

// ── Calculation engine ────────────────────────────────────────────────────────
function calcColumn(col, salaryMap, allCols, savedCalcs, empId, exemptions, cache = {}) {
  if (cache[col.id] !== undefined) return cache[col.id];

  // Guard against circular references: mark this column as in-progress (0)
  // so any recursive call back to this column returns 0 instead of infinitely recursing
  cache[col.id] = 0;

  // 1. Sum linked salary components; fall back to default_value if sum is 0
  const compNames = (col.salary_components || '').split(',').map(s => s.trim()).filter(Boolean);
  const defaultVal = parseFloat(col.default_value || '0') || 0;
  let result = compNames.reduce((sum, name) => sum + (parseFloat(salaryMap[name.toUpperCase()]) || 0), 0);
  if (result === 0 && defaultVal > 0) result = defaultVal;

  // 2. Evaluate formula if present
  if (col.calculation_function && col.calculation_function.trim()) {
    const vars = {};
    // salary component values — always available
    Object.entries(salaryMap).forEach(([k, v]) => { vars[k] = v; });
    // Only use ALREADY-CACHED column values; never recursively compute here.
    // Recursive on-demand computation caused cache poisoning: a column computed
    // mid-formula-eval would see sibling columns' sentinel values (0) instead of
    // their real values, storing a wrong result in the cache permanently.
    // Columns that need a peer's value in their formula must come after it in colorder.
    allCols.forEach(c => {
      if (c.id !== col.id && cache[c.id] !== undefined) {
        vars[c.name.toUpperCase()] = cache[c.id];
        vars[c.name] = cache[c.id];
      }
    });
    const formulaResult = safeEval(col.calculation_function, vars);
    if (!isNaN(formulaResult)) result = formulaResult;
  }

  // 3. Add columns
  const addNames = (col.add_columns || '').split(',').map(s => s.trim()).filter(Boolean);
  addNames.forEach(name => {
    const found = allCols.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (found && found.id !== col.id) result += calcColumn(found, salaryMap, allCols, savedCalcs, empId, exemptions, cache);
  });

  // 4. Subtract columns
  const subNames = (col.sub_columns || '').split(',').map(s => s.trim()).filter(Boolean);
  subNames.forEach(name => {
    const found = allCols.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (found && found.id !== col.id) result -= calcColumn(found, salaryMap, allCols, savedCalcs, empId, exemptions, cache);
  });

  // 5. Apply calculation rule — only when explicitly linked via calculation_rule.
  // Auto-matching by target_name was removed: savedCalc target_name is the BASE column/component,
  // not the output column, so name-matching incorrectly applied rules to the wrong columns.
  // X (and the target's own name) in bracket formulas = the rule's TARGET base amount.
  const exemptIds = (exemptions || '').split(',').map(s => s.trim()).filter(Boolean);
  if (col.calculation_rule) {
    const rulesToApply = savedCalcs.filter(sc =>
      String(sc.id) === String(col.calculation_rule) &&
      !exemptIds.includes(String(sc.id)) &&
      sc.items && sc.items.length > 0
    );
    rulesToApply.forEach(sc => {
      // Resolve the base amount from the rule's declared target
      let base = result;
      if (sc.target_type === 'component' && sc.target_name) {
        const amt = parseFloat(salaryMap[sc.target_name.toUpperCase()]);
        if (!isNaN(amt)) base = amt;
      } else if (sc.target_type === 'column' && sc.target_name) {
        const tgt = allCols.find(c => c.name.toLowerCase() === sc.target_name.toLowerCase());
        if (tgt && String(tgt.id) !== String(col.id)) {
          base = cache[tgt.id] !== undefined
            ? cache[tgt.id]
            : calcColumn(tgt, salaryMap, allCols, savedCalcs, empId, exemptions, cache);
        }
      }
      const bracket = sc.items.find(item => matchesBracket(item, base));
      if (bracket) {
        // Provide X + the target's own name so formulas like "Salary Basic * 0.05" resolve
        const bracketVars = { X: base, x: base };
        if (sc.target_name) {
          bracketVars[sc.target_name] = base;
          bracketVars[sc.target_name.toUpperCase()] = base;
        }
        Object.entries(salaryMap).forEach(([k, v]) => { bracketVars[k] = v; bracketVars[k.toLowerCase()] = v; });
        allCols.forEach(c => {
          if (cache[c.id] !== undefined) { bracketVars[c.name] = cache[c.id]; bracketVars[c.name.toUpperCase()] = cache[c.id]; }
        });
        const calcResult = safeEval(bracket.value, bracketVars);
        if (!isNaN(calcResult)) result = parseFloat(calcResult.toFixed(2));
      }
    });
  }

  const final = Math.round(Math.max(0, result) * 100) / 100;
  cache[col.id] = final;
  return final;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
// ── Audit helper ──────────────────────────────────────────────────────────────
async function logAudit(runId, action, req, details = null) {
  try {
    const userId   = req.user?.id   ? BigInt(req.user.id)   : null;
    const userName = req.user?.username || null;
    await exec(
      `INSERT INTO payrollrunaudit (run_id, action, user_id, user_name, details) VALUES (?, ?, ?, ?, ?)`,
      BigInt(runId), action, userId, userName, details ? JSON.stringify(details) : null
    );
  } catch (e) { console.error('[payroll audit]', e.message); }
}

const RUNS_SELECT = `
  SELECT pr.id, pr.name, pr.pay_frequency, pf.name AS freq_name,
         pr.date_start, pr.date_end, pr.deduction_group,
         cg.name AS group_name, pr.payment_type_id, pt.name AS type_name,
         pr.status, pr.created_at,
         pr.submitted_by, pr.approved_by, pr.approved_at, pr.rejection_reason,
         pr.document_ref, pr.finalized_at
  FROM   payrollruns pr
  LEFT JOIN payfrequencies     pf ON pf.id = pr.pay_frequency
  LEFT JOIN calculationgroups  cg ON cg.id = pr.deduction_group
  LEFT JOIN paymenttype        pt ON pt.id = pr.payment_type_id
`;

const getPayrollRuns = asyncHandler(async (_req, res) => {
  const rows = await query(RUNS_SELECT + ' ORDER BY pr.created_at DESC');
  respond.ok(res, 'Payroll runs retrieved', rows);
});

const createPayrollRun = asyncHandler(async (req, res) => {
  const { name, pay_frequency, date_start, date_end, deduction_group, payment_type } = req.body;
  if (!name?.trim()) return respond.badReq(res, 'Run name is required');
  if (!pay_frequency)  return respond.badReq(res, 'Pay frequency is required');
  await exec(
    `INSERT INTO payrollruns (name, pay_frequency, date_start, date_end, deduction_group, payment_type_id) VALUES (?, ?, ?, ?, ?, ?)`,
    name.trim(),
    parseInt(pay_frequency),
    date_start || null,
    date_end || null,
    deduction_group ? BigInt(deduction_group) : null,
    payment_type ? BigInt(payment_type) : null
  );
  const rows = await query(RUNS_SELECT + ' ORDER BY pr.created_at DESC LIMIT 1');
  respond.created(res, 'Payroll run created', rows[0] || null);
});

const updatePayrollRun = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, pay_frequency, date_start, date_end, deduction_group, payment_type } = req.body;
  const [run] = await query(`SELECT status FROM payrollruns WHERE id = ?`, BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status === 'Completed') return respond.badReq(res, 'Cannot edit a completed payroll run');
  await exec(
    `UPDATE payrollruns SET name=?, pay_frequency=?, date_start=?, date_end=?, deduction_group=?, payment_type_id=?, updated_at=NOW() WHERE id=?`,
    name?.trim() || run.name,
    pay_frequency ? parseInt(pay_frequency) : null,
    date_start || null,
    date_end || null,
    deduction_group ? BigInt(deduction_group) : null,
    payment_type ? BigInt(payment_type) : null,
    BigInt(id)
  );
  const rows = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  respond.ok(res, 'Updated', rows[0] || null);
});

const deletePayrollRun = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [run] = await query(`SELECT status FROM payrollruns WHERE id = ?`, BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status === 'Completed') return respond.badReq(res, 'Cannot delete a completed payroll run');
  await exec(`DELETE FROM payrolldata WHERE payroll = ?`, BigInt(id));
  await exec(`DELETE FROM payrollruns WHERE id = ?`, BigInt(id));
  respond.ok(res, 'Deleted');
});

// ── Generate ──────────────────────────────────────────────────────────────────
const generatePayroll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [run] = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status === 'Completed')        return respond.badReq(res, 'Cannot regenerate a completed payroll run');
  if (run.status === 'Pending Approval') return respond.badReq(res, 'Withdraw the approval request before regenerating');
  if (run.status === 'Approved')         return respond.badReq(res, 'Cannot regenerate an approved payroll run');

  // Mark as Processing and clear any prior approval state
  await exec(
    `UPDATE payrollruns SET status='Processing', submitted_by=NULL, approved_by=NULL, approved_at=NULL, rejection_reason=NULL, updated_at=NOW() WHERE id=?`,
    BigInt(id)
  );

  // Load all enabled columns — no pay_frequency filter; columns are not per-frequency.
  // deduction_group on a column means "only run for employees in this group"; NULL = universal.
  const allCols = await query(
    `SELECT id, name, salary_components, add_columns, sub_columns, calculation_function,
            payment_deduction, colorder, default_value, calculation_rule, deduction_group
     FROM payrollcolumns
     WHERE enabled='Yes'
     ORDER BY COALESCE(colorder, 99999), id`
  );
  if (!allCols.length) return respond.ok(res, 'No enabled payroll columns found', []);

  // Load payroll employees
  let empQuery = `SELECT pe.id, pe.employee, pe.deduction_group, pe.deduction_exemptions FROM payrollemployees pe WHERE pe.pay_frequency = ?`;
  const empParams = [parseInt(run.pay_frequency)];
  if (run.deduction_group) {
    empQuery += ` AND pe.deduction_group = ?`;
    empParams.push(BigInt(run.deduction_group));
  }
  const payrollEmps = await query(empQuery, ...empParams);
  if (!payrollEmps.length) return respond.ok(res, 'No employees found for this pay frequency', []);

  // Load all saved calculations with their items
  const savedCalcs = await query(`
    SELECT sc.id, sc.name, sc.target_type, sc.target_name, sc.calculation_group_id
    FROM savedcalculations sc
  `);
  const calcItems = await query(`SELECT * FROM calculationprocessitems ORDER BY sort_order`);
  savedCalcs.forEach(sc => {
    sc.items = calcItems.filter(i => String(i.saved_calculation_id) === String(sc.id));
  });

  // Load salary components for all employees — use plain numeric strings as keys
  // (serialize() turns BigInt → string, but the exact format can differ; normalise to Number string)
  const empIdNums = payrollEmps.map(e => String(Number(e.employee)));
  const empIdBigs = payrollEmps.map(e => BigInt(e.employee));

  const salaryRows = empIdBigs.length
    ? await query(`
        SELECT es.employee, sc.name AS comp_name, CAST(es.amount AS CHAR) AS amount
        FROM employeesalary es
        JOIN salarycomponent sc ON sc.id = es.component
        WHERE es.employee IN (${empIdBigs.map(() => '?').join(',')})
      `, ...empIdBigs)
    : [];

  // Load notch (basic salary grade) for each employee
  const notchRows = empIdBigs.length
    ? await query(`
        SELECT e.id AS employee, CAST(n.amount AS CHAR) AS amount, n.name AS notch_name
        FROM employee e
        JOIN notches n ON n.id = e.notcheId
        WHERE e.id IN (${empIdBigs.map(() => '?').join(',')})
      `, ...empIdBigs)
    : [];

  // Build notch-amount lookup first so salary rows can fall back to it
  const notchAmtByEmp = {};
  notchRows.forEach(row => {
    notchAmtByEmp[String(Number(row.employee))] = parseFloat(row.amount) || 0;
  });

  // Build per-employee salary map
  const salaryByEmp = {};
  salaryRows.forEach(row => {
    const eid = String(Number(row.employee));
    if (!salaryByEmp[eid]) salaryByEmp[eid] = {};
    // NULL or missing amount → treat as 0 so the column's default_value fallback can fire.
    // The notch is already inserted under its own name below; no need to duplicate it here.
    const amt = parseFloat(row.amount) || 0;
    salaryByEmp[eid][row.comp_name.toUpperCase()] = amt;
  });

  // Find which salary component the user has explicitly designated as grade-scale linked.
  // This makes the notch alias survive renames — we look up the current name via the flag.
  const [notchLinkedComp] = await query(
    `SELECT name FROM salarycomponent WHERE is_notch_linked = 1 LIMIT 1`
  );
  const notchCompKey = notchLinkedComp?.name?.toUpperCase() || null;

  // Add notch under its own name + the designated grade-scale component name + legacy alias.
  // The `in` operator check (not falsy) ensures employees with an explicit 0 are never
  // overwritten — they correctly fall through to default_value in calcColumn.
  notchRows.forEach(row => {
    const eid = String(Number(row.employee));
    if (!salaryByEmp[eid]) salaryByEmp[eid] = {};
    const amt = parseFloat(row.amount) || 0;
    salaryByEmp[eid][row.notch_name.toUpperCase()] = amt;
    if (notchCompKey && !(notchCompKey in salaryByEmp[eid])) {
      salaryByEmp[eid][notchCompKey] = amt;
    }
    // Backward-compat: keep 'BASIC SALARY' alias for installs that haven't flagged a component yet
    if (!('BASIC SALARY' in salaryByEmp[eid])) salaryByEmp[eid]['BASIC SALARY'] = amt;
  });

  const notchWarning = notchRows.length > 0 && !notchLinkedComp
    ? 'No grade-scale component is linked. Employees on the grade scale may have incorrect values. Go to Payroll Management → Components to link one.'
    : null;

  // Diagnostics
  const emptySalaryEmps = empIdNums.filter(eid => !salaryByEmp[eid] || Object.keys(salaryByEmp[eid]).length === 0);

  // Detect which salary components payroll columns need but no employee has in their map
  const neededComponents = new Set();
  allCols.forEach(col => {
    (col.salary_components || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      .forEach(name => neededComponents.add(name));
  });
  const foundComponents = new Set();
  empIdNums.forEach(eid => {
    Object.keys(salaryByEmp[eid] || {}).forEach(key => foundComponents.add(key));
  });
  const missingComponents = [...neededComponents].filter(name => !foundComponents.has(name));

  // Delete previous data for this run
  await exec(`DELETE FROM payrolldata WHERE payroll = ?`, BigInt(id));

  // Calculate and insert
  const insertSql = `INSERT INTO payrolldata (payroll, employee, payroll_item, amount) VALUES (?, ?, ?, ?)`;
  for (const pe of payrollEmps) {
    const eid = String(Number(pe.employee));
    const salaryMap = salaryByEmp[eid] || {};
    const cache = {};
    for (const col of allCols) {
      // Skip group-specific columns for employees not in that group.
      // A column with no deduction_group (null) is universal and always runs.
      if (col.deduction_group && String(col.deduction_group) !== String(pe.deduction_group ?? '')) continue;
      const amount = calcColumn(col, salaryMap, allCols, savedCalcs, pe.employee, pe.deduction_exemptions, cache);
      await exec(insertSql, BigInt(id), BigInt(pe.employee), parseInt(col.id), String(amount));
    }
  }

  await logAudit(id, 'generate', req, { employees: payrollEmps.length, columns: allCols.length });
  logActivity({ module: 'Payroll', action: 'generate', entityId: String(id), entityName: run.name, ...fromReq(req), details: { employees: payrollEmps.length } });
  respond.ok(res, 'Payroll generated', {
    employees:           payrollEmps.length,
    columns:             allCols.length,
    salaryRowsFound:     salaryRows.length,
    notchRowsFound:      notchRows.length,
    empsWithNoSalary:    emptySalaryEmps.length,
    missingComponents,
    notchWarning,
  });
});

// ── Grid data ─────────────────────────────────────────────────────────────────
const getPayrollData = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cells = await query(`
    SELECT pd.id, pd.employee, pd.payroll_item, pd.amount,
           TRIM(CONCAT(IFNULL(e.firstName,''), ' ', IFNULL(e.lastName,''))) AS emp_name,
           pc.name AS column_name, pc.colorder, pc.payment_deduction,
           COALESCE(pc.visible, 1) AS visible
    FROM   payrolldata pd
    LEFT JOIN employee       e  ON e.id  = pd.employee
    LEFT JOIN payrollcolumns pc ON pc.id = pd.payroll_item
    WHERE  pd.payroll = ?
    ORDER BY emp_name, COALESCE(pc.colorder, 99999), pc.id
  `, BigInt(id));

  const [{ totalEnabled }] = await query(`SELECT COUNT(*) AS totalEnabled FROM payrollcolumns WHERE enabled='Yes'`);
  const colsInRun = new Set(cells.map(r => String(r.payroll_item))).size;
  const staleColumnCount = Math.max(0, Number(totalEnabled) - colsInRun);

  respond.ok(res, 'Payroll data retrieved', { cells, staleColumnCount, totalEnabledCols: Number(totalEnabled) });
});

const updatePayrollDataItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { amount } = req.body;
  const [run] = await query(`SELECT status FROM payrollruns WHERE id = ?`, BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status === 'Completed') return respond.badReq(res, 'Cannot edit a completed payroll run');
  await exec(`UPDATE payrolldata SET amount = ? WHERE id = ? AND payroll = ?`, String(amount ?? ''), parseInt(itemId), BigInt(id));
  respond.ok(res, 'Updated');
});

// ── Finalize ──────────────────────────────────────────────────────────────────
const finalizePayroll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [run] = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status === 'Draft')            return respond.badReq(res, 'Generate the payroll before finalizing');
  if (run.status === 'Completed')        return respond.badReq(res, 'Already finalized');
  if (run.status === 'Pending Approval') return respond.badReq(res, 'Approve the payroll before finalizing');
  if (run.status === 'Rejected')         return respond.badReq(res, 'Regenerate the payroll before finalizing');

  let documentRef = null;
  let paymentLog  = null;

  // Build GL posting payload — always runs (URL is set in .env)
  const postingUrl = process.env.POSTING_API_URL;
  if (postingUrl) {
    const postingRows = await query(`
      SELECT pd.employee, pd.amount,
             pc.name AS col_name, pc.payment_deduction, pc.salarycomponent_gl, pc.posting_branch,
             TRIM(CONCAT(IFNULL(e.firstName,''), ' ', IFNULL(e.lastName,''))) AS emp_name,
             e.bankAccount,
             COALESCE(pe.currency, ?) AS currency
      FROM   payrolldata pd
      JOIN   payrollcolumns    pc ON pc.id       = pd.payroll_item
      JOIN   employee           e  ON e.id        = pd.employee
      LEFT JOIN payrollemployees pe ON pe.employee = pd.employee
      WHERE  pd.payroll = ? AND pc.posting_column = 'Yes'
      ORDER  BY pd.employee, COALESCE(pc.colorder, 99999)
    `, process.env.POSTING_DEFAULT_CURRENCY || 'SLL', BigInt(id));

    const debitAccounts  = [];
    const creditAccounts = [];
    const approvedBy = req.user?.username || req.user?.email || 'System';
    const referenceNo = `HR-${id}-${Date.now()}`;
    const defaultBranch = process.env.POSTING_DEFAULT_BRANCH || '000';

    for (const row of postingRows) {
      const amount = parseFloat(row.amount || '0');
      if (!amount || amount <= 0) continue;
      const branch   = row.posting_branch || defaultBranch;
      const currency = row.currency || process.env.POSTING_DEFAULT_CURRENCY || 'SLL';
      const prodRef  = `${id}_${row.employee}`;
      const isNet    = (row.col_name || '').toLowerCase().startsWith('net');

      if (isNet) {
        // Net pay — CREDIT to employee bank account
        creditAccounts.push({
          creditAmount:      amount,
          creditAccount:     row.bankAccount || '',
          creditCurrency:    currency,
          creditNarration:   `${row.col_name} - ${row.emp_name}`,
          creditProdRef:     prodRef,
          creditBranch:      branch,
        });
      } else if (row.payment_deduction === 'Deduction' && row.salarycomponent_gl) {
        // Deduction liability — CREDIT to GL code
        creditAccounts.push({
          creditAmount:      amount,
          creditAccount:     row.salarycomponent_gl,
          creditCurrency:    currency,
          creditNarration:   `${row.col_name} - ${row.emp_name}`,
          creditProdRef:     prodRef,
          creditBranch:      branch,
        });
      } else if (row.payment_deduction === 'Payment' && row.salarycomponent_gl) {
        // Salary expense — DEBIT to GL code
        debitAccounts.push({
          debitAmount:       amount,
          debitAccount:      row.salarycomponent_gl,
          debitCurrency:     currency,
          debitNarration:    `${row.col_name} - ${row.emp_name}`,
          debitProdRef:      prodRef,
          debitBranch:       branch,
        });
      }
    }

    const payload = {
      approvedBy,
      channelCode: process.env.POSTING_CHANNEL_CODE || 'HRP',
      transType:   process.env.POSTING_TRANS_TYPE   || '1504',
      debitAccounts,
      creditAccounts,
      referenceNo,
      postedBy:    process.env.POSTING_POSTED_BY    || 'HRMS',
    };

    try {
      const apiRes = await axios({
        method:          'put',
        maxBodyLength:   Infinity,
        url:             postingUrl,
        headers: {
          'Content-Type':    'application/json',
          'x-api-key':       process.env.POSTING_API_KEY    || '',
          'x-api-secret':    process.env.POSTING_API_SECRET || '',
          'X-FORWARDED-FOR': '10.203.14.169',
        },
        data: payload,
        timeout: 30000,
      });
      const apiData = apiRes.data || {};
      documentRef = apiData.documentRef || apiData.document_ref || apiData.referenceNo || referenceNo;
      paymentLog  = JSON.stringify(apiData);
      console.log('[finalize] GL posting success, ref:', documentRef);
    } catch (e) {
      console.error('[finalize] GL posting error:', e.response?.data || e.message);
      paymentLog = JSON.stringify({ error: e.response?.data || e.message });
    }
  }

  await exec(
    `UPDATE payrollruns SET status='Completed', document_ref=?, payment_log=?, finalized_at=NOW(), updated_at=NOW() WHERE id=?`,
    documentRef, paymentLog, BigInt(id)
  );
  await logAudit(id, 'finalize', req, { documentRef });
  logActivity({ module: 'Payroll', action: 'finalize', entityId: String(id), entityName: run.name, ...fromReq(req), details: { documentRef } });
  const rows = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  respond.ok(res, 'Payroll finalized', rows[0] || null);
});

// ── Approval workflow ─────────────────────────────────────────────────────────
const submitPayroll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [run] = await query(`SELECT status FROM payrollruns WHERE id = ?`, BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status !== 'Processing') return respond.badReq(res, 'Only a Processing run can be submitted for approval');
  const userId = req.user?.id ? BigInt(req.user.id) : null;
  await exec(`UPDATE payrollruns SET status='Pending Approval', submitted_by=?, updated_at=NOW() WHERE id=?`, userId, BigInt(id));
  await logAudit(id, 'submit', req);
  logActivity({ module: 'Payroll', action: 'submit', entityId: String(id), entityName: run.name, ...fromReq(req) });
  const rows = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  respond.ok(res, 'Submitted for approval', rows[0] || null);
});

const approvePayroll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [run] = await query(`SELECT status FROM payrollruns WHERE id = ?`, BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status !== 'Pending Approval') return respond.badReq(res, 'Run is not pending approval');
  const userId = req.user?.id ? BigInt(req.user.id) : null;
  await exec(
    `UPDATE payrollruns SET status='Approved', approved_by=?, approved_at=NOW(), updated_at=NOW() WHERE id=?`,
    userId, BigInt(id)
  );
  await logAudit(id, 'approve', req);
  logActivity({ module: 'Payroll', action: 'approve', entityId: String(id), entityName: run.name, ...fromReq(req) });
  const rows = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  respond.ok(res, 'Payroll approved', rows[0] || null);
});

const rejectPayroll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const [run] = await query(`SELECT status FROM payrollruns WHERE id = ?`, BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status !== 'Pending Approval') return respond.badReq(res, 'Run is not pending approval');
  await exec(
    `UPDATE payrollruns SET status='Rejected', rejection_reason=?, updated_at=NOW() WHERE id=?`,
    reason?.trim() || null, BigInt(id)
  );
  await logAudit(id, 'reject', req, { reason: reason?.trim() || null });
  logActivity({ module: 'Payroll', action: 'reject', entityId: String(id), entityName: run.name, details: { reason: reason?.trim() || null }, ...fromReq(req) });
  const rows = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  respond.ok(res, 'Payroll rejected', rows[0] || null);
});

// ── Audit log ─────────────────────────────────────────────────────────────────
const getPayrollAudit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const entries = await query(
    `SELECT id, run_id, action, user_id, user_name, details, created_at FROM payrollrunaudit WHERE run_id = ? ORDER BY created_at ASC`,
    BigInt(id)
  );
  respond.ok(res, 'Audit log retrieved', entries);
});

const duplicatePayrollRun = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [run] = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  await exec(
    `INSERT INTO payrollruns (name, pay_frequency, date_start, date_end, deduction_group, payment_type_id, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Draft')`,
    `${run.name} (Copy)`,
    run.pay_frequency ? parseInt(run.pay_frequency) : null,
    run.date_start ? run.date_start.slice(0, 10) : null,
    run.date_end   ? run.date_end.slice(0, 10)   : null,
    run.deduction_group  ? BigInt(run.deduction_group)  : null,
    run.payment_type_id  ? BigInt(run.payment_type_id)  : null,
  );
  const rows = await query(RUNS_SELECT + ' ORDER BY pr.created_at DESC LIMIT 1');
  logActivity({ module: 'Payroll', action: 'duplicate_run', entityId: String(id), entityName: run.name, ...fromReq(req) });
  respond.created(res, 'Run duplicated', rows[0] || null);
});

module.exports = {
  getPayrollRuns, createPayrollRun, updatePayrollRun, deletePayrollRun,
  generatePayroll, getPayrollData, updatePayrollDataItem, finalizePayroll,
  submitPayroll, approvePayroll, rejectPayroll, getPayrollAudit, duplicatePayrollRun,
};
