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

module.exports = { sendPasswordReset };
