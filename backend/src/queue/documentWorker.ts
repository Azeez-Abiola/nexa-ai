import { Worker, Job } from "bullmq";
import { redisConnection } from "./connection";
import { DocumentJobData } from "./documentQueue";
import { processDocument } from "../services/documentProcessingService";
import { RagDocument } from "../models/RagDocument";
import logger from "../utils/logger";

function startWorker() {
  const worker = new Worker<DocumentJobData>(
    "document-processing",
    async (job: Job<DocumentJobData>) => {
      logger.info("[Worker] Processing job", { jobId: job.id, documentId: job.data.documentId });

      await processDocument({
        documentId: job.data.documentId,
        cloudinaryPublicId: job.data.cloudinaryPublicId,
        cloudinaryUrl: job.data.cloudinaryUrl,
        mimeType: job.data.mimeType,
        businessUnit: job.data.businessUnit,
        allowedGrades: job.data.allowedGrades,
        allowedGroupIds: job.data.allowedGroupIds || [],
        sensitivityLevel: job.data.sensitivityLevel,
        uploadedBy: job.data.uploadedBy
      });
    },
    {
      connection: redisConnection,
      concurrency: 2,
      limiter: { max: 5, duration: 60000 }
    }
  );

  worker.on("completed", (job) => {
    logger.info("[Worker] Job completed", { jobId: job.id, documentId: job.data.documentId });
  });

  worker.on("failed", async (job, error) => {
    logger.error("[Worker] Job failed", {
      jobId: job?.id,
      documentId: job?.data?.documentId,
      error: error.message,
      attempts: job?.attemptsMade
    });

    // After all retries exhausted, ensure processingStatus reflects failure
    if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await RagDocument.findByIdAndUpdate(job.data.documentId, {
        processingStatus: "failed",
        processingError: error.message
      }).catch(() => {});
    }
  });

  worker.on("error", (err) => {
    logger.error("[Worker] Worker error", { error: err.message });
  });

  logger.info("[Worker] Document processing worker started");
  return worker;
}

export { startWorker };
