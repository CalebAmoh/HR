const { prisma }   = require('../helpers/dbQueryHelper');
const asyncHandler = require('../middleware/asyncHandler');
const respond      = require('../helpers/respondHelper');
const nodemailer   = require('nodemailer');

async function safeExec(sql, ...params) {
  try { await prisma.$executeRawUnsafe(sql, ...params); } catch {}
}

// ── One-time setup ─────────────────────────────────────────────────────────────

(async () => {
  // Create key/value settings table
  await safeExec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id           BIGINT NOT NULL AUTO_INCREMENT,
      setting_key  VARCHAR(100) NOT NULL,
      setting_value TEXT,
      PRIMARY KEY (id),
      UNIQUE KEY uk_skey (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Seed email defaults from .env — INSERT IGNORE skips if already set by user
  const defaults = [
    ['email_enabled',     '1'],
    ['email_smtp_host',   process.env.SMTP_HOST   || ''],
    ['email_smtp_port',   process.env.SMTP_PORT   || '587'],
    ['email_smtp_secure', process.env.SMTP_SECURE || 'false'],
    ['email_smtp_user',   process.env.SMTP_USER   || ''],
    ['email_smtp_pass',   process.env.SMTP_PASS   || ''],
    ['email_from',        process.env.SMTP_FROM   || process.env.SMTP_USER || ''],
  ];

  for (const [k, v] of defaults) {
    await safeExec(
      'INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)', k, v
    );
  }
})();

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Endpoints ──────────────────────────────────────────────────────────────────

const getEmailSettings = asyncHandler(async (req, res) => {
  const settings = await readEmailSettings();
  return respond.ok(res, 'Email settings', settings);
});

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

const sendTestEmail = asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (!to) return respond.badReq(res, 'Recipient email is required');

  const db  = await readEmailSettings();
  const cfg = buildSmtpConfig(db);

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
      subject: 'HR System — Test Email',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f4f6f9;padding:24px">
          <div style="background:#fff;border-radius:12px;padding:28px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
            <h2 style="margin:0 0 12px;font-size:18px;color:#111">Test Email</h2>
            <p style="color:#555;margin:0">Your HR System email configuration is working correctly.</p>
            <p style="color:#9ca3af;font-size:12px;margin:20px 0 0">Sent from: ${cfg.from}</p>
          </div>
        </div>
      `,
    });
    return respond.ok(res, 'Test email sent successfully');
  } catch (err) {
    return res.status(400).json({ status: '400', message: `Email error: ${err.message}` });
  }
});

module.exports = { getEmailSettings, updateEmailSettings, sendTestEmail };
