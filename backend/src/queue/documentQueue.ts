import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export interface DocumentJobData {
  documentId: string;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  mimeType: string;
  businessUnit: string;
  /** Serialized Mongo ObjectIds for knowledge groups (may be empty) */
  allowedGroupIds: string[];
  sensitivityLevel: string;
  uploadedBy: {
    adminId: string;
    adminEmail: string;
    adminName: string;
  };
}

export const documentQueue = new Queue<DocumentJobData>("document-processing", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 }
  }
});
