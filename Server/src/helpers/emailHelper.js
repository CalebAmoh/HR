const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendWelcomeEmail({ to, name, username, password }) {
  await transporter.sendMail({
    from:    process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Your HR System Account',
    html: `
      <p>Hello ${name},</p>
      <p>Your HR System account has been created. Use the credentials below to sign in:</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Username</td><td>${username}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Password</td><td style="font-family:monospace">${password}</td></tr>
      </table>
      <p>Please change your password after your first login.</p>
      <p>If you did not expect this email, contact your HR administrator.</p>
    `,
  });
}

async function sendLeaveEmail({ to, employeeName, action, leaveType, dateStart, dateEnd, reason }) {
  const actionLabels = {
    submitted:  'Leave Application Submitted',
    approved:   'Leave Application Approved',
    rejected:   'Leave Application Rejected',
    cancelled:  'Leave Application Cancelled',
  };
  const subject = actionLabels[action] ?? `Leave Update: ${action}`;

  const actionColors = { submitted: '#3b82f6', approved: '#22c55e', rejected: '#ef4444', cancelled: '#f59e0b' };
  const color = actionColors[action] ?? '#6b7280';

  const reasonHtml = reason
    ? `<p><strong>Reason:</strong> ${reason}</p>`
    : '';

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <div style="background:${color};padding:16px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#fff;margin:0;font-size:18px">${subject}</h2>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          <p>Hello ${employeeName},</p>
          <table style="border-collapse:collapse;margin:16px 0;width:100%">
            <tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap">Leave Type</td><td style="padding:6px 0;font-weight:600">${leaveType}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap">From</td><td style="padding:6px 0">${dateStart}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap">To</td><td style="padding:6px 0">${dateEnd}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap">Status</td><td style="padding:6px 0"><span style="background:${color};color:#fff;padding:2px 10px;border-radius:999px;font-size:12px">${action.charAt(0).toUpperCase() + action.slice(1)}</span></td></tr>
          </table>
          ${reasonHtml}
          <p style="color:#6b7280;font-size:13px;margin-top:24px">If you have questions, please contact your HR administrator.</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendWelcomeEmail, sendLeaveEmail };
