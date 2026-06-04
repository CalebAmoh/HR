const nodemailer = require('nodemailer');

// ── Config resolution ──────────────────────────────────────────────────────────

async function resolveMailConfig() {
  try {
    const { prisma } = require('./dbQueryHelper');
    const rows = await prisma.$queryRawUnsafe(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'email_%'"
    );
    const db = Object.fromEntries(rows.map(r => [r.setting_key, r.setting_value ?? '']));
    return {
      enabled: (db.email_enabled ?? '1') !== '0',
      host:    db.email_smtp_host   || process.env.SMTP_HOST   || 'smtp.gmail.com',
      port:    Number(db.email_smtp_port || process.env.SMTP_PORT || 587),
      secure:  (db.email_smtp_secure || process.env.SMTP_SECURE) === 'true',
      user:    db.email_smtp_user   || process.env.SMTP_USER   || '',
      pass:    db.email_smtp_pass   || process.env.SMTP_PASS   || '',
      from:    db.email_from        || process.env.SMTP_FROM   || db.email_smtp_user || process.env.SMTP_USER || '',
    };
  } catch {
    return {
      enabled: true,
      host:    process.env.SMTP_HOST   || 'smtp.gmail.com',
      port:    Number(process.env.SMTP_PORT || 587),
      secure:  process.env.SMTP_SECURE === 'true',
      user:    process.env.SMTP_USER   || '',
      pass:    process.env.SMTP_PASS   || '',
      from:    process.env.SMTP_FROM   || process.env.SMTP_USER || '',
    };
  }
}

async function resolveBranding() {
  try {
    const { prisma } = require('./dbQueryHelper');
    const [row] = await prisma.$queryRawUnsafe(
      'SELECT company_name, company_address, company_logo_url, accent_color FROM payslip_settings LIMIT 1'
    );
    return {
      name:    row?.company_name    || 'HR System',
      address: row?.company_address || '',
      logoUrl: row?.company_logo_url || '',
      accent:  row?.accent_color    || '#2563eb',
    };
  } catch {
    return { name: 'HR System', address: '', logoUrl: '', accent: '#2563eb' };
  }
}

async function makeTransporter() {
  const cfg = await resolveMailConfig();
  if (!cfg.enabled) return null;
  const transport = nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  return { transport, from: cfg.from };
}

// ── Shared email shell ─────────────────────────────────────────────────────────

function emailShell({ branding, preheader = '', body }) {
  const { name, address, logoUrl, accent } = branding;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${name}" style="max-height:48px;max-width:180px;object-fit:contain;display:block;margin:0 auto 12px" />`
    : '';

  const addressHtml = address
    ? `<p style="margin:4px 0 0;font-size:11px;color:#9ca3af">${address}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
    a{color:${accent}}
    @media(prefers-color-scheme:dark){body{background:#0f172a}}
  </style>
</head>
<body style="margin:0;padding:0;background:#f1f5f9">
  ${preheader ? `<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}</div>` : ''}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:580px" cellpadding="0" cellspacing="0">

        <!-- Header / Logo -->
        <tr>
          <td style="background:${accent};border-radius:12px 12px 0 0;padding:28px 32px;text-align:center">
            ${logoHtml}
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">${name}</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center">
            <p style="margin:0;font-size:12px;color:#64748b;font-weight:600">${name}</p>
            ${addressHtml}
            <p style="margin:12px 0 0;font-size:11px;color:#94a3b8">This is an automated message — please do not reply directly to this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Shared style helpers ───────────────────────────────────────────────────────

function infoTable(rows) {
  const cells = rows.filter(Boolean).map(([label, value]) => `
    <tr>
      <td style="padding:10px 16px 10px 0;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top;font-weight:500">${label}</td>
      <td style="padding:10px 0;font-size:13px;color:#0f172a;font-weight:600">${value}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:20px 0">
    ${cells}
  </table>`;
}

function primaryButton(label, href, accent) {
  return `<a href="${href}"
    style="display:inline-block;background:${accent};color:#ffffff;padding:14px 32px;border-radius:8px;
           text-decoration:none;font-weight:700;font-size:15px;letter-spacing:-0.2px;margin-top:8px">
    ${label} &rarr;
  </a>`;
}

function badge(text, color) {
  return `<span style="display:inline-block;background:${color};color:#fff;padding:3px 12px;border-radius:999px;font-size:12px;font-weight:600">${text}</span>`;
}

function greeting(name) {
  return `<p style="margin:0 0 20px;font-size:15px;color:#334155">Hello <strong>${name}</strong>,</p>`;
}

function muted(text) {
  return `<p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.6">${text}</p>`;
}

// ── Email functions ────────────────────────────────────────────────────────────

async function sendWelcomeEmail({ to, name, username, password }) {
  const [t, branding] = await Promise.all([makeTransporter(), resolveBranding()]);
  if (!t) return;

  const body = `
    ${greeting(name)}
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6">
      Your HR system account has been created. Use the credentials below to sign in for the first time.
    </p>
    ${infoTable([
      ['Username', `<span style="font-family:monospace;font-size:13px">${username}</span>`],
      ['Password', `<span style="font-family:monospace;font-size:13px">${password}</span>`],
    ])}
    <p style="margin:20px 0 0;font-size:13px;color:#ef4444;font-weight:600">
      ⚠ Please change your password immediately after your first login.
    </p>
    ${muted('If you did not expect this email, please contact your HR administrator immediately.')}
  `;

  await t.transport.sendMail({
    from: t.from, to,
    subject: `Your ${branding.name} Account`,
    html: emailShell({ branding, preheader: `Your account credentials for ${branding.name}`, body }),
  });
}

