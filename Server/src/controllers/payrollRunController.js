const { prisma } = require('../helpers/dbQueryHelper');
const asyncHandler = require('../middleware/asyncHandler');
const respond = require('../helpers/respondHelper');
const { Parser } = require('expr-eval');
const { logActivity, fromReq } = require('./auditController');
const { notifyUser, notifyUsersWithPermission } = require('../helpers/notificationHelper');
const { postToGL }    = require('../helpers/glHelper');
const { getApiConfig } = require('./apiIntegrationController');
const _parser = new Parser({ operators: { logical: false, comparison: false, conditional: false } });

const { serialize } = require('../helpers/controllerHelpers');

async function query(sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return serialize(rows);
}

async function exec(sql, ...params) {
  return prisma.$executeRawUnsafe(sql, ...params);
}

/** Read an app-control toggle from the settings table. Returns `defaultOn` when never saved. */
async function readControlSetting(name, defaultOn) {
  const [row] = await query(
    `SELECT value FROM settings WHERE name=? AND category='app_controls' LIMIT 1`, name
  ).catch(() => []);
  return row ? row.value === '1' : defaultOn;
}

/** Attach `groupIds` (array of calculation-group id strings) to each payroll column from the
 *  payrollcolumn_groups junction table. Empty array = the column is universal (runs for everyone). */
async function attachColumnGroups(cols) {
  if (!cols.length) return cols;
  const rows = await query('SELECT payrollcolumn_id, group_id FROM payrollcolumn_groups');
  const map = {};
  for (const r of rows) (map[String(r.payrollcolumn_id)] ??= []).push(String(r.group_id));
  for (const c of cols) c.groupIds = map[String(c.id)] ?? [];
  return cols;
}

/** Attach `componentNames` (linked salary component names) and `links` ([{target_column_id,operation}])
 *  to each payroll column from the junction tables, and return `compNameById` (id→name) for resolving
 *  {comp:id} tokens in formulas. Replaces the old salary_components / add_columns / sub_columns CSVs. */
async function attachColumnRefs(cols) {
  const compNameById = new Map((await query('SELECT id, name FROM salarycomponent')).map(c => [String(c.id), c.name]));
  if (!cols.length) return { compNameById };
  const compRows = await query('SELECT payrollcolumn_id, component_id FROM payrollcolumn_components');
  const linkRows = await query('SELECT payrollcolumn_id, target_column_id, operation FROM payrollcolumn_links');
  const compMap = {}; for (const r of compRows) (compMap[String(r.payrollcolumn_id)] ??= []).push(String(r.component_id));
  const linkMap = {}; for (const r of linkRows) (linkMap[String(r.payrollcolumn_id)] ??= []).push({ target_column_id: Number(r.target_column_id), operation: r.operation });
  for (const c of cols) {
    c.componentNames = (compMap[String(c.id)] || []).map(cid => compNameById.get(cid)).filter(Boolean);
    c.links = linkMap[String(c.id)] || [];
  }
  return { compNameById };
}

/**
 * Build each employee's salary map (`salaryByEmp[eid][COMPONENT_NAME_UPPER] = amount`) by resolving,
 * in order (later overrides earlier):
 *   1. paygrade components (employee.paygradeId → paygrade_components)
 *   2. notch components    (employee.notcheId  → notch_components, override paygrade on same component)
 *   3. per-employee exceptions (employeesalary): excluded → remove; else override/add
 *   4. notch base salary injection: notch name alias + the is_notch_linked component (Basic Salary)
 *      when not already set and not excluded.
 * Null/blank amounts are skipped so calcColumn's default_value can still fire (matches old behaviour).
 * Component NAMES (uppercased) stay the keys, so calcColumn is unchanged.
 */
