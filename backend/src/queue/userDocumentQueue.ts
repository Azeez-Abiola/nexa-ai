import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export interface UserDocumentJobData {
  documentId: string;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  mimeType: string;
  userId: string;
  chatSessionId: string;
  fileName: string;
}

export const userDocumentQueue = new Queue<UserDocumentJobData>("user-document-processing", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 }
  }
});
