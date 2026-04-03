import mammoth from "mammoth";

/**
 * Extract text content from a Word document (.docx) buffer
 * @param buffer The file buffer containing the .docx file
 * @returns Extracted text content
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    
    if (result.value) {
      // Clean up the extracted text: remove extra whitespace, normalize line breaks
      return result.value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
    }
    
    return "";
  } catch (error) {
    console.error("Error parsing DOCX file:", error);
    throw new Error("Failed to parse Word document");
  }
}