async function buildSalaryByEmp(empIdBigs) {
  const salaryByEmp = {};
  const [notchLinkedComp] = await query(`SELECT name FROM salarycomponent WHERE is_notch_linked = 1 LIMIT 1`);
  const notchCompKey = notchLinkedComp?.name?.toUpperCase() || null;
  if (!empIdBigs.length) return { salaryByEmp, notchLinkedComp, notchWarning: null, salaryRowsFound: 0, notchRowsFound: 0 };

  const ph = empIdBigs.map(() => '?').join(',');
  const compNameById = new Map((await query('SELECT id, name FROM salarycomponent')).map(c => [String(c.id), c.name]));
  const emps = await query(`SELECT id, paygradeId, notcheId FROM employee WHERE id IN (${ph})`, ...empIdBigs);

  const pgIds = [...new Set(emps.map(e => e.paygradeId).filter(v => v != null).map(String))];
  const ntIds = [...new Set(emps.map(e => e.notcheId).filter(v => v != null).map(String))];
  const pgComps = pgIds.length ? await query(`SELECT paygrade_id, component_id, CAST(amount AS CHAR) amount FROM paygrade_components WHERE paygrade_id IN (${pgIds.map(() => '?').join(',')})`, ...pgIds.map(BigInt)) : [];
  const ntComps = ntIds.length ? await query(`SELECT notch_id, component_id, CAST(amount AS CHAR) amount FROM notch_components WHERE notch_id IN (${ntIds.map(() => '?').join(',')})`, ...ntIds.map(BigInt)) : [];
  const exceptions = await query(`SELECT employee, component, CAST(amount AS CHAR) amount, excluded FROM employeesalary WHERE employee IN (${ph})`, ...empIdBigs);
  const notchRows = await query(`SELECT e.id AS employee, CAST(n.amount AS CHAR) amount, n.name AS notch_name FROM employee e JOIN notches n ON n.id = e.notcheId WHERE e.id IN (${ph})`, ...empIdBigs);

  const byKey = (rows, k) => { const m = {}; for (const r of rows) (m[String(r[k])] ??= []).push(r); return m; };
  const pgByGrade = byKey(pgComps, 'paygrade_id');
  const ntByNotch = byKey(ntComps, 'notch_id');
  const excByEmp  = byKey(exceptions, 'employee');
  const notchByEmp = {}; for (const r of notchRows) notchByEmp[String(Number(r.employee))] = r;

  const hasAmt = v => !(v === null || v === undefined || v === '');
  let sourceCount = 0;
  for (const emp of emps) {
    const eid = String(Number(emp.id));
    const map = {};
    const excludedKeys = new Set();
    const put = (compId, amount) => {
      const nm = compNameById.get(String(compId));
      if (!nm || !hasAmt(amount)) return;
      map[nm.toUpperCase()] = parseFloat(amount) || 0;
      sourceCount++;
    };
    // 1. paygrade   2. notch (override)
    (pgByGrade[String(emp.paygradeId)] || []).forEach(r => put(r.component_id, r.amount));
    (ntByNotch[String(emp.notcheId)]   || []).forEach(r => put(r.component_id, r.amount));
    // 3. exceptions
    (excByEmp[eid] || []).forEach(r => {
      const nm = compNameById.get(String(r.component));
      if (!nm) return;
      const key = nm.toUpperCase();
      if (r.excluded === 1 || r.excluded === true) { delete map[key]; excludedKeys.add(key); }
      else if (hasAmt(r.amount)) { map[key] = parseFloat(r.amount) || 0; sourceCount++; }
    });
    // 4. notch base salary injection
    const nb = notchByEmp[eid];
    if (nb) {
      const amt = parseFloat(nb.amount) || 0;
      map[String(nb.notch_name).toUpperCase()] = amt;
      if (notchCompKey && !(notchCompKey in map) && !excludedKeys.has(notchCompKey)) map[notchCompKey] = amt;
    }
    salaryByEmp[eid] = map;
  }

  const notchWarning = notchRows.length > 0 && !notchLinkedComp
    ? 'No grade-scale component is linked. Employees on the grade scale may have incorrect values. Go to Payroll Management → Components to link one.'
    : null;
  return { salaryByEmp, notchLinkedComp, notchWarning, salaryRowsFound: sourceCount, notchRowsFound: notchRows.length };
}

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

/** Round a value UP to 2 decimal places. The small epsilon absorbs floating-point noise so a value
 *  that is already exact to the cent (e.g. 12.35) is not pushed up to 12.36. */
function ceilTo2(n) {
  return Math.ceil(n * 100 - 1e-6) / 100;
}

