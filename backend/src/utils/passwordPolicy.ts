const COMMON_PASSWORDS = new Set([
  "123456", "123456789", "12345678", "12345", "1234567", "1234567890", "qwerty",
  "password", "password1", "password123", "passw0rd", "letmein", "welcome",
  "welcome1", "admin", "admin123", "administrator", "iloveyou", "monkey",
  "dragon", "football", "baseball", "master", "superman", "trustno1",
  "sunshine", "princess", "flower", "hottie", "loveme", "starwars",
  "whatever", "shadow", "michael", "jennifer", "jordan23", "hunter2",
  "letmein1", "abc123", "abcd1234", "a1b2c3", "1q2w3e4r", "1qaz2wsx",
  "qwertyuiop", "qwerty123", "asdfghjkl", "zxcvbnm", "000000", "111111",
  "123123", "121212", "654321", "1111111", "11111111", "target123",
  "changeme", "changeme123", "letmeinnow", "passw0rd1", "p@ssw0rd",
  "p@ssword", "password!", "password@123", "welcome123", "nexa123",
  "nexa1234", "companyname", "temppass", "temppass123", "temp1234",
  "guest", "guest123", "test1234", "test123", "demo1234", "demo123",
  "iloveyou1", "charlie", "michelle", "andrew", "daniel", "matthew",
  "computer", "internet", "service", "google", "facebook", "amazon",
]);

export const MIN_PASSWORD_LENGTH = 15;

/**
 * Returns a user-facing error message if the password fails policy, or null if it passes.
 * Requires: min length, at least 3 of 4 character classes, and not a known breached/common password
 * (checked against the raw value and against the value with trailing digits/symbols stripped, to
 * catch trivial variants like "password123" or "Password!").
 */
export function validatePasswordStrength(password: string): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
  }

  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;

  if (classes < 3) {
    return "Password must include at least 3 of: lowercase letters, uppercase letters, numbers, symbols";
  }

  const lower = password.toLowerCase();
  const stripped = lower.replace(/[^a-z]+$/g, "").replace(/[\d\W_]+$/g, "");
  if (COMMON_PASSWORDS.has(lower) || (stripped.length >= 4 && COMMON_PASSWORDS.has(stripped))) {
    return "This password is too common. Please choose a less predictable password";
  }

  return null;
}
