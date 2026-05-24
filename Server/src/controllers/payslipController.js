const PDFDocument = require('pdfkit');
const { prisma }  = require('../helpers/dbQueryHelper');
const asyncHandler = require('../middleware/asyncHandler');
const respond      = require('../helpers/respondHelper');

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

function fmt(val) {
  const n = parseFloat(val || '0');
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hexToRgb(hex) {
  const h = (hex || '#3B82F6').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 59;
  const g = parseInt(h.slice(2, 4), 16) || 130;
  const b = parseInt(h.slice(4, 6), 16) || 246;
  return [r, g, b];
}

// ── Download payslip PDF ──────────────────────────────────────────────────────
const downloadPayslip = asyncHandler(async (req, res) => {
  const { id: runId, empId } = req.params;

  // Auth guard: employees can only fetch their own payslip
  if (req.user?.role !== 'admin' && req.user?.role !== 'super-admin') {
    const [self] = await query('SELECT id FROM employee WHERE email = ? OR username = ? LIMIT 1',
      req.user?.email || '', req.user?.username || '');
    if (!self || String(self.id) !== String(empId)) {
      return respond.badReq(res, 'You can only download your own payslip');
    }
  }

  // ── Fetch run, settings, employee ──────────────────────────────────────────
  const [run] = await query(`
    SELECT pr.id, pr.name, pr.date_start, pr.date_end, pr.status,
           pf.name AS freq_name
    FROM payrollruns pr
    LEFT JOIN payfrequencies pf ON pf.id = pr.pay_frequency
    WHERE pr.id = ? LIMIT 1`, BigInt(runId));
  if (!run) return respond.notFound(res, 'Payroll run not found');

  const [emp] = await query(`
    SELECT e.id, e.employee_id, e.firstName, e.lastName, e.email,
           e.bankAccount, e.designation, e.department
    FROM employee e WHERE e.id = ? LIMIT 1`, BigInt(empId));
  if (!emp) return respond.notFound(res, 'Employee not found');

  const payrollData = await query(`
    SELECT pc.id AS payroll_item_id, pc.name, pc.payment_deduction, pc.visible, pc.include_in_net,
           CAST(pd.amount AS CHAR) AS amount
    FROM payrolldata pd
    JOIN payrollcolumns pc ON pc.id = pd.payroll_item
    WHERE pd.payroll = ? AND pd.employee = ?
    ORDER BY COALESCE(pc.colorder, 99999)`, BigInt(runId), BigInt(empId));

  // Find the best-matching template: first by deduction group, then the default (NULL group)
  const allTemplates = await query('SELECT * FROM payslip_settings ORDER BY deduction_group_id IS NULL ASC, id ASC').catch(() => []);
  const [empPe] = await query('SELECT deduction_group FROM payrollemployees WHERE employee = ? LIMIT 1', BigInt(empId)).catch(() => [null]);
  const empGroup = empPe?.deduction_group ? String(empPe.deduction_group) : null;
  const [settings] = allTemplates.filter(t => empGroup && String(t.deduction_group_id) === empGroup)
    .concat(allTemplates.filter(t => !t.deduction_group_id));
  const s = settings || {};

  // ── Categorise columns ──────────────────────────────────────────────────────
  let visibleIds = null;
  if (s.visible_columns) {
    try { visibleIds = new Set(JSON.parse(s.visible_columns).map(String)); } catch { /* ignore */ }
  }
  const colVisible = (r) => r.visible != 0 && (!visibleIds || visibleIds.has(String(r.payroll_item_id)));
  const earnings   = payrollData.filter(r => r.payment_deduction === 'Payment'   && colVisible(r));
  const deductions = payrollData.filter(r => r.payment_deduction === 'Deduction' && colVisible(r));
  const netRow     = payrollData.find(r => (r.name || '').toLowerCase().startsWith('net'));
  const totalEarnings  = earnings.reduce((s, r) => s + parseFloat(r.amount || '0'), 0);
  const totalDeductions = deductions.reduce((s, r) => s + parseFloat(r.amount || '0'), 0);
  const netPay = netRow ? parseFloat(netRow.amount || '0') : (totalEarnings - totalDeductions);

  const [acR, acG, acB] = hexToRgb(s.accent_color);
  const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
  const period  = run.date_start
    ? `${run.date_start.slice(0, 10)} → ${(run.date_end || '').slice(0, 10)}`
    : run.name;

  // ── Build PDF ───────────────────────────────────────────────────────────────
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Payslip — ${empName}` } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payslip-${runId}-${empId}.pdf"`);
  doc.pipe(res);

  const pageW = doc.page.width - 100; // usable width (margin 50 each side)

  // Header banner
  doc.rect(50, 50, pageW, 60).fill([acR, acG, acB]);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(16)
    .text(s.company_name || 'Payslip', 70, 65);
  if (s.company_address) {
    doc.fillColor('white').font('Helvetica').fontSize(8).text(s.company_address, 70, 85, { width: pageW - 80 });
  }
  doc.fillColor('white').font('Helvetica').fontSize(9)
    .text('PAYSLIP', doc.page.width - 130, 72, { align: 'right', width: 80 })
    .text(period, doc.page.width - 130, 84, { align: 'right', width: 80 });

  let y = 125;

  // Header note
  if (s.header_note) {
    doc.fillColor('#6b7280').font('Helvetica-Oblique').fontSize(8).text(s.header_note, 50, y, { width: pageW });
    y += 20;
  }

  // Employee details grid
  doc.fillColor('#374151').font('Helvetica-Bold').fontSize(9).text('Employee Details', 50, y);
  y += 14;
  doc.rect(50, y, pageW, 1).fill('#e5e7eb'); y += 6;

  const infoItems = [['Name', empName]];
  if (s.show_emp_id && emp.employee_id)  infoItems.push(['Employee ID', emp.employee_id]);
  if (s.show_department && emp.department) infoItems.push(['Department', emp.department]);
  if (s.show_position && emp.designation) infoItems.push(['Position', emp.designation]);
  if (s.show_bank_account && emp.bankAccount) infoItems.push(['Bank Account', emp.bankAccount]);
  if (run.freq_name) infoItems.push(['Pay Frequency', run.freq_name]);

  const colW = pageW / 2;
  infoItems.forEach(([label, value], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 50 + col * colW;
    const iy = y + row * 18;
    doc.fillColor('#9ca3af').font('Helvetica').fontSize(8).text(label, x, iy);
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8).text(value, x, iy + 8);
  });
  y += (Math.ceil(infoItems.length / 2)) * 18 + 14;

  // Earnings & Deductions
  const halfW = (pageW - 8) / 2;

  // Section headers
  doc.fillColor([acR, acG, acB]).font('Helvetica-Bold').fontSize(9).text('Earnings', 50, y);
  doc.fillColor([acR, acG, acB]).font('Helvetica-Bold').fontSize(9).text('Deductions', 50 + halfW + 8, y);
  y += 14;
  doc.rect(50, y, halfW, 1).fill([acR, acG, acB]);
  doc.rect(50 + halfW + 8, y, halfW, 1).fill([acR, acG, acB]);
  y += 5;

  const maxRows = Math.max(earnings.length, deductions.length, 1);
  for (let i = 0; i < maxRows; i++) {
    const e = earnings[i];
    const d = deductions[i];
    if (e) {
      doc.fillColor('#4b5563').font('Helvetica').fontSize(8).text(e.name, 50, y, { width: halfW - 60 });
      doc.fillColor('#111827').font('Helvetica').fontSize(8).text(fmt(e.amount), 50 + halfW - 55, y, { width: 55, align: 'right' });
    }
    if (d) {
      doc.fillColor('#4b5563').font('Helvetica').fontSize(8).text(d.name, 58 + halfW, y, { width: halfW - 60 });
      doc.fillColor('#111827').font('Helvetica').fontSize(8).text(fmt(d.amount), 58 + halfW + halfW - 55, y, { width: 55, align: 'right' });
    }
    y += 14;
  }

  // Totals row
  y += 4;
  doc.rect(50, y, halfW, 1).fill('#d1d5db');
  doc.rect(50 + halfW + 8, y, halfW, 1).fill('#d1d5db');
  y += 5;
  doc.fillColor('#374151').font('Helvetica-Bold').fontSize(8).text('Total Earnings', 50, y, { width: halfW - 60 });
  doc.fillColor('#374151').font('Helvetica-Bold').fontSize(8).text(fmt(totalEarnings), 50 + halfW - 55, y, { width: 55, align: 'right' });
  doc.fillColor('#374151').font('Helvetica-Bold').fontSize(8).text('Total Deductions', 58 + halfW, y, { width: halfW - 60 });
  doc.fillColor('#374151').font('Helvetica-Bold').fontSize(8).text(fmt(totalDeductions), 58 + halfW + halfW - 55, y, { width: 55, align: 'right' });
  y += 22;

  // Net Pay banner
  doc.rect(50, y, pageW, 32).fill([Math.min(acR + 220, 255), Math.min(acG + 220, 255), Math.min(acB + 220, 255)]);
  doc.fillColor([acR, acG, acB]).font('Helvetica-Bold').fontSize(12).text('NET PAY', 65, y + 9);
  doc.fillColor([acR, acG, acB]).font('Helvetica-Bold').fontSize(12).text(fmt(netPay), doc.page.width - 130, y + 9, { align: 'right', width: 80 });
  y += 48;

  // Footer note
  if (s.footer_note) {
    doc.rect(50, y, pageW, 1).fill('#e5e7eb'); y += 6;
    doc.fillColor('#9ca3af').font('Helvetica-Oblique').fontSize(8).text(s.footer_note, 50, y, { width: pageW });
  }

  doc.end();
});

// ── My payslips list (for employee self-service) ──────────────────────────────
const getMyPayslips = asyncHandler(async (req, res) => {
  const [self] = await query(
    'SELECT id FROM employee WHERE email = ? OR username = ? LIMIT 1',
    req.user?.email || '', req.user?.username || ''
  );
  if (!self) return respond.notFound(res, 'Employee record not found for this user');
  const rows = await query(`
    SELECT pr.id AS run_id, pr.name, pr.date_start, pr.date_end, pr.status,
           pf.name AS freq_name
    FROM payrollruns pr
    LEFT JOIN payfrequencies pf ON pf.id = pr.pay_frequency
    WHERE pr.status IN ('Completed','Approved')
      AND EXISTS (
        SELECT 1 FROM payrolldata pd WHERE pd.payroll = pr.id AND pd.employee = ?
      )
    ORDER BY pr.date_start DESC, pr.created_at DESC`, BigInt(self.id));
  respond.ok(res, 'My payslips retrieved', { employeeId: String(self.id), runs: rows });
});

module.exports = { downloadPayslip, getMyPayslips };
