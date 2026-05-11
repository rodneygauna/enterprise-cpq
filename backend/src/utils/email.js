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

module.exports = { sendPasswordResetEmail };
