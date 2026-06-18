const path         = require('path');
const fs           = require('fs');
const respond      = require('../helpers/respondHelper');
const asyncHandler = require('../middleware/asyncHandler');
const { UPLOAD_DIR } = require('../middleware/upload');
const { prisma }   = require('../helpers/dbQueryHelper');

const { toBigInt, s } = require('../helpers/controllerHelpers');

// POST /employees/documents/upload
const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) return respond.badReq(res, 'No file provided');
  respond.ok(res, 'Document uploaded', { filename: req.file.filename });
});

// GET /documents/:filename  — served inline so images/PDFs render in the browser
const downloadDocument = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const safe = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, safe);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Document not found' });
  }

  const mimeMap = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png',  '.gif': 'image/gif', '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };
  const ext         = path.extname(safe).toLowerCase();
  const contentType = mimeMap[ext] || 'application/octet-stream';

  // disposition param: inline = view in browser, attachment = force download
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `${disposition}; filename="${safe}"`);
  res.sendFile(filePath);
});

// GET /documents/my-shared
// Company documents shared with the current user (via department or employee ID)
const getMySharedDocs = asyncHandler(async (req, res) => {
  const userId = toBigInt(req.user?.id);
  if (!userId) return respond.ok(res, 'Not authenticated', []);

  // Resolve employee ID from users table
  const userRow = await prisma.$queryRawUnsafe(
    `SELECT employeeId FROM users WHERE id=? LIMIT 1`, userId
  ).then(r => r[0]).catch(() => null);

  const empId = userRow?.employeeId;
  if (!empId) return respond.ok(res, 'No employee record linked', []);

  const empIdStr = String(empId);

  // Get employee's department
  const emp = await prisma.$queryRawUnsafe(
    `SELECT departmentId FROM employee WHERE id=? LIMIT 1`, toBigInt(empId)
  ).then(r => r[0]).catch(() => null);

  const deptId = emp?.departmentId ? String(emp.departmentId) : null;

  const allDocs = await prisma.companydocuments.findMany({
    where: { status: 'Active' },
    orderBy: { id: 'desc' },
  }).catch(() => []);

  const visible = allDocs.filter(doc => {
    const depts  = (doc.share_departments || '').split(',').map(x => x.trim()).filter(Boolean);
    const emps   = (doc.share_employees   || '').split(',').map(x => x.trim()).filter(Boolean);
    const levels = (doc.share_userlevel   || '').split(',').map(x => x.trim()).filter(Boolean);

    if (!depts.length && !emps.length && !levels.length) return true; // unscoped = all
    if (levels.includes('All'))  return true;
    if (depts.includes('All'))   return true;
    if (deptId && depts.includes(deptId)) return true;
    if (emps.includes(empIdStr)) return true;
    return false;
  });

  respond.ok(res, 'Shared documents', s(visible));
});

// GET /documents/my-personal
// Employee documents uploaded for the current user
const getMyPersonalDocs = asyncHandler(async (req, res) => {
  const empId = req.user?.employeeId;
  if (!empId) return respond.ok(res, 'No employee record linked', []);

  const rows = await prisma.$queryRawUnsafe(`
    SELECT ed.*,
           d.name  AS document_type_name,
           d.details AS document_type_details
    FROM employeedocuments ed
    LEFT JOIN documents d ON d.id = ed.document
    WHERE ed.employee = ?
      AND (ed.status IS NULL OR ed.status != 'Archived')
    ORDER BY ed.date_added DESC
  `, toBigInt(empId)).catch(() => []);

  respond.ok(res, 'Personal documents', s(rows));
});

