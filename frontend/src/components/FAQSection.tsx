import React, { useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import styles from "./FAQSection.module.css";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "What types of documents can I upload?",
    answer:
      "You can upload company documents including Policies, HSE (Health, Safety & Environment) guidelines, SOPs (Standard Operating Procedures), HR documents, Manuals, Training materials, and any other company knowledge base resources. Supported formats include .docx (Word), .pdf, and .txt files.",
  },
  {
    question: "What is the file size limit?",
    answer:
      "Each file can be up to 10 MB in size. If your document is larger, you can split it into multiple files and upload them separately.",
  },
  {
    question: "How does the AI use uploaded documents?",
    answer:
      "When you upload documents, the AI system reads and indexes the content to answer employee questions accurately. The AI learns from your documents to provide contextually relevant responses based on your organization's specific policies and guidelines. Documents are only used within your organization's instance and are never shared with third parties.",
  },
  {
    question: "Can users search for documents?",
    answer:
      "Yes! When users ask questions in the chatbot, the system automatically searches through your uploaded documents and returns the most relevant information. The AI can understand questions in natural language and matches them against your knowledge base.",
  },
  {
    question: "How do I know which documents have been uploaded?",
    answer:
      "All uploaded documents are listed in the 'Uploaded Documents' section with their title, category, and upload details. You can see who uploaded each document and when it was uploaded.",
  },
  {
    question: "Can I edit or delete documents?",
    answer:
      "Yes, you can edit any document by clicking the 'Edit' button. You can also delete documents using the 'Delete' button. Changes are applied immediately.",
  },
  {
    question: "What if the AI gives an incorrect answer?",
    answer:
      "The AI is designed to assist but may not always be 100% accurate. Always verify critical information with official company sources, HR, or Management. We recommend reviewing your documents for completeness and clarity to improve AI response quality.",
  },
  {
    question: "Are my documents secure?",
    answer:
      "Yes! All uploaded documents are encrypted and stored securely. They are only accessible to authorized team members in your organization. Your data is never used to train public AI models. Please see our Privacy Policy for more details.",
  },
];

interface FAQSectionProps {
  showTitle?: boolean;
}

export const FAQSection: React.FC<FAQSectionProps> = ({ showTitle = true }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className={styles.faqContainer}>
      {showTitle && (
        <div className={styles.header}>
          <h2 className={styles.title}>Frequently Asked Questions</h2>
          <p className={styles.subtitle}>
            Learn more about uploading documents and using the knowledge base
          </p>
        </div>
      )}

      <div className={styles.faqList}>
        {faqs.map((faq, index) => (
          <div
            key={index}
            className={`${styles.faqItem} ${expandedIndex === index ? styles.expanded : ""}`}
          >
            <button
              className={styles.faqQuestion}
              onClick={() => toggleFAQ(index)}
            >
              <span>{faq.question}</span>
              <FiChevronDown
                className={styles.chevron}
                size={20}
              />
            </button>
            {expandedIndex === index && (
              <div className={styles.faqAnswer}>
                <p>{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
