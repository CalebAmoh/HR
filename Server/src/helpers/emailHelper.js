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

module.exports = { sendWelcomeEmail };