// GET /documents/settings
const getDocumentSettings = asyncHandler(async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT name, value FROM settings WHERE category='document_settings'`
  ).catch(() => []);
  const map = { allow_document_download: 'No' };
  for (const r of rows) if (r.name in map) map[r.name] = r.value ?? map[r.name];
  respond.ok(res, 'Document settings', map);
});

// PUT /documents/settings
const updateDocumentSettings = asyncHandler(async (req, res) => {
  const KEYS = ['allow_document_download'];
  for (const key of KEYS) {
    if (req.body[key] === undefined) continue;
    const val = String(req.body[key]);
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM settings WHERE name=? AND category='document_settings'`, key
    ).catch(() => []);
    if (existing.length) {
      await prisma.$executeRawUnsafe(
        `UPDATE settings SET value=? WHERE name=? AND category='document_settings'`, val, key
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO settings (id, name, value, category) VALUES (?,?,?,'document_settings')`,
        BigInt(Date.now() + Math.floor(Math.random() * 9999)), key, val
      );
    }
  }
  respond.ok(res, 'Document settings saved');
});

// GET /documents/company
const getCompanyDocs = asyncHandler(async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM companydocuments WHERE status='Active' ORDER BY id DESC`
  ).catch(() => []);
  respond.ok(res, 'Company documents', s(rows));
});

// POST /documents/company
const createCompanyDoc = asyncHandler(async (req, res) => {
  const { name, details, share_departments, share_employees, share_userlevel, attachment, valid_until } = req.body;
  if (!name) return respond.badReq(res, 'Name is required');
  const id = BigInt(Date.now());
  await prisma.$executeRawUnsafe(
    `INSERT INTO companydocuments (id, name, details, share_departments, share_employees, share_userlevel, attachment, valid_until, status)
     VALUES (?,?,?,?,?,?,?,?,'Active')`,
    id, name, details || null,
    share_departments || null, share_employees || null, share_userlevel || null,
    attachment || null, valid_until || null
  );
  respond.ok(res, 'Company document created', { id: String(id) });
});

// PUT /documents/company/:id
const updateCompanyDoc = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid id');
  const { name, details, share_departments, share_employees, share_userlevel, attachment, valid_until } = req.body;
  await prisma.$executeRawUnsafe(
    `UPDATE companydocuments SET name=?, details=?, share_departments=?, share_employees=?, share_userlevel=?, attachment=?, valid_until=? WHERE id=?`,
    name, details || null,
    share_departments || null, share_employees || null, share_userlevel || null,
    attachment || null, valid_until || null, id
  );
  respond.ok(res, 'Company document updated');
});

// DELETE /documents/company/:id  — soft-delete via status
const deleteCompanyDoc = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid id');
  await prisma.$executeRawUnsafe(
    `UPDATE companydocuments SET status='Archived' WHERE id=?`, id
  );
  respond.ok(res, 'Company document deleted');
});

// ─── Employee document admin CRUD ─────────────────────────────────────────────

// Upsert a document type by name and return its ID
async function resolveDocTypeId(name) {
  if (!name) return null;
  const existing = await prisma.$queryRawUnsafe(
    'SELECT id FROM documents WHERE name=? LIMIT 1', name
  ).then(r => r[0]).catch(() => null);
  if (existing) return existing.id;
  const newId = BigInt(Date.now());
  await prisma.$executeRawUnsafe('INSERT INTO documents (id, name) VALUES (?,?)', newId, name);
  return newId;
}

