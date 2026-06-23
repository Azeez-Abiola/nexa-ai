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

export function decryptMessages(messages: Array<{ content: string; [key: string]: unknown }>): void {
  for (const m of messages) {
    if (typeof m.content === "string") m.content = decrypt(m.content);
  }
}

export function decrypt(value: string): string {
  // Graceful fallback: return plaintext values (pre-encryption legacy messages)
  if (!value.startsWith(PREFIX)) return value;
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
