/**
 * TEMPORARY ESCAPE HATCH for two-factor sign-in.
 *
 * Set AUTH_OTP_BYPASS_CODE to a fixed code and sign-in stops emailing anything: that
 * code is accepted instead, for both administrators and employees. It exists because a
 * failure at the email provider currently locks everyone out of the platform with no way
 * back in, which is exactly how it was first needed.
 *
 * This reduces sign-in to a single factor, so anyone holding a password is through.
 * Unset the variable as soon as you are done. Nothing else has to change and the normal
 * emailed-code flow resumes on the very next request.
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
