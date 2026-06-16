import { Resend } from "resend";
import ejs from "ejs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://0.0.0.0:3000").replace(/\/$/, "");
// Logos are served from the backend — use BACKEND_URL so email clients can reach them.
// Falls back to FRONTEND_URL for local dev where both run behind the same proxy.
const BACKEND_URL = (process.env.BACKEND_URL || FRONTEND_URL).replace(/\/$/, "");
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@1879techhub.com";
const NOTIFICATION_INBOX = process.env.SUPERADMIN_NOTIFICATION_EMAIL || process.env.CONTACT_INBOX_EMAIL || FROM_EMAIL;

const TEMPLATES_DIR = path.join(__dirname, "..", "templates", "emails");

async function renderTemplate(name: string, data: Record<string, unknown>): Promise<string> {
  const commonData = {
    nexaLogoUrl: `${FRONTEND_URL}/1879-22.png`,
    ...data
  };
  return ejs.renderFile(path.join(TEMPLATES_DIR, `${name}.ejs`), commonData, { async: false });
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const response = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
  if (response.error) {
    throw new Error(response.error.message);
  }
}

export async function sendVerificationEmail(
  email: string,
  otp: string,
  fullName: string,
  businessUnit: string,
  brandColor?: string
): Promise<void> {
  const color = brandColor || '#ed0000';
  try {
    const html = await renderTemplate("verification", {
      fullName,
      otp,
      businessUnit,
      brandColor: color,
      year: new Date().getFullYear()
    });
    await sendEmail(email, `${businessUnit} — Verify Your Nexa AI Account`, html);
    console.log(`Verification OTP sent to ${email}`);
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  fullName: string
): Promise<void> {
  const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
  try {
    const html = await renderTemplate("password-reset", { fullName, resetLink });
    await sendEmail(email, "Reset Your Nexa AI Password", html);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
}

export async function sendAdminInviteEmail(
  email: string,
  fullName: string,
  businessUnit: string,
  rawToken: string
): Promise<void> {
  const acceptLink = `${FRONTEND_URL}/accept-invite?token=${rawToken}`;
  const subdomain = `${FRONTEND_URL}/login`;
  try {
    const html = await renderTemplate("admin-invite", { fullName, businessUnit, subdomain, acceptLink });
    await sendEmail(email, `You're invited to manage ${businessUnit} on Nexa AI`, html);
    console.log(`Admin invite sent to ${email}`);
  } catch (error) {
    console.error("Error sending invite email:", error);
    throw error;
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendContactFormInquiry(payload: {
  name: string;
  email: string;
  company?: string;
  message: string;
  intent?: string;
}): Promise<void> {
  const inbox = process.env.CONTACT_INBOX_EMAIL || NOTIFICATION_INBOX;
  const prefix = payload.intent === "demo" ? "[Demo request] " : "[Contact] ";
  const html = `
    <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
    ${payload.company ? `<p><strong>Company:</strong> ${escapeHtml(payload.company)}</p>` : ""}
    ${payload.intent ? `<p><strong>Intent:</strong> ${escapeHtml(payload.intent)}</p>` : ""}
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(payload.message)}</p>
  `;
  await sendEmail(inbox, `${prefix}${escapeHtml(payload.name)} — Nexa.ai`, html);
}

export async function sendEmployeeInviteEmail(
  email: string,
  fullName: string,
  businessUnitLabel: string,
  inviterLabel: string,
  rawToken: string,
  expiryDays: number
): Promise<void> {
  const acceptLink = `${FRONTEND_URL}/accept-employee-invite?token=${encodeURIComponent(rawToken)}`;
  try {
    const html = await renderTemplate("employee-invite", {
      fullName,
      businessUnitLabel,
      inviterLabel,
      acceptLink,
      expiryDays
    });
    await sendEmail(email, `You're invited to ${businessUnitLabel} on Nexa AI`, html);
    console.log(`Employee invite sent to ${email}`);
  } catch (error) {
    console.error("Error sending employee invite email:", error);
    throw error;
  }
}

export async function sendConversationMentionEmail(opts: {
  mentionedEmail: string;
  mentionedName: string;
  mentionerName: string;
  conversationTitle: string;
  chatUrl: string;
}): Promise<void> {
  try {
    const html = await renderTemplate("conversation-shared", {
      recipientName: opts.mentionedName,
      senderName: opts.mentionerName,
      conversationTitle: opts.conversationTitle,
      businessUnit: "",
      chatUrl: opts.chatUrl,
    });
    const subject = `${opts.mentionerName} mentioned you in a Nexa AI conversation`;
    // Override the template's generic copy with a mention-specific one inline
    const mentionHtml = html.replace(
      "shared a conversation with you on Nexa AI",
      "mentioned you in a conversation on Nexa AI. The conversation has been added to your <strong>Shared Conversations</strong> on Nexa AI."
    );
    await sendEmail(opts.mentionedEmail, subject, mentionHtml);
  } catch (error) {
    console.error(`[EmailService] Failed to send mention email to ${opts.mentionedEmail}:`, error);
  }
}

export async function sendConversationAccessRequestEmail(opts: {
  sharerEmail: string;
  sharerName: string;
  requesterName: string;
  requesterEmail: string;
  conversationTitle: string;
  businessUnit: string;
  acceptUrl: string;
  rejectUrl: string;
}): Promise<void> {
  try {
    const html = await renderTemplate("conv-access-request", opts);
    await sendEmail(
      opts.sharerEmail,
      `${opts.requesterName} is requesting access to continue a conversation on Nexa AI`,
      html
    );
  } catch (error) {
    console.error(`[EmailService] Failed to send access-request email to ${opts.sharerEmail}:`, error);
  }
}

export async function sendAccessRequestAcceptedEmail(opts: {
  requesterEmail: string;
  requesterName: string;
  sharerName: string;
  conversationTitle: string;
  chatUrl: string;
}): Promise<void> {
  try {
    const subject = `${opts.sharerName} accepted your request — conversation ready on Nexa AI`;
    const html = await renderTemplate("conversation-shared", {
      recipientName: opts.requesterName,
      senderName: opts.sharerName,
      conversationTitle: opts.conversationTitle,
      businessUnit: "",
      chatUrl: opts.chatUrl,
    });
    await sendEmail(opts.requesterEmail, subject, html);
  } catch (error) {
    console.error(`[EmailService] Failed to send accepted email to ${opts.requesterEmail}:`, error);
  }
}

export async function sendAccessRequestDeclinedEmail(opts: {
  requesterEmail: string;
  requesterName: string;
  sharerName: string;
  conversationTitle: string;
}): Promise<void> {
  try {
    const subject = `Update on your Nexa AI access request`;
    const bodyHtml = `<p>Hi ${opts.requesterName},</p><p>${opts.sharerName} has declined your request to continue the conversation <strong>"${opts.conversationTitle}"</strong> on Nexa AI.</p>`;
    await sendEmail(opts.requesterEmail, subject, `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:32px;color:#333">${bodyHtml}</body></html>`);
  } catch (error) {
    console.error(`[EmailService] Failed to send declined email to ${opts.requesterEmail}:`, error);
  }
}

// Fire-and-forget — errors are logged, never thrown, so callers don't need to await/catch.
export async function sendConversationSharedEmail(
  recipientEmail: string,
  recipientName: string,
  senderName: string,
  conversationTitle: string,
  businessUnit: string
): Promise<void> {
  try {
    const html = await renderTemplate("conversation-shared", {
      recipientName,
      senderName,
      conversationTitle,
      businessUnit,
      chatUrl: `${FRONTEND_URL}/user-chat`,
    });
    await sendEmail(recipientEmail, `${senderName} shared a conversation with you on Nexa AI`, html);
  } catch (error) {
    console.error(`[EmailService] Failed to send share notification to ${recipientEmail}:`, error);
  }
}

// Called in a fire-and-forget loop — never throws, errors are swallowed and logged.
export async function sendDocumentAddedNotification(
  email: string,
  fullName: string,
  businessUnit: string,
  documentTitle: string,
  documentType: string,
  sensitivityLevel: string,
  uploadedBy: string
): Promise<void> {
  try {
    const html = await renderTemplate("document-added", {
      fullName,
      businessUnit,
      documentTitle,
      documentType,
      sensitivityLevel,
      uploadedBy
    });
    await sendEmail(email, `[${businessUnit}] New document added to your Nexa AI knowledge base`, html);
  } catch (error) {
    console.error(`[EmailService] Failed to send document-added notification to ${email}:`, error);
  }
}

export async function sendWelcomeEmail(
  email: string,
  fullName: string,
  businessUnit: string,
  tenantInfo?: { label?: string; logo?: string; colorCode?: string; slug?: string },
  opts?: { initialPassword?: string; adminCreated?: boolean }
): Promise<void> {
  const chatUrl = `${FRONTEND_URL}/user-chat`;
  const brandColor = tenantInfo?.colorCode || '#ed0000';
  const buLabel = tenantInfo?.label || businessUnit;
  const logoUrl = tenantInfo?.logo
    ? (tenantInfo.logo.startsWith('http') ? tenantInfo.logo : `${BACKEND_URL}/logos/${tenantInfo.logo.replace(/^\/logos\//, '')}`)
    : undefined;
  try {
    const html = await renderTemplate("welcome", {
      fullName,
      chatUrl,
      businessUnit,
      buLabel,
      brandColor,
      logoUrl,
      initialPassword: opts?.initialPassword,
      adminCreated: opts?.adminCreated === true,
      year: new Date().getFullYear()
    });
    await sendEmail(email, `Welcome to ${buLabel} on Nexa AI — Your Account is Active!`, html);
    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw error;
  }
}

export async function sendAccessRequestNotification(payload: {
  companyName: string;
  workEmail: string;
  phone: string;
  employeeCount: number;
  submittedAt: string;
  reviewUrl: string;
}): Promise<void> {
  const inbox =
    NOTIFICATION_INBOX;
  try {
    const html = await renderTemplate("access-request-notification", payload);
    await sendEmail(inbox, `[Access Request] ${payload.companyName} — Nexa AI`, html);
  } catch (error) {
    console.error("[EmailService] Failed to send access-request notification:", error);
  }
}

export async function sendAccessRequestReceived(
  workEmail: string,
  companyName: string
): Promise<void> {
  try {
    const html = await renderTemplate("access-request-received", {
      companyName,
      workEmail,
      year: new Date().getFullYear()
    });
    await sendEmail(workEmail, "We've received your Nexa AI access request", html);
  } catch (error) {
    console.error("[EmailService] Failed to send access-request-received email:", error);
  }
}

export async function sendAccessRequestRejected(
  workEmail: string,
  companyName: string,
  note?: string
): Promise<void> {
  try {
    const html = await renderTemplate("access-request-rejected", {
      companyName,
      note: note || "",
      year: new Date().getFullYear()
    });
    await sendEmail(workEmail, "Update on your Nexa AI access request", html);
  } catch (error) {
    console.error("[EmailService] Failed to send access-request-rejected email:", error);
  }
}

export async function sendTenantCredentialsEmail(
  email: string,
  fullName: string,
  businessUnit: string,
  password: string
): Promise<void> {
  const loginUrl = `${FRONTEND_URL}/login`;
  const subdomain = loginUrl;
  try {
    const html = await renderTemplate("tenant-credentials", { 
      fullName, 
      businessUnit, 
      subdomain, 
      loginUrl, 
      email, 
      password 
    });
    await sendEmail(email, `Welcome to Nexa AI - Your ${businessUnit} Admin Account`, html);
    console.log(`Tenant credentials email sent to ${email}`);
  } catch (error) {
    console.error("Error sending tenant credentials email:", error);
    throw error;
  }
}
