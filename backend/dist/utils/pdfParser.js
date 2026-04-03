"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextFromPdf = extractTextFromPdf;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
/**
 * Extract text content from a PDF file buffer
 * @param buffer The file buffer containing the PDF file
 * @returns Extracted text content
 */
async function extractTextFromPdf(buffer) {
    try {
        const data = await (0, pdf_parse_1.default)(buffer);
        if (data.text) {
            // Clean up the extracted text: remove extra whitespace, normalize line breaks
            return data.text
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
                .join('\n');
        }
        return "";
    }
    catch (error) {
        console.error("Error parsing PDF file:", error);
        throw new Error("Failed to parse PDF document");
    }
}
