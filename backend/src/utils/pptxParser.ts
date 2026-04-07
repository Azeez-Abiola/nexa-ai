// officeparser does not ship its own type declarations
// eslint-disable-next-line @typescript-eslint/no-var-requires
const officeParser = require("officeparser");

/**
 * Extract text content from a PowerPoint presentation (.pptx) buffer.
 * Returns all slide text as a single string, slide breaks preserved.
 */
export async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    officeParser.parseOfficeAsync(buffer, { outputErrorToConsole: false })
      .then((text: string) => {
        if (!text || text.trim().length === 0) {
          reject(new Error("No readable text found in PowerPoint file"));
        } else {
          resolve(text.trim());
        }
      })
      .catch((err: Error) => reject(err));
  });
}