async function sendLeaveEmail({ to, employeeName, action, leaveType, dateStart, dateEnd, reason }) {
  const [t, branding] = await Promise.all([makeTransporter(), resolveBranding()]);
  if (!t) return;

  const labels  = { submitted: 'Leave Application Submitted', approved: 'Leave Approved', rejected: 'Leave Rejected', cancelled: 'Leave Cancelled' };
  const colors  = { submitted: '#3b82f6', approved: '#22c55e', rejected: '#ef4444', cancelled: '#f59e0b' };
  const subject = labels[action] ?? `Leave Update`;
  const color   = colors[action] ?? '#6b7280';

  const body = `
    ${greeting(employeeName)}
    <p style="margin:0 0 4px;font-size:14px;color:#475569">Your leave application status has been updated:</p>
    <p style="margin:0 0 20px">${badge(action.charAt(0).toUpperCase() + action.slice(1), color)}</p>
    ${infoTable([
      ['Leave Type', leaveType],
      ['From',       dateStart],
      ['To',         dateEnd],
      reason ? ['Reason', reason] : null,
    ])}
    ${muted('If you have questions about this decision, please contact your HR administrator.')}
  `;

  await t.transport.sendMail({
    from: t.from, to, subject,
    html: emailShell({ branding, preheader: subject, body }),
  });
}

async function sendSchedulingInvite({ to, candidateName, jobTitle, slots, link, expiresAt }) {
  const [t, branding] = await Promise.all([makeTransporter(), resolveBranding()]);
  if (!t) return;

  const slotItems = slots.map(slot => {
    const label = new Date(slot).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    return `<li style="padding:10px 0;border-bottom:1px solid #e2e8f0;list-style:none;font-size:13px;color:#334155">📅 &nbsp;${label}</li>`;
  }).join('');

  const expiryNote = expiresAt
    ? muted(`This scheduling link expires on ${new Date(expiresAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`)
    : '';

  const body = `
    ${greeting(candidateName)}
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6">
      Congratulations! You have been shortlisted for the <strong>${jobTitle}</strong> position.
      Please select a convenient time for your interview from the available slots below.
    </p>
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Available Slots</p>
    <ul style="padding:0;margin:0 0 28px;border-top:1px solid #e2e8f0">${slotItems}</ul>
    <div style="text-align:center;padding:8px 0 4px">
      ${primaryButton('Choose Your Slot', link, branding.accent)}
    </div>
    ${expiryNote}
  `;

  await t.transport.sendMail({
    from: t.from, to,
    subject: `Interview Invitation — ${jobTitle}`,
    html: emailShell({ branding, preheader: `You've been shortlisted for ${jobTitle}`, body }),
  });
}

async function sendInterviewConfirmation({ to, name, jobTitle, level, datetime, location, interviewers, icsContent }) {
  const [t, branding] = await Promise.all([makeTransporter(), resolveBranding()]);
  if (!t) return;

  const body = `
    ${greeting(name)}
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6">
      Your interview has been confirmed. Please find the details below. A calendar invite is attached to this email.
    </p>
    ${infoTable([
      ['Position',     jobTitle],
      level        ? ['Round',        level]        : null,
      ['Date &amp; Time', datetime],
      location     ? ['Location',     location]     : null,
      interviewers ? ['Interviewers', interviewers] : null,
    ])}
    ${muted('If you need to reschedule or have any questions, please contact your HR administrator as soon as possible.')}
  `;

  await t.transport.sendMail({
    from: t.from, to,
    subject: `Interview Confirmed — ${jobTitle}`,
    html: emailShell({ branding, preheader: `Your interview for ${jobTitle} is confirmed`, body }),
    attachments: [{ filename: 'interview.ics', content: icsContent, contentType: 'text/calendar' }],
  });
}

async function sendCandidateStageEmail({ to, candidateName, stageName, jobTitle }) {
  const [t, branding] = await Promise.all([makeTransporter(), resolveBranding()]);
  if (!t) return;

  const body = `
    ${greeting(candidateName)}
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6">
      We are pleased to inform you that your application${jobTitle ? ` for <strong>${jobTitle}</strong>` : ''} has progressed to the next stage.
    </p>
    ${infoTable([
      ['Current Stage', `${badge(stageName, branding.accent)}`],
      jobTitle ? ['Position', jobTitle] : null,
    ])}
    <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.6">
      Our team will be in touch shortly with the next steps. Thank you for your continued interest.
    </p>
    ${muted('If you have questions, please contact your HR administrator.')}
  `;

  await t.transport.sendMail({
    from: t.from, to,
    subject: `Application Update — ${stageName}${jobTitle ? ` · ${jobTitle}` : ''}`,
    html: emailShell({ branding, preheader: `Your application has moved to ${stageName}`, body }),
  });
}

function buildIcs({ uid, summary, dtstart, dtend, location, organizerEmail, attendeeEmail }) {
  const fmt = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HR System//EN',
    'BEGIN:VEVENT',
    `UID:${uid}@hr`,
    `DTSTART:${fmt(new Date(dtstart))}`,
    `DTEND:${fmt(new Date(dtend))}`,
    `SUMMARY:${summary}`,
    location       ? `LOCATION:${location}`              : '',
    organizerEmail ? `ORGANIZER:MAILTO:${organizerEmail}` : '',
    attendeeEmail  ? `ATTENDEE:MAILTO:${attendeeEmail}`   : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

module.exports = { sendWelcomeEmail, sendLeaveEmail, sendSchedulingInvite, sendInterviewConfirmation, buildIcs, sendCandidateStageEmail };
