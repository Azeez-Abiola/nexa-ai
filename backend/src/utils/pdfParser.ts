import pdfParse from "pdf-parse";

/**
 * Extract text content from a PDF file buffer
 * @param buffer The file buffer containing the PDF file
 * @returns Extracted text content
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    
    if (data.text) {
      // Clean up the extracted text: remove extra whitespace, normalize line breaks
      return (data.text as string)
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .join('\n');
    }
    
    return "";
  } catch (error) {
    console.error("Error parsing PDF file:", error);
    throw new Error("Failed to parse PDF document");
  }
}