// GET /documents/employee
const getEmployeeDocs = asyncHandler(async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT ed.id, ed.employee, ed.date_added, ed.valid_until,
           ed.place_of_issue, ed.details, ed.attachment, ed.expire_notification_last,
           CONCAT(e.firstName, ' ', e.lastName) AS employee_name,
           d.name AS document_type_name
    FROM employeedocuments ed
    JOIN employee e ON e.id = ed.employee
    LEFT JOIN documents d ON d.id = ed.document
    WHERE ed.status = 'Active'
    ORDER BY ed.id DESC
  `).catch(() => []);
  respond.ok(res, 'Employee documents', s(rows));
});

// POST /documents/employee
const createEmployeeDoc = asyncHandler(async (req, res) => {
  const { employee, documentType, dateOfIssue, placeOfIssue, expiryDate, details, attachment } = req.body;
  if (!employee) return respond.badReq(res, 'Employee is required');
  const docTypeId = await resolveDocTypeId(documentType);
  const id = BigInt(Date.now());
  await prisma.$executeRawUnsafe(
    `INSERT INTO employeedocuments (id, employee, document, date_added, valid_until, place_of_issue, details, attachment, status)
     VALUES (?,?,?,?,?,?,?,?,'Active')`,
    id, toBigInt(employee), docTypeId,
    dateOfIssue || null, expiryDate || null,
    placeOfIssue || null, details || null, attachment || null
  );
  respond.ok(res, 'Employee document created', { id: String(id) });
});

// PUT /documents/employee/:id
const updateEmployeeDoc = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid id');
  const { employee, documentType, dateOfIssue, placeOfIssue, expiryDate, details, attachment } = req.body;
  const docTypeId = await resolveDocTypeId(documentType);
  await prisma.$executeRawUnsafe(
    `UPDATE employeedocuments
     SET employee=?, document=?, date_added=?, valid_until=?, place_of_issue=?, details=?, attachment=?
     WHERE id=?`,
    toBigInt(employee), docTypeId,
    dateOfIssue || null, expiryDate || null,
    placeOfIssue || null, details || null, attachment || null, id
  );
  respond.ok(res, 'Employee document updated');
});

// DELETE /documents/employee/:id  — soft-delete
const deleteEmployeeDoc = asyncHandler(async (req, res) => {
  const id = toBigInt(req.params.id);
  if (!id) return respond.badReq(res, 'Invalid id');
  await prisma.$executeRawUnsafe(
    `UPDATE employeedocuments SET status='Archived' WHERE id=?`, id
  );
  respond.ok(res, 'Employee document deleted');
});

// POST /documents/employee/notify-expired
// Finds all expired employee documents not yet notified, sends emails, marks as notified
const notifyExpiredDocs = asyncHandler(async (req, res) => {
  const { sendDocumentExpiryEmail } = require('../helpers/emailHelper');
  const today = new Date().toISOString().slice(0, 10);

  const expired = await prisma.$queryRawUnsafe(`
    SELECT ed.id, ed.valid_until,
           e.firstName, e.lastName, e.work_email,
           d.name AS document_type_name
    FROM employeedocuments ed
    JOIN employee e ON e.id = ed.employee
    LEFT JOIN documents d ON d.id = ed.document
    WHERE ed.status = 'Active'
      AND ed.valid_until IS NOT NULL
      AND ed.valid_until <= ?
      AND ed.expire_notification_last IS NULL
  `, today).catch(() => []);

  let sent = 0;
  for (const doc of expired) {
    if (doc.work_email) {
      await sendDocumentExpiryEmail({
        to:           doc.work_email,
        employeeName: `${doc.firstName ?? ''} ${doc.lastName ?? ''}`.trim(),
        docType:      doc.document_type_name || 'Document',
        expiryDate:   doc.valid_until,
      }).catch(() => {});
      sent++;
    }
    await prisma.$executeRawUnsafe(
      'UPDATE employeedocuments SET expire_notification_last=? WHERE id=?',
      Math.floor(Date.now() / 1000), toBigInt(doc.id)
    ).catch(() => {});
  }

  respond.ok(res, `Notified ${sent} of ${expired.length} expired document(s)`, { notified: sent, total: expired.length });
});

module.exports = {
  uploadDocument,
  downloadDocument,
  getMySharedDocs,
  getMyPersonalDocs,
  getDocumentSettings,
  updateDocumentSettings,
  getCompanyDocs,
  createCompanyDoc,
  updateCompanyDoc,
  deleteCompanyDoc,
  getEmployeeDocs,
  createEmployeeDoc,
  updateEmployeeDoc,
  deleteEmployeeDoc,
  notifyExpiredDocs,
};