// ── Calculation engine ────────────────────────────────────────────────────────
function calcColumn(col, salaryMap, allCols, savedCalcs, empId, exemptions, cache = {}, ctx = {}) {
  if (cache[col.id] !== undefined) return cache[col.id];

  // Guard against circular references: mark this column as in-progress (0)
  // so any recursive call back to this column returns 0 instead of infinitely recursing
  cache[col.id] = 0;

  // A column tied to salary component(s) only applies to employees who actually have at least one of
  // those components. If the employee has none of them, the whole column is 0 for them — its default
  // value, formula, add/subtract columns and calculation rule are all skipped. A column with NO
  // linked components stays universal (its calculation/default applies to everyone).
  // componentNames is attached per-run from the payrollcolumn_components junction.
  const compNames = col.componentNames || [];
  if (compNames.length > 0 && !compNames.some(name => salaryMap[String(name).toUpperCase()] !== undefined)) {
    cache[col.id] = 0;
    return 0;
  }

  // 1. Sum linked salary components; fall back to default_value if sum is 0
  const defaultVal = parseFloat(col.default_value || '0') || 0;
  let result = compNames.reduce((sum, name) => sum + (parseFloat(salaryMap[String(name).toUpperCase()]) || 0), 0);
  if (result === 0 && defaultVal > 0) result = defaultVal;

  // 2. Evaluate formula if present. The formula is stored in TOKEN form ({comp:id}/{col:id}); resolve
  // each token directly to a value by id — no name matching at eval time (rename-proof). Column tokens
  // use ONLY already-cached values (0 otherwise), preserving the colorder dependency rule.
  if (col.calculation_function && col.calculation_function.trim()) {
    const expr = col.calculation_function
      .replace(/\{comp:(\d+)\}/g, (_, id) => {
        const nm = ctx.compNameById ? ctx.compNameById.get(String(id)) : undefined;
        const v = nm ? salaryMap[String(nm).toUpperCase()] : undefined;
        return `(${parseFloat(v) || 0})`;
      })
      .replace(/\{col:(\d+)\}/g, (_, id) => {
        const v = cache[id];
        return `(${v !== undefined && v !== null ? (Number(v) || 0) : 0})`;
      });
    const formulaResult = safeEval(expr, {});
    if (!isNaN(formulaResult)) result = formulaResult;
  }

  // 3/4. Add / subtract linked columns (resolved by id from the payrollcolumn_links junction)
  (col.links || []).forEach(link => {
    const found = allCols.find(c => Number(c.id) === Number(link.target_column_id));
    if (found && Number(found.id) !== Number(col.id)) {
      const v = calcColumn(found, salaryMap, allCols, savedCalcs, empId, exemptions, cache, ctx);
      result += link.operation === 'subtract' ? -v : v;
    }
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
            : calcColumn(tgt, salaryMap, allCols, savedCalcs, empId, exemptions, cache, ctx);
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
        // Saved-calculation (bracket) results round UP to the nearest cent.
        if (!isNaN(calcResult)) result = ceilTo2(calcResult);
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
         pr.document_ref, pr.payment_log, pr.finalized_at
  FROM   payrollruns pr
  LEFT JOIN payfrequencies     pf ON pf.id = pr.pay_frequency
  LEFT JOIN calculationgroups  cg ON cg.id = pr.deduction_group
  LEFT JOIN paymenttype        pt ON pt.id = pr.payment_type_id
`;

// GET /payroll/runs — list all payroll runs with frequency, deduction group, payment type, and approval status.
const getPayrollRuns = asyncHandler(async (_req, res) => {
  const rows = await query(RUNS_SELECT + ' ORDER BY pr.created_at DESC');
  respond.ok(res, 'Payroll runs retrieved', rows);
});

// POST /payroll/runs — create a new payroll run in Draft status for a given pay frequency and date range.
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

// PUT /payroll/runs/:id — update run metadata (name, dates, frequency, deduction group); blocked on Completed runs.
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

// DELETE /payroll/runs/:id — delete a Draft or Processing run and its payroll data; blocked on Completed runs.
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
// POST /payroll/runs/:id/generate — compute each employee's payroll column values using the calculation engine
// (salary components, formulas, add/sub columns, bracket rules) and store results in payrolldata.
// Reports missing salary components and employees with no salary setup for diagnostics.
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
  // A column's calculation groups (payrollcolumn_groups) mean "only run for employees in those
  // groups"; no groups = universal.
  const allCols = await query(
    `SELECT id, name, calculation_function,
            payment_deduction, colorder, default_value, calculation_rule
     FROM payrollcolumns
     WHERE enabled='Yes'
     ORDER BY COALESCE(colorder, 99999), id`
  );
  if (!allCols.length) return respond.ok(res, 'No enabled payroll columns found', []);
  await attachColumnGroups(allCols);
  const { compNameById } = await attachColumnRefs(allCols);

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

  // Build each employee's salary map from inherited paygrade/notch components + per-employee exceptions.
  const { salaryByEmp, notchWarning, salaryRowsFound, notchRowsFound } = await buildSalaryByEmp(empIdBigs);

  // Diagnostics
  const emptySalaryEmps = empIdNums.filter(eid => !salaryByEmp[eid] || Object.keys(salaryByEmp[eid]).length === 0);

  // Detect salary components that applicable payroll columns need but no selected employee has.
  // Columns with a default value can still calculate without an employee salary row, so skip them.
  const applicableCols = allCols.filter(col =>
    !col.groupIds.length || payrollEmps.some(pe => col.groupIds.includes(String(pe.deduction_group ?? '')))
  );
  const neededComponents = new Set();
  applicableCols.forEach(col => {
    const hasDefault = (parseFloat(col.default_value || '0') || 0) > 0;
    if (hasDefault) return;
    if (col.calculation_function && col.calculation_function.trim()) return;
    (col.componentNames || []).map(s => String(s).trim().toUpperCase()).filter(Boolean)
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
      // Skip group-specific columns for employees not in any of the column's groups.
      // A column with no groups is universal and always runs.
      if (col.groupIds.length && !col.groupIds.includes(String(pe.deduction_group ?? ''))) continue;
      const amount = calcColumn(col, salaryMap, allCols, savedCalcs, pe.employee, pe.deduction_exemptions, cache, { compNameById });
      await exec(insertSql, BigInt(id), BigInt(pe.employee), parseInt(col.id), String(amount));
    }
  }

  await logAudit(id, 'generate', req, { employees: payrollEmps.length, columns: allCols.length });
  logActivity({ module: 'Payroll', action: 'generate', entityId: String(id), entityName: run.name, ...fromReq(req), details: { employees: payrollEmps.length } });
  respond.ok(res, 'Payroll generated', {
    employees:           payrollEmps.length,
    columns:             allCols.length,
    salaryRowsFound:     salaryRowsFound,
    notchRowsFound:      notchRowsFound,
    empsWithNoSalary:    emptySalaryEmps.length,
    missingComponents,
    notchWarning,
  });
});

// ── Grid data ─────────────────────────────────────────────────────────────────
// GET /payroll/runs/:id/data — retrieve all payroll cells for a run (employee × column), with stale-column warning count.
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

// GET /payroll/runs/:id/debug — re-run the calculation engine in read-only mode and return the raw salary map
// plus each column's computed value per employee; used for troubleshooting incorrect payroll results.
const debugPayrollRun = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [run] = await query(`SELECT id, pay_frequency, deduction_group FROM payrollruns WHERE id = ? LIMIT 1`, BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');

  const allCols = await query(
    `SELECT id, name, calculation_function,
            payment_deduction, colorder, default_value, calculation_rule
     FROM payrollcolumns WHERE enabled='Yes' ORDER BY COALESCE(colorder, 99999), id`
  );
  await attachColumnGroups(allCols);
  const { compNameById } = await attachColumnRefs(allCols);

  let empQuery = `SELECT pe.id, pe.employee, pe.deduction_group, pe.deduction_exemptions FROM payrollemployees pe WHERE pe.pay_frequency = ?`;
  const empParams = [parseInt(run.pay_frequency)];
  if (run.deduction_group) { empQuery += ` AND pe.deduction_group = ?`; empParams.push(BigInt(run.deduction_group)); }
  const payrollEmps = await query(empQuery, ...empParams);

  const empIdBigs = payrollEmps.map(e => BigInt(e.employee));
  const { salaryByEmp, notchLinkedComp } = await buildSalaryByEmp(empIdBigs);

  const savedCalcs = await query(`SELECT sc.id, sc.name, sc.target_type, sc.target_name FROM savedcalculations sc`);
  const calcItems = await query(`SELECT * FROM calculationprocessitems ORDER BY sort_order`);
  savedCalcs.forEach(sc => { sc.items = calcItems.filter(i => String(i.saved_calculation_id) === String(sc.id)); });

  const result = payrollEmps.map(pe => {
    const eid = String(Number(pe.employee));
    const salaryMap = salaryByEmp[eid] || {};
    const cache = {};
    const colResults = [];
    for (const col of allCols) {
      if (col.groupIds.length && !col.groupIds.includes(String(pe.deduction_group ?? ''))) continue;
      const amount = calcColumn(col, salaryMap, allCols, savedCalcs, pe.employee, pe.deduction_exemptions, cache, { compNameById });
      colResults.push({ id: col.id, name: col.name, salary_components: (col.componentNames || []).join(','), default_value: col.default_value, calculation_function: col.calculation_function, amount });
    }
    return { employee: eid, salaryMap, columns: colResults };
  });

  respond.ok(res, 'Debug info', { notchLinkedComponent: notchLinkedComp?.name || null, employees: result });
});

// PUT /payroll/runs/:id/data/:itemId — manually override a single payroll cell amount (for corrections before finalization).
const updatePayrollDataItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { amount } = req.body;
  const [run] = await query(`SELECT status FROM payrollruns WHERE id = ?`, BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status === 'Completed') return respond.badReq(res, 'Cannot edit a completed payroll run');
  await exec(`UPDATE payrolldata SET amount = ? WHERE id = ? AND payroll = ?`, String(amount ?? ''), parseInt(itemId), BigInt(id));
  respond.ok(res, 'Updated');
});

// ── GL posting helper (shared by finalize + retry) ───────────────────────────
async function buildAndPostGL(id, req) {
  const apiCfg = await getApiConfig();
  let glExtra  = {};
  try { glExtra = JSON.parse(apiCfg.gl_extra || '{}'); } catch {}
  const defaultCurrency = glExtra.currency || 'SLL';
  const defaultBranch   = glExtra.branch   || '000';

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
  `, defaultCurrency, BigInt(id));

  const debitAccounts  = [];
  const creditAccounts = [];
  const approvedBy  = req.user?.username || req.user?.email || 'System';
  const referenceNo = `PR${id}${String(Date.now()).slice(-7)}`;

  const fallbackExpenseGL   = (process.env.PAYROLL_EXPENSE_GL   || '').trim();
  const fallbackDeductionGL = (process.env.PAYROLL_DEDUCTION_GL || '').trim();
  const fallbackNetGL       = (process.env.PAYROLL_NET_PAYABLE_GL || '').trim();

  for (const row of postingRows) {
    const amount   = parseFloat(row.amount || '0');
    if (!amount || amount <= 0) continue;
    const branch   = row.posting_branch || defaultBranch;
    const currency = row.currency       || defaultCurrency;
    const prodRef  = `HR_${id}_${row.employee}`;
    const isNet    = (row.col_name || '').toLowerCase().startsWith('net');

    if (isNet) {
      const acct = row.bankAccount || fallbackNetGL;
      if (!acct) continue;
      creditAccounts.push({ creditAmount: amount, creditAccount: acct, creditCurrency: currency, creditNarration: `${row.col_name} - ${row.emp_name}`, creditProdRef: prodRef, creditBranch: branch });
    } else if (row.payment_deduction === 'Deduction') {
      const acct = row.salarycomponent_gl || fallbackDeductionGL;
      if (!acct) continue;
      creditAccounts.push({ creditAmount: amount, creditAccount: acct, creditCurrency: currency, creditNarration: `${row.col_name} - ${row.emp_name}`, creditProdRef: prodRef, creditBranch: branch });
    } else if (row.payment_deduction === 'Payment') {
      const acct = row.salarycomponent_gl || fallbackExpenseGL;
      if (!acct) continue;
      debitAccounts.push({ debitAmount: amount, debitAccount: acct, debitCurrency: currency, debitNarration: `${row.col_name} - ${row.emp_name}`, debitProdRef: prodRef, debitBranch: branch });
    }
  }

  const totalDr = debitAccounts.reduce((s, e) => s + e.debitAmount, 0);
  const totalCr = creditAccounts.reduce((s, e) => s + e.creditAmount, 0);
  if (Math.abs(totalDr - totalCr) > 0.01) {
    console.warn(`[payroll GL] run ${id} imbalanced — DR ${totalDr.toFixed(2)} CR ${totalCr.toFixed(2)} diff ${(totalCr - totalDr).toFixed(2)}.`);
  }

  return postToGL({ approvedBy, referenceNo, debitAccounts, creditAccounts });
}

// ── Finalize ──────────────────────────────────────────────────────────────────
// POST /payroll/runs/:id/finalize — mark a payroll run as Completed and attempt GL posting via the configured API.
// Sets status to 'GL Failed' (not Completed) when GL posting errors, allowing a retry without re-generating.
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
  let finalStatus = 'Completed';

  // ── GL posting ───────────────────────────────────────────────────────────────
  // Skip entirely when payroll postings are switched off (record-only mode) — the run still
  // finalizes to 'Completed', just without any journal posted to the general ledger.
  const glEnabled = await readControlSetting('payroll_payments_enabled', true);
  const _glUrl = glEnabled ? (await getApiConfig()).gl_url : null;
  if (_glUrl) {
    try {
      const result = await buildAndPostGL(id, req);
      documentRef = result.documentRef;
      paymentLog  = JSON.stringify(result.raw);
      console.log('[finalize] GL posting success, ref:', documentRef);
    } catch (e) {
      const errData = e.glResponse || e.response?.data || e.message;
      console.error('[finalize] GL posting error:', errData);
      paymentLog  = JSON.stringify({ error: errData });
      finalStatus = 'GL Failed';
    }
  }

  await exec(
    `UPDATE payrollruns SET status=?, document_ref=?, payment_log=?, finalized_at=NOW(), updated_at=NOW() WHERE id=?`,
    finalStatus, documentRef, paymentLog, BigInt(id)
  );
  await logAudit(id, 'finalize', req, { documentRef });
  logActivity({ module: 'Payroll', action: 'finalize', entityId: String(id), entityName: run.name, ...fromReq(req), details: { documentRef } });
  const rows = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  respond.ok(res, 'Payroll finalized', rows[0] || null);
});

