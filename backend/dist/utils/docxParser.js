"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextFromDocx = extractTextFromDocx;
const mammoth_1 = __importDefault(require("mammoth"));
/**
 * Extract text content from a Word document (.docx) buffer
 * @param buffer The file buffer containing the .docx file
 * @returns Extracted text content
 */
async function extractTextFromDocx(buffer) {
    try {
        const result = await mammoth_1.default.extractRawText({ buffer });
        if (result.value) {
            // Clean up the extracted text: remove extra whitespace, normalize line breaks
            return result.value
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('\n');
        }
        return "";
    }
    catch (error) {
        console.error("Error parsing DOCX file:", error);
        throw new Error("Failed to parse Word document");
    }
}
