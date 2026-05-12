const nodemailer = require("nodemailer");

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Sends a password-reset email containing a link with the raw (unhashed) token.
 * The link expires in 1 hour (enforced server-side).
 */
async function sendPasswordResetEmail(toEmail, rawToken) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@enterprise-cpq.local",
    to: toEmail,
    subject: "Password Reset Request",
    text: [
      "You requested a password reset for your Enterprise CPQ account.",
      "",
      `Reset link (expires in 1 hour): ${resetUrl}`,
      "",
      "If you did not request this, please ignore this email.",
    ].join("\n"),
    html: `
      <p>You requested a password reset for your Enterprise CPQ account.</p>
      <p>
        <a href="${resetUrl}">Click here to reset your password</a>
        (link expires in 1 hour)
      </p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });
}

/**
 * Sends an account-invitation email.
 * If SMTP_HOST is not configured, or running in the test environment,
 * logs the invite URL to the console instead (stub mode).
 *
 * @param {string} toEmail      - invited user's email address
 * @param {string} rawToken     - unhashed invite token (goes in the URL)
 * @param {string} inviterName  - display name of the admin who sent the invite
 */
async function sendInviteEmail(toEmail, rawToken, inviterName) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const inviteUrl = `${frontendUrl}/accept-invite?email=${encodeURIComponent(toEmail)}&invite=${encodeURIComponent(rawToken)}`;

  // Stub mode: no SMTP configured, or running in the test environment
  if (!process.env.SMTP_HOST || process.env.NODE_ENV === "test") {
    console.info(
      `[INVITE STUB] ${inviterName} invited ${toEmail} — accept link: ${inviteUrl}`,
    );
    return;
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@enterprise-cpq.local",
    to: toEmail,
    subject: `You've been invited to Enterprise CPQ`,
    text: [
      `${inviterName} has invited you to join Enterprise CPQ.`,
      "",
      `Accept your invitation (link expires in 24 hours):`,
      inviteUrl,
      "",
      "If you did not expect this invitation, you can safely ignore this email.",
    ].join("\n"),
    html: `
      <p>${inviterName} has invited you to join <strong>Enterprise CPQ</strong>.</p>
      <p>
        <a href="${inviteUrl}">Accept invitation</a>
        (link expires in 24 hours)
      </p>
      <p>If you did not expect this invitation, you can safely ignore this email.</p>
    `,
  });
}

module.exports = { sendPasswordResetEmail, sendInviteEmail };
