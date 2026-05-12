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

/**
 * Notifies approvers that a quote has been submitted for their review.
 * Stub mode if SMTP_HOST is missing or NODE_ENV === "test".
 *
 * @param {object} quote   - Mongoose quote document (ownerId populated)
 * @param {string} submitterName - Display name of the submitting user
 * @param {string} tier    - "Manager Review" | "Executive Review"
 */
async function sendApprovalRequestEmail(quote, submitterName, tier) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const quoteUrl = `${frontendUrl}/quotes/${quote._id}`;

  if (!process.env.SMTP_HOST || process.env.NODE_ENV === "test") {
    console.info(
      `[APPROVAL STUB] ${submitterName} submitted quote "${quote.clientName}" (${quote._id}) for ${tier}`,
    );
    return;
  }

  const transporter = createTransporter();
  const recipient =
    process.env.SMTP_APPROVER_EMAIL ||
    process.env.SMTP_FROM ||
    "approvals@enterprise-cpq.local";

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@enterprise-cpq.local",
    to: recipient,
    subject: `[${tier}] Quote "${quote.clientName}" awaits approval`,
    text: [
      `${submitterName} has submitted a quote for ${tier}.`,
      "",
      `Client: ${quote.clientName}`,
      `Membership: ${quote.membershipCount?.toLocaleString() ?? 0}`,
      `Net TCV: $${(quote.netTCV ?? 0).toLocaleString()}`,
      "",
      `Review: ${quoteUrl}`,
    ].join("\n"),
    html: `
      <p><strong>${submitterName}</strong> submitted a quote for <strong>${tier}</strong>.</p>
      <ul>
        <li><strong>Client:</strong> ${quote.clientName}</li>
        <li><strong>Membership:</strong> ${quote.membershipCount?.toLocaleString() ?? 0}</li>
        <li><strong>Net TCV:</strong> $${(quote.netTCV ?? 0).toLocaleString()}</li>
      </ul>
      <p><a href="${quoteUrl}">Review quote</a></p>
    `,
  });
}

/**
 * Notifies the quote owner of an approval decision.
 * Stub mode if SMTP_HOST is missing or NODE_ENV === "test".
 *
 * @param {string} toEmail      - Quote owner's email
 * @param {object} quote        - Mongoose quote document
 * @param {"Approved"|"Rejected"} decision
 * @param {string} comment      - Approver comment (may be empty)
 * @param {string} approverName - Display name of the approver
 */
async function sendApprovalDecisionEmail(
  toEmail,
  quote,
  decision,
  comment,
  approverName,
) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const quoteUrl = `${frontendUrl}/quotes/${quote._id}`;

  if (!process.env.SMTP_HOST || process.env.NODE_ENV === "test") {
    console.info(
      `[DECISION STUB] Quote "${quote.clientName}" (${quote._id}) was ${decision} by ${approverName}`,
    );
    return;
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@enterprise-cpq.local",
    to: toEmail,
    subject: `Your quote "${quote.clientName}" was ${decision}`,
    text: [
      `Your quote "${quote.clientName}" has been ${decision} by ${approverName}.`,
      comment ? `\nComment: ${comment}` : "",
      "",
      `View quote: ${quoteUrl}`,
    ].join("\n"),
    html: `
      <p>Your quote <strong>${quote.clientName}</strong> has been
        <strong>${decision}</strong> by ${approverName}.</p>
      ${comment ? `<p><strong>Comment:</strong> ${comment}</p>` : ""}
      <p><a href="${quoteUrl}">View quote</a></p>
    `,
  });
}

module.exports = {
  sendPasswordResetEmail,
  sendInviteEmail,
  sendApprovalRequestEmail,
  sendApprovalDecisionEmail,
};
