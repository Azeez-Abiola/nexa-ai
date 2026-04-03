"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = sendVerificationEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.sendAdminInviteEmail = sendAdminInviteEmail;
exports.sendWelcomeEmail = sendWelcomeEmail;
const resend_1 = require("resend");
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://0.0.0.0:3000";
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@nexa.ai";
const TEMPLATES_DIR = path_1.default.join(__dirname, "..", "templates", "emails");
async function renderTemplate(name, data) {
    return ejs_1.default.renderFile(path_1.default.join(TEMPLATES_DIR, `${name}.ejs`), data, { async: false });
}
async function sendEmail(to, subject, html) {
    const response = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    if (response.error) {
        throw new Error(response.error.message);
    }
}
/**
 * Send email verification OTP
 */
async function sendVerificationEmail(email, otp, fullName, businessUnit) {
    try {
        const html = await renderTemplate("verification", { fullName, otp, businessUnit });
        await sendEmail(email, `Your [${businessUnit}] GPT Email Verification Code`, html);
        console.log(`Verification OTP sent to ${email}`);
    }
    catch (error) {
        console.error("Error sending verification email:", error);
        throw error;
    }
}
/**
 * Send password reset link
 */
async function sendPasswordResetEmail(email, resetToken, fullName) {
    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    try {
        const html = await renderTemplate("password-reset", { fullName, resetLink });
        await sendEmail(email, "Reset Your Nexa AI Password", html);
        console.log(`Password reset email sent to ${email}`);
    }
    catch (error) {
        console.error("Error sending password reset email:", error);
        throw error;
    }
}
/**
 * Send admin invite email from SUPERADMIN
 */
async function sendAdminInviteEmail(email, fullName, businessUnit, slug, rawToken) {
    const acceptLink = `${FRONTEND_URL}/accept-invite?token=${rawToken}`;
    const subdomain = `${slug}.nexa.ai`;
    try {
        const html = await renderTemplate("admin-invite", { fullName, businessUnit, subdomain, acceptLink });
        await sendEmail(email, `You're invited to manage ${businessUnit} on Nexa AI`, html);
        console.log(`Admin invite sent to ${email}`);
    }
    catch (error) {
        console.error("Error sending invite email:", error);
        throw error;
    }
}
/**
 * Send welcome email after successful email verification
 */
async function sendWelcomeEmail(email, fullName) {
    const dashboardUrl = `${FRONTEND_URL}/dashboard`;
    try {
        const html = await renderTemplate("welcome", { fullName, dashboardUrl });
        await sendEmail(email, "Welcome to Nexa AI - Your Account is Active!", html);
        console.log(`Welcome email sent to ${email}`);
    }
    catch (error) {
        console.error("Error sending welcome email:", error);
        throw error;
    }
}
