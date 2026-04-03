import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, PageBreak, UnderlineType, HeadingLevel, AlignmentType } from "docx";
import jsPDF from "jspdf";

interface Message {
  id: string;
  role: "user" | "assistant";
  message: string;
  createdAt: Date | string;
}

/**
 * Converts a message date to a readable format
 */
const formatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString();
};

/**
 * Exports conversation messages to a DOCX file
 */
export const exportConversationToDocx = async (
  messages: Message[],
  filename: string = "chat-export.docx"
): Promise<void> => {
  if (messages.length === 0) {
    alert("No messages to export");
    return;
  }

  const paragraphs: Paragraph[] = [];

  // Add title
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Nexa AI Chat Export",
          bold: true,
          size: 28 * 2, // size is in half-points
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  // Add metadata
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Exported on: ${formatDate(new Date())}`,
          size: 11 * 2,
          color: "666666",
        }),
      ],
      spacing: { after: 100 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Total Messages: ${messages.length}`,
          size: 11 * 2,
          color: "666666",
        }),
      ],
      spacing: { after: 300 },
    })
  );

  // Add separator
  paragraphs.push(
    new Paragraph({
      text: "_".repeat(80),
      spacing: { after: 300 },
    })
  );

  // Add messages
  messages.forEach((message, index) => {
    const displayDate = formatDate(message.createdAt);
    const isUserMessage = message.role === "user";
    const sender = isUserMessage ? "You" : "Nexa AI";

    // Message header
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${sender} (${displayDate})`,
            bold: true,
            size: 12 * 2,
            color: isUserMessage ? "0066cc" : "cc0000",
          }),
        ],
        spacing: { before: 200, after: 100 },
        border: {
          bottom: {
            color: isUserMessage ? "ccdefb" : "ffcccc",
            space: 1,
            style: "single",
            size: 6,
          },
        },
      })
    );

    // Message content
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: message.message,
            size: 11 * 2,
          }),
        ],
        spacing: { after: 100, line: 240 },
      })
    );

    // Add separator between messages (except last)
    if (index < messages.length - 1) {
      paragraphs.push(
        new Paragraph({
          text: "",
          spacing: { after: 100 },
        })
      );
    }
  });

  // Add footer
  paragraphs.push(
    new Paragraph({
      text: "",
      spacing: { before: 400 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "© Nexa AI. All rights reserved.",
          size: 9 * 2,
          color: "999999",
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  try {
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting to DOCX:", error);
    alert("Failed to export conversation to DOCX");
  }
};

/**
 * Exports conversation messages to a PDF file
 */
export const exportConversationToPdf = async (
  messages: Message[],
  filename: string = "chat-export.pdf"
): Promise<void> => {
  if (messages.length === 0) {
    alert("No messages to export");
    return;
  }

  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margins = 15;
    const contentWidth = pageWidth - 2 * margins;
    let currentY = margins;

    // Add title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Nexa AI Chat Export", margins, currentY);
    currentY += 15;

    // Add metadata
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Exported on: ${formatDate(new Date())}`, margins, currentY);
    currentY += 7;
    doc.text(`Total Messages: ${messages.length}`, margins, currentY);
    currentY += 12;

    // Add separator
    doc.setDrawColor(200, 200, 200);
    doc.line(margins, currentY, pageWidth - margins, currentY);
    currentY += 10;

    // Add messages
    doc.setFontSize(11);

    messages.forEach((message, index) => {
      const displayDate = formatDate(message.createdAt);
      const isUserMessage = message.role === "user";
      const sender = isUserMessage ? "You" : "Nexa AI";

      // Check if we need a new page
      if (currentY > pageHeight - margins - 20) {
        doc.addPage();
        currentY = margins;
      }

      // Message header
      doc.setFont("helvetica", "bold");
      doc.setTextColor(isUserMessage ? 0 : 204, isUserMessage ? 102 : 0, isUserMessage ? 204 : 0);
      const headerText = `${sender} (${displayDate})`;
      doc.text(headerText, margins, currentY);
      currentY += 7;

      // Message content
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      const splitText = doc.splitTextToSize(message.message, contentWidth);
      splitText.forEach((line: string) => {
        if (currentY > pageHeight - margins - 10) {
          doc.addPage();
          currentY = margins;
        }
        doc.text(line, margins + 5, currentY);
        currentY += 6;
      });

      currentY += 5;
    });

    // Add footer
    currentY = pageHeight - 15;
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "italic");
    doc.text("© Nexa AI. All rights reserved.", pageWidth / 2, currentY, {
      align: "center",
    });

    // Save the PDF
    doc.save(filename);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    alert("Failed to export conversation to PDF");
  }
};

/**
 * Generates a filename with current timestamp
 */
export const generateExportFilename = (format: "docx" | "pdf"): string => {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const time = new Date().toTimeString().slice(0, 5).replace(/:/g, "");
  return `chat-export-${timestamp}-${time}.${format}`;
};
