import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import path from "path";
import logger from "../utils/logger";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const BASE_FOLDER = process.env.CLOUDINARY_FOLDER || "nexa-documents";

export function buildPublicId(businessUnit: string, filename: string): string {
  const uuid = randomUUID();
  const sanitized = path
    .basename(filename, path.extname(filename))
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 60);
  // Cloudinary rejects public_ids containing whitespace (leading, trailing, or embedded).
  // Sanitize BU the same way as filename so legacy "1879 Tech hub " → "1879_Tech_hub".
  const sanitizedBu = businessUnit.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "default";
  return `${BASE_FOLDER}/${sanitizedBu}/${uuid}-${sanitized}`;
}

export async function uploadDocument(
  buffer: Buffer,
  filename: string,
  businessUnit: string,
  mimeType: string
): Promise<{ publicId: string; secureUrl: string }> {
  const publicId = buildPublicId(businessUnit, filename);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "raw",
        folder: undefined, // folder is embedded in publicId
        overwrite: false
      },
      (error, result) => {
        if (error || !result) {
          logger.error("[Cloudinary] Upload failed", { error, filename, businessUnit });
          return reject(error || new Error("Upload returned no result"));
        }
        logger.info("[Cloudinary] Upload successful", { publicId: result.public_id, filename });
        resolve({ publicId: result.public_id, secureUrl: result.secure_url });
      }
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

export async function getDocumentBuffer(cloudinaryUrl: string): Promise<Buffer> {
  const response = await fetch(cloudinaryUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch document from Cloudinary: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteDocument(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  logger.info("[Cloudinary] Deleted document", { publicId });
}
