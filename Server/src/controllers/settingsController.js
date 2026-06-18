const { prisma }   = require('../helpers/dbQueryHelper');
const asyncHandler = require('../middleware/asyncHandler');
const respond      = require('../helpers/respondHelper');
const nodemailer   = require('nodemailer');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helpers

async function readEmailSettings() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'email_%'"
  ).catch(() => []);
  return Object.fromEntries(rows.map(r => [r.setting_key, r.setting_value ?? '']));
}

function buildSmtpConfig(db) {
  return {
    host:   db.email_smtp_host   || process.env.SMTP_HOST   || '',
    port:   Number(db.email_smtp_port || process.env.SMTP_PORT || 587),
    secure: (db.email_smtp_secure || process.env.SMTP_SECURE) === 'true',
    user:   db.email_smtp_user   || process.env.SMTP_USER   || '',
    pass:   db.email_smtp_pass   || process.env.SMTP_PASS   || '',
    from:   db.email_from        || process.env.SMTP_FROM   || db.email_smtp_user || process.env.SMTP_USER || '',
  };
}

// Endpoints

// GET /settings/email — retrieve SMTP email configuration stored in app_settings.
const getEmailSettings = asyncHandler(async (req, res) => {
  const settings = await readEmailSettings();
  return respond.ok(res, 'Email settings', settings);
});

// PUT /settings/email — upsert SMTP configuration keys; ignores unknown keys for safety.
const updateEmailSettings = asyncHandler(async (req, res) => {
  const ALLOWED_KEYS = [
    'email_enabled', 'email_smtp_host', 'email_smtp_port',
    'email_smtp_secure', 'email_smtp_user', 'email_smtp_pass', 'email_from',
  ];

  for (const k of ALLOWED_KEYS) {
    if (req.body[k] !== undefined) {
      await prisma.$executeRawUnsafe(
        'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        k, String(req.body[k])
      );
    }
  }

  return respond.ok(res, 'Email settings saved');
});

