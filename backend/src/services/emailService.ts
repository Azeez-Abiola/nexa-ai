import { Resend } from "resend";
import ejs from "ejs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://0.0.0.0:3000";
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@nexa.ai";

const TEMPLATES_DIR = path.join(__dirname, "..", "templates", "emails");

async function renderTemplate(name: string, data: Record<string, unknown>): Promise<string> {
  return ejs.renderFile(path.join(TEMPLATES_DIR, `${name}.ejs`), data, { async: false });
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const response = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
  if (response.error) {
    throw new Error(response.error.message);
  }
}

/**
 * Send email verification OTP
 */
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

/**
 * Send password reset link
 */
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

/**
 * Send admin invite email from SUPERADMIN
 */
export async function sendAdminInviteEmail(
  email: string,
  fullName: string,
  businessUnit: string,
  slug: string,
  rawToken: string
): Promise<void> {
  const acceptLink = `${FRONTEND_URL}/accept-invite?token=${rawToken}`;
  const subdomain = `${slug}.nexa.ai`;
  try {
    const html = await renderTemplate("admin-invite", { fullName, businessUnit, subdomain, acceptLink });
    await sendEmail(email, `You're invited to manage ${businessUnit} on Nexa AI`, html);
    console.log(`Admin invite sent to ${email}`);
  } catch (error) {
    console.error("Error sending invite email:", error);
    throw error;
  }
}

/** BU admin — signed link for employee self-serve signup (no forged business unit). */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Public marketing / contact form — delivered to CONTACT_INBOX_EMAIL or hi@nexa.com */
export async function sendContactFormInquiry(payload: {
  name: string;
  email: string;
  company?: string;
  message: string;
  intent?: string;
}): Promise<void> {
  const inbox = process.env.CONTACT_INBOX_EMAIL || "hi@nexa.com";
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

/**
 * Notify a single employee that a new document is available in their knowledge base.
 * Called in a fire-and-forget loop — never throws (errors are swallowed and logged).
 */
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

/**
 * Send welcome email after successful email verification
 */
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
    ? (tenantInfo.logo.startsWith('http') ? tenantInfo.logo : `${FRONTEND_URL}/logos/${tenantInfo.logo.replace(/^\/logos\//, '')}`)
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
/**
 * Notify super-admin of a new business access request
 */
export async function sendAccessRequestNotification(payload: {
  companyName: string;
  workEmail: string;
  phone: string;
  employeeCount: number;
  submittedAt: string;
  reviewUrl: string;
}): Promise<void> {
  const inbox =
    process.env.SUPERADMIN_NOTIFICATION_EMAIL ||
    process.env.CONTACT_INBOX_EMAIL ||
    "hi@nexa.ai";
  try {
    const html = await renderTemplate("access-request-notification", payload);
    await sendEmail(inbox, `[Access Request] ${payload.companyName} — Nexa AI`, html);
  } catch (error) {
    console.error("[EmailService] Failed to send access-request notification:", error);
  }
}

/**
 * Confirm to the requester that their access request was received
 */
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

/**
 * Notify the requester that their access request was rejected
 */
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

/**
 * Send welcome email with auto-generated credentials to new BU admin
 */
export async function sendTenantCredentialsEmail(
  email: string,
  fullName: string,
  businessUnit: string,
  slug: string,
  password: string
): Promise<void> {
  const loginUrl = `${FRONTEND_URL}/login`;
  const subdomain = `${slug}.nexa.ai`;
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