// ── Retry GL posting (for GL Failed runs) ────────────────────────────────────
// POST /payroll/runs/:id/retry-gl — re-attempt GL posting for a 'GL Failed' run; transitions to Completed on success.
const retryGLPosting = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [run] = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status !== 'GL Failed') return respond.badReq(res, 'Only a GL Failed run can retry GL posting');
  if (run.document_ref) return respond.badReq(res, 'GL already posted for this run');
  if (!(await readControlSetting('payroll_payments_enabled', true))) return respond.badReq(res, 'Payroll GL posting is disabled in settings');
  if (!(await getApiConfig()).gl_url) return respond.badReq(res, 'GL API URL not configured');

  try {
    const result = await buildAndPostGL(id, req);
    await exec(
      `UPDATE payrollruns SET status='Completed', document_ref=?, payment_log=?, updated_at=NOW() WHERE id=?`,
      result.documentRef, JSON.stringify(result.raw), BigInt(id)
    );
    logActivity({ module: 'Payroll', action: 'gl_retry_success', entityId: String(id), entityName: run.name, ...fromReq(req), details: { documentRef: result.documentRef } });
    const rows = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
    respond.ok(res, 'GL posted successfully', rows[0] || null);
  } catch (e) {
    const errData = e.glResponse || e.response?.data || e.message;
    console.error('[gl retry] error:', errData);
    await exec(
      `UPDATE payrollruns SET payment_log=?, updated_at=NOW() WHERE id=?`,
      JSON.stringify({ error: errData }), BigInt(id)
    );
    const rows = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
    respond.ok(res, 'GL posting failed', rows[0] || null);
  }
});

