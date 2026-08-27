import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = "enc:";

function getKey(): Buffer {
  const hex = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("MESSAGE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptOnce(value: string): string {
  const key = getKey();
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return value;
  const [ivHex, tagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}

export function decrypt(value: string): string {
  if (typeof value !== "string") return value;
  // Peel every encryption layer. Legacy rows may be wrapped more than once
  // (a past sharing/sync bug re-encrypted already-encrypted content), so keep
  // unwrapping until we reach plaintext. Never throws — on any bad/foreign
  // layer we return the best result so far instead of leaking a 500.
  let current = value;
  for (let i = 0; i < 4 && current.startsWith(PREFIX); i++) {
    try {
      const next = decryptOnce(current);
      if (next === current) break; // malformed layer — can't unwrap further
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

export function decryptMessages(messages: Array<{ content: string; [key: string]: unknown }>): void {
  for (const m of messages) {
    if (typeof m.content === "string") m.content = decrypt(m.content);
  }
}

export function serializeMessages(messages: any[] | null | undefined): any[] {
  if (!messages) return [];
  return messages.map(m => {
    const plain: { content: string; [key: string]: unknown } =
      typeof m.toObject === "function" ? m.toObject() : { ...m };
    if (typeof plain.content === "string") plain.content = decrypt(plain.content);
    return plain;
  });
}

// ─── Connector credentials ────────────────────────────────────────────────────
//
// Third-party OAuth refresh tokens are encrypted with their own key, separate from
// the one protecting message content. The two have different blast radii: a leaked
// message key exposes conversation history, whereas a leaked connector key exposes
// live, writable access to employees' Microsoft accounts. Sharing one key would mean
// a single compromise did both, and would make rotating either one impossible
// without touching the other.

const CONNECTOR_KEY_ENV = "CONNECTOR_TOKEN_ENCRYPTION_KEY";

function getConnectorKey(): Buffer {
  const hex = process.env[CONNECTOR_KEY_ENV];
  if (!hex || hex.length !== 64) {
    // Deliberately fatal rather than falling back to the message key. A silent
    // fallback would "work" in every test and quietly collapse the two blast radii
    // into one in production — the sort of thing nobody discovers until after a
    // breach. Generate one with: openssl rand -hex 32
    throw new Error(
      `${CONNECTOR_KEY_ENV} must be a 64-character hex string (32 bytes). Generate one with: openssl rand -hex 32`
    );
  }
  return Buffer.from(hex, "hex");
}

/** Whether connector credentials can be stored at all in this deployment. */
export function connectorEncryptionAvailable(): boolean {
  return (process.env[CONNECTOR_KEY_ENV] || "").length === 64;
}

/** Encrypt a connector credential (OAuth refresh token) for storage at rest. */
export function encryptSecret(plaintext: string): string {
  const key = getConnectorKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted.toString("hex");
}

/**
 * Decrypt a stored connector credential.
 *
 * Throws on any failure, unlike decrypt() above. A message that will not decrypt is
 * better shown as ciphertext than as a 500; a refresh token that will not decrypt
 * must not be treated as an empty string and sent to Microsoft as a credential.
 */
export function decryptSecret(value: string): string {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) {
    throw new Error("Stored connector credential is not in the expected encrypted form");
  }
  const key = getConnectorKey();
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Stored connector credential is malformed");
  const [ivHex, tagHex, ciphertextHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(ciphertextHex, "hex")).toString("utf8") + decipher.final("utf8");
}
