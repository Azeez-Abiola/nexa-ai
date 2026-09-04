/**
 * Escape hatch for two-factor sign-in.
 *
 * Set AUTH_OTP_BYPASS_CODE to a fixed code and sign-in stops emailing anything: that
 * code is accepted instead, for administrators and employees alike. It exists because a
 * failure at the email provider locks everyone out of the platform with no way back in,
 * which is exactly what happened when Resend's daily quota ran out.
 *
 * Unset — which is how it ships — this file changes nothing at all. Setting it reduces
 * sign-in to a single factor, so anyone holding a password is through, and it warns
 * loudly at startup for that reason. It belongs in local development. Setting it in
 * production turns off two-factor authentication for the whole organisation.
 *
 * Lives in its own module so both auth.ts and adminAuth.ts can read it without importing
 * each other, which would be circular.
 */
export const OTP_BYPASS_CODE = process.env.AUTH_OTP_BYPASS_CODE || "";

if (OTP_BYPASS_CODE) {
  console.warn(
    "[auth] SECURITY: AUTH_OTP_BYPASS_CODE is set — two-factor sign-in is DISABLED for " +
      "admins and employees. Unset it to restore emailed codes."
  );
}
