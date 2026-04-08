import { Worker, Job } from "bullmq";
import { redisConnection } from "./connection";
import { UserDocumentJobData } from "./userDocumentQueue";
import { processUserDocument } from "../services/userDocumentProcessingService";
import { UserDocument } from "../models/UserDocument";
import logger from "../utils/logger";

function startUserDocumentWorker() {
  const worker = new Worker<UserDocumentJobData>(
    "user-document-processing",
    async (job: Job<UserDocumentJobData>) => {
      logger.info("[UserDocWorker] Processing job", {
        jobId: job.id,
        documentId: job.data.documentId,
        userId: job.data.userId,
        chatSessionId: job.data.chatSessionId
      });

      await processUserDocument({
        documentId: job.data.documentId,
        cloudinaryPublicId: job.data.cloudinaryPublicId,
        cloudinaryUrl: job.data.cloudinaryUrl,
        mimeType: job.data.mimeType,
        userId: job.data.userId,
        chatSessionId: job.data.chatSessionId,
        fileName: job.data.fileName
      });
    },
    {
      connection: redisConnection,
      concurrency: 3,
      limiter: { max: 10, duration: 60000 }
    }
  );

  worker.on("completed", (job) => {
    logger.info("[UserDocWorker] Job completed", {
      jobId: job.id,
      documentId: job.data.documentId,
      fileName: job.data.fileName
    });
  });

  worker.on("failed", async (job, error) => {
    logger.error("[UserDocWorker] Job failed", {
      jobId: job?.id,
      documentId: job?.data?.documentId,
      fileName: job?.data?.fileName,
      error: error.message,
      attempts: job?.attemptsMade
    });

    // After all retries exhausted, mark document as failed
    if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await UserDocument.findByIdAndUpdate(job.data.documentId, {
        status: "failed",
        processingError: error.message
      }).catch(() => {});
    }
  });

  worker.on("error", (err) => {
    logger.error("[UserDocWorker] Worker error", { error: err.message });
  });

  logger.info("[UserDocWorker] User document processing worker started");
  return worker;
}

export { startUserDocumentWorker };