// ── Approval workflow ─────────────────────────────────────────────────────────
// POST /payroll/runs/:id/submit — move a Processing run to 'Pending Approval' for sign-off before finalization.
const submitPayroll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [run] = await query(`SELECT status FROM payrollruns WHERE id = ?`, BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status !== 'Processing') return respond.badReq(res, 'Only a Processing run can be submitted for approval');
  const userId = req.user?.id ? BigInt(req.user.id) : null;
  await exec(`UPDATE payrollruns SET status='Pending Approval', submitted_by=?, updated_at=NOW() WHERE id=?`, userId, BigInt(id));
  await logAudit(id, 'submit', req);
  logActivity({ module: 'Payroll', action: 'submit', entityId: String(id), entityName: run.name, ...fromReq(req) });
  notifyUsersWithPermission('approve_payroll', {
    message: 'A payroll run awaits your approval', action: 'Payroll', type: 'payroll', fromUser: req.user?.id,
  }, req.user?.id);
  const rows = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  respond.ok(res, 'Submitted for approval', rows[0] || null);
});

// POST /payroll/runs/:id/approve — approve a Pending Approval run, transitioning it to Approved status.
const approvePayroll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [run] = await query(`SELECT status, submitted_by FROM payrollruns WHERE id = ?`, BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status !== 'Pending Approval') return respond.badReq(res, 'Run is not pending approval');

  // Self-approval guard: the user who submitted the run may approve it only when the
  // "Allow Self-Approval" payroll control is on (defaults off).
  if (String(run.submitted_by ?? '') === String(req.user?.id ?? '')) {
    const [s] = await query(`SELECT value FROM settings WHERE name='approval_payroll_self' AND category='app_controls' LIMIT 1`).catch(() => []);
    const selfAllowed = s ? s.value === '1' : false;
    if (!selfAllowed) return respond.forbidden(res, 'Self-approval is disabled — a different approver must review this payroll run');
  }

  const userId = req.user?.id ? BigInt(req.user.id) : null;
  await exec(
    `UPDATE payrollruns SET status='Approved', approved_by=?, approved_at=NOW(), updated_at=NOW() WHERE id=?`,
    userId, BigInt(id)
  );
  await logAudit(id, 'approve', req);
  logActivity({ module: 'Payroll', action: 'approve', entityId: String(id), entityName: run.name, ...fromReq(req) });
  if (run.submitted_by && String(run.submitted_by) !== String(req.user?.id ?? '')) {
    notifyUser(run.submitted_by, { message: 'Your payroll run was approved', action: 'Payroll', type: 'payroll', fromUser: req.user?.id });
  }
  const rows = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  respond.ok(res, 'Payroll approved', rows[0] || null);
});

