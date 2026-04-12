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

import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Sparkles } from "lucide-react";
import styles from "./FAQSection.module.css";

// ... faqs array ...

export const FAQSection: React.FC<FAQSectionProps> = ({ showTitle = true }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <section className="py-24 md:py-32 px-6 bg-white overflow-hidden">
      <div className="container mx-auto max-w-6xl">
        {showTitle && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }} 
            className="text-center mb-20"
          >
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[#1A1A1A] mb-6 font-sans">
              Everything You Want <br /> To Know About <span className="gradient-text italic">Nexa</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
              Find clear answers to everything about setup, privacy, and features.
            </p>
          </motion.div>
        )}

        <div className="flex flex-col lg:flex-row gap-16 items-start">
          {/* Left Side: Visual Element (Inspired by the screenshot) */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 relative w-full"
          >
            <div className="relative rounded-[2.5rem] bg-[#F8F9FF] border border-border/40 p-8 md:p-12 overflow-hidden aspect-square flex items-center justify-center">
              {/* Floating Chat Bubbles Mockup */}
              <div className="space-y-4 w-full max-w-sm">
                {[
                  "Can Nexa help me brainstorm business ideas?",
                  "Is my data safe with Nexa?",
                  "What makes Nexa different from other chatbots?"
                ].map((text, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.2, duration: 0.8, repeat: Infinity, repeatType: "reverse", repeatDelay: 2 }}
                    className={`p-4 rounded-2xl text-sm font-medium shadow-sm border border-border/20 ${i % 2 === 0 ? 'bg-white ml-auto rounded-tr-none' : 'bg-primary text-white mr-auto rounded-tl-none'}`}
                  >
                    {text}
                  </motion.div>
                ))}
              </div>
              
              {/* Decorative Orb */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10" />
            </div>
          </motion.div>

          {/* Right Side: FAQ Accordion */}
          <div className="flex-1 w-full space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-2xl border transition-all duration-300 ${expandedIndex === index ? 'bg-white border-primary/20 shadow-xl shadow-primary/5' : 'bg-[#F8F9FF] border-border/40 hover:border-primary/20'}`}
              >
                <button
                  className="w-full px-6 py-5 flex items-center justify-between text-left group"
                  onClick={() => toggleFAQ(index)}
                >
                  <span className={`font-bold text-base transition-colors ${expandedIndex === index ? 'text-primary' : 'text-[#1A1A1A]'}`}>
                    {faq.question}
                  </span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${expandedIndex === index ? 'bg-primary text-white rotate-0' : 'bg-white text-muted-foreground rotate-90'}`}>
                    {expandedIndex === index ? <Minus size={16} /> : <Plus size={16} />}
                  </div>
                </button>
                <AnimatePresence>
                  {expandedIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 text-muted-foreground text-[15px] leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
