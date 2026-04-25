const nodemailer = require('nodemailer');

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      'Email not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env'
    );
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendPasswordReset(toEmail, toName, resetUrl) {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"KronosPortal" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Reset your KronosPortal password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1e40af">Reset your password</h2>
        <p>Hi ${toName},</p>
        <p>We received a request to reset your KronosPortal password. Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Reset Password
        </a>
        <p style="color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        <p style="color:#6b7280;font-size:13px">Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
      </div>
    `,
  });
}

async function sendContactForm({ name, email, teamSize, message }) {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"KronosPortal" <${process.env.SMTP_USER}>`,
    to: process.env.SMTP_USER,
    subject: `Demo Request from ${name}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1e40af">New Demo Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Team Size:</strong> ${teamSize || 'Not specified'}</p>
        <p><strong>Message:</strong> ${message || 'None'}</p>
      </div>
    `,
  });
}

async function sendTimeCorrectionDecision({ toEmail, toName, status, reviewNote, reviewerName, entries }) {
  const transporter = createTransport();
  const approved = status === 'approved';
  const color = approved ? '#16a34a' : '#dc2626';
  const label = approved ? 'Approved' : 'Denied';

  const entryRows = entries
    .filter((e) => e.date)
    .map((e) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${e.date}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${e.clockIn || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${e.clockOut || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${e.reason || '—'}</td>
      </tr>`)
    .join('');

  await transporter.sendMail({
    from: `"KronosPortal" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `Time Correction ${label} — KronosPortal`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
        <h2 style="color:${color};margin-bottom:4px">Time Correction ${label}</h2>
        <p>Hi ${toName},</p>
        <p>Your time correction request has been <strong style="color:${color}">${label.toLowerCase()}</strong> by ${reviewerName}.</p>
        ${reviewNote ? `<p style="background:#f3f4f6;padding:12px;border-radius:8px;font-size:14px"><strong>Note:</strong> ${reviewNote}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb">Date</th>
              <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb">Clock In</th>
              <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb">Clock Out</th>
              <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb">Reason</th>
            </tr>
          </thead>
          <tbody>${entryRows}</tbody>
        </table>
        <p style="color:#6b7280;font-size:13px">Log in to KronosPortal to view your schedule.</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordReset, sendContactForm, sendTimeCorrectionDecision };