// POST /payroll/runs/:id/reject — reject a Pending Approval run with an optional reason; sends it back for regeneration.
const rejectPayroll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const [run] = await query(`SELECT status, submitted_by FROM payrollruns WHERE id = ?`, BigInt(id));
  if (!run) return respond.notFound(res, 'Run not found');
  if (run.status !== 'Pending Approval') return respond.badReq(res, 'Run is not pending approval');
  await exec(
    `UPDATE payrollruns SET status='Rejected', rejection_reason=?, updated_at=NOW() WHERE id=?`,
    reason?.trim() || null, BigInt(id)
  );
  await logAudit(id, 'reject', req, { reason: reason?.trim() || null });
  if (run.submitted_by && String(run.submitted_by) !== String(req.user?.id ?? '')) {
    notifyUser(run.submitted_by, { message: `Your payroll run was rejected${reason?.trim() ? ': ' + reason.trim() : ''}`, action: 'Payroll', type: 'payroll', fromUser: req.user?.id });
  }
  logActivity({ module: 'Payroll', action: 'reject', entityId: String(id), entityName: run.name, details: { reason: reason?.trim() || null }, ...fromReq(req) });
  const rows = await query(RUNS_SELECT + ' WHERE pr.id = ?', BigInt(id));
  respond.ok(res, 'Payroll rejected', rows[0] || null);
});

// ── Audit log ─────────────────────────────────────────────────────────────────
// GET /payroll/runs/:id/audit — retrieve the chronological audit trail of all actions taken on a payroll run.
const getPayrollAudit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const entries = await query(
    `SELECT id, run_id, action, user_id, user_name, details, created_at FROM payrollrunaudit WHERE run_id = ? ORDER BY created_at ASC`,
    BigInt(id)
  );
  respond.ok(res, 'Audit log retrieved', entries);
});

// POST /payroll/runs/:id/duplicate — copy a run's config (frequency, dates, group) into a new Draft run
// named "<original> (Copy)", without copying the payroll data.
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
  generatePayroll, getPayrollData, updatePayrollDataItem, finalizePayroll, retryGLPosting,
  submitPayroll, approvePayroll, rejectPayroll, getPayrollAudit, duplicatePayrollRun,
  debugPayrollRun,
};