// POST /settings/email/test — send a styled HTML test email through the current SMTP configuration
// to verify connectivity before enabling system notifications.
const sendTestEmail = asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (!to) return respond.badReq(res, 'Recipient email is required');

  const db  = await readEmailSettings();
  const cfg = buildSmtpConfig(db);
  const sentFrom = escapeHtml(cfg.from || 'Not set');
  const smtpHost = escapeHtml(cfg.host || 'Not set');

  const transport = nodemailer.createTransport({
    host:   cfg.host,
    port:   cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  try {
    await transport.sendMail({
      from:    cfg.from,
      to,
      subject: 'HR System - Test Email',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <style>
            body{margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
            @media(max-width:620px){.outer{padding:18px 10px!important}.content{padding:28px 22px!important}.brand{padding:22px!important}}
          </style>
        </head>
        <body style="margin:0;padding:0;background:#eef2f7">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7">
            <tr><td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer" style="padding:40px 16px">
                <tr><td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;box-shadow:0 18px 42px rgba(15,23,42,.08)">
                    <tr>
                      <td class="brand" style="padding:24px 34px;background:#ffffff;border-top:5px solid #2563eb;border-bottom:1px solid #e5edf6">
                        <p style="margin:0;font-size:13px;line-height:1.4;color:#64748b;font-weight:700;text-transform:uppercase">Email Settings</p>
                        <h1 style="margin:2px 0 0;font-size:22px;line-height:1.25;font-weight:800;color:#0f172a">HR System Test Email</h1>
                      </td>
                    </tr>
                    <tr>
                      <td class="content" style="background:#ffffff;padding:36px 34px 34px">
                        <p style="margin:0 0 18px;font-size:16px;line-height:1.5;color:#334155">Your email configuration is working correctly.</p>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f8fafc;border:1px solid #e5edf6;border-radius:10px;overflow:hidden;margin:22px 0">
                          <tr>
                            <td style="padding:13px 16px;color:#64748b;font-size:13px;line-height:1.5;white-space:nowrap;vertical-align:top;font-weight:700;border-bottom:1px solid #e5edf6">Sent From</td>
                            <td style="padding:13px 16px 13px 0;font-size:14px;line-height:1.5;color:#0f172a;font-weight:700;border-bottom:1px solid #e5edf6">${sentFrom}</td>
                          </tr>
                          <tr>
                            <td style="padding:13px 16px;color:#64748b;font-size:13px;line-height:1.5;white-space:nowrap;vertical-align:top;font-weight:700">SMTP Host</td>
                            <td style="padding:13px 16px 13px 0;font-size:14px;line-height:1.5;color:#0f172a;font-weight:700">${smtpHost}</td>
                          </tr>
                        </table>
                        <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.6">You can now send HR notifications, interview messages, document alerts, and lifecycle updates from this system.</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background:#f8fafc;border-top:1px solid #e5edf6;padding:22px 34px;text-align:center">
                        <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8">This is an automated test message. Please do not reply directly to this email.</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });
    return respond.ok(res, 'Test email sent successfully');
  } catch (err) {
    return res.status(400).json({ status: '400', message: `Email error: ${err.message}` });
  }
});

// ── App control settings (Settings → Controls) ───────────────────────────────
// Server-side home for the General/Approvals toggles so they apply to every
// user instead of living in one browser's localStorage.

const CONTROL_KEYS = [
  'company_auto_generate_code', 'employee_auto_generate_number', 'recruitment_auto_generate_code',
  'approval_employee', 'approval_employee_self',
  'approval_payroll', 'approval_payroll_self',
  'approval_medical', 'approval_medical_self',
  'general_currency',
];

// GET /settings/controls — flat map of saved keys (client merges over its defaults)
const getControlSettings = asyncHandler(async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT name, value FROM settings WHERE category='app_controls'`
  ).catch(() => []);
  const map = {};
  for (const r of rows) if (CONTROL_KEYS.includes(r.name)) map[r.name] = r.value ?? '';
  respond.ok(res, 'Control settings', map);
});

// PUT /settings/controls — upsert any whitelisted keys present in the body
const saveControlSettings = asyncHandler(async (req, res) => {
  for (const key of CONTROL_KEYS) {
    if (req.body[key] === undefined) continue;
    const val = String(req.body[key]);
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM settings WHERE name=? AND category='app_controls'`, key
    ).catch(() => []);
    if (existing.length) {
      await prisma.$executeRawUnsafe(
        `UPDATE settings SET value=? WHERE name=? AND category='app_controls'`, val, key
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO settings (id, name, value, category) VALUES (?,?,?,'app_controls')`,
        BigInt(Date.now() + Math.floor(Math.random() * 9999)), key, val
      );
    }
  }
  respond.ok(res, 'Control settings saved');
});

// ── Module visibility settings ────────────────────────────────────────────────

const ALL_MODULE_IDS = [
  'Employees', 'LeaveManagement', 'Payroll', 'Insights',
  'Company', 'Recruitment', 'Documents', 'Admin',
  'Medical', 'Performance', 'Training',
  'Attendance',
];

const getModuleSettings = asyncHandler(async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT module_id, enabled FROM module_settings`
  ).catch(() => []);

  // Build a map of what the DB knows; anything missing defaults to enabled
  const dbMap = {};
  for (const r of rows) dbMap[r.module_id] = !!r.enabled;

  const disabled = ALL_MODULE_IDS.filter(id => dbMap[id] === false);
  return respond.ok(res, 'OK', { disabled });
});

const saveModuleSettings = asyncHandler(async (req, res) => {
  const { disabled } = req.body;
  const disabledSet = new Set(Array.isArray(disabled) ? disabled : []);

  for (const moduleId of ALL_MODULE_IDS) {
    const isEnabled = disabledSet.has(moduleId) ? 0 : 1;
    await prisma.$executeRawUnsafe(
      `INSERT INTO module_settings (module_id, enabled)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      moduleId, isEnabled
    );
  }

  return respond.ok(res, 'Module settings saved');
});

// ── App Setup (company name + logo) ───────────────────────────────────────────
// Persisted in the settings table under category 'app_setup' so App Setup edits survive reloads.

// GET /settings/app-setup
const getAppSetup = asyncHandler(async (req, res) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT name, value FROM settings WHERE category='app_setup'`
  ).catch(() => []);
  const map = {};
  for (const r of rows) map[r.name] = r.value ?? '';
  return respond.ok(res, 'App setup', {
    company_name: map.company_name ?? '',
    company_logo: map.company_logo ?? '',
  });
});

// PUT /settings/app-setup
const saveAppSetup = asyncHandler(async (req, res) => {
  const fields = { company_name: req.body.company_name, company_logo: req.body.company_logo };
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const val = String(value ?? '');
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM settings WHERE name=? AND category='app_setup'`, name
    ).catch(() => []);
    if (existing.length) {
      await prisma.$executeRawUnsafe(`UPDATE settings SET value=? WHERE name=? AND category='app_setup'`, val, name);
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO settings (id, name, value, category) VALUES (?,?,?,'app_setup')`,
        BigInt(Date.now() + Math.floor(Math.random() * 9999)), name, val
      );
    }
  }
  return respond.ok(res, 'App setup saved');
});

module.exports = { getEmailSettings, updateEmailSettings, sendTestEmail, getModuleSettings, saveModuleSettings, getControlSettings, saveControlSettings, getAppSetup, saveAppSetup };
