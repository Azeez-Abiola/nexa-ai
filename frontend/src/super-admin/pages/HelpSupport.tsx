import React, { useState } from 'react';
import {
  HelpCircle,
  Search,
  MessageCircle,
  Mail,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  ShieldCheck,
  Zap,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
  icon: any;
}

const faqs: FAQItem[] = [
  {
    category: "Getting Started",
    icon: Zap,
    question: "What types of documents can I upload?",
    answer: "You can upload company documents including Policies, HSE guidelines, SOPs, HR documents, and Training materials. Supported formats include .docx, .pdf, and .txt files.",
  },
  {
    category: "Model Training",
    icon: BookOpen,
    question: "How does the AI use uploaded documents?",
    answer: "The AI indexes your content to provide organization-specific responses. This context allows the model to answer staff questions based strictly on your official policies and internal manuals.",
  },
  {
    category: "System Limits",
    icon: ShieldCheck,
    question: "What is the file size limit?",
    answer: "Standard infrastructure capacity supports files up to 10MB each. For larger manuals, we recommend segmenting the content into multiple logical units for better indexing efficiency.",
  },
  {
    category: "Privacy & Governance",
    icon: Globe,
    question: "Are my documents secure?",
    answer: "Yes. All data is isolated within your Business Unit container. We use enterprise-grade encryption and your data is never used to train public models or shared with other tenants.",
  },
  {
    category: "Engagement",
    icon: MessageCircle,
    question: "Can users search for documents?",
    answer: "The chatbot performs natural language semantic searches across your repository. Users don't need to 'search'—they simply ask questions, and the AI retrieves the relevant context instantly.",
  },
  {
    category: "Maintenance",
    icon: FileText,
    question: "Can I edit or delete documents?",
    answer: "Administrators have full CRUD lifecycle control. You can update or remove materials at any time from the Knowledge Base, and the AI's internal memory will sync immediately.",
  }
];

const HelpSupport: React.FC = () => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-w-0 max-w-full space-y-12 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-['Sen'] flex items-center gap-3">
            <HelpCircle className="text-[var(--brand-color)]" size={32} />
            Help & Support Center
          </h1>
          <p className="text-slate-500 font-medium">Resources and intelligence to help you manage your Nexa AI Hub.</p>
        </div>

        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[var(--brand-color)] transition-all" size={18} />
          <Input
            placeholder="Search for answers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 pl-12 rounded-2xl border-slate-100 bg-white shadow-sm focus:ring-2 focus:ring-[var(--brand-color)]/10 transition-all font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-2xl bg-white p-8 group hover:-translate-y-1 transition-transform">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-color)]/10 flex items-center justify-center text-[var(--brand-color)] mb-6">
            <MessageCircle size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Live Chat Support</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">Connect with our dedicated support engineering team for complex inquiries.</p>
          <Button className="w-full h-11 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all">Start Chat</Button>
        </Card>

        <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-2xl bg-[var(--brand-color)] p-8 text-white relative overflow-hidden group">
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white mb-6">
              <Sparkles size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2 tracking-tight">AI Training Tips</h3>
            <p className="text-white/80 text-sm leading-relaxed mb-6">Learn how to optimize your documents to get 99% accuracy from your AI unit.</p>
            <Button className="w-full h-11 rounded-xl bg-white text-[var(--brand-color)] font-bold hover:bg-white/90 transition-all border-none">View Whitepaper</Button>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
        </Card>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-10">
        <div className="text-center mb-12">
          <Badge className="bg-slate-50 text-slate-400 border-none font-black text-[10px] tracking-widest uppercase mb-4 px-4 py-1.5 rounded-full">Frequently Asked Questions</Badge>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-['Sen']">Common governance queries</h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {filteredFaqs.map((faq, index) => (
            <div
              key={index}
              className={cn(
                "rounded-2xl border transition-all duration-300",
                expandedIndex === index
                  ? "bg-slate-50/50 border-[var(--brand-color)]/10 shadow-sm"
                  : "border-slate-100 hover:border-[var(--brand-color)]/20"
              )}
            >
              <button
                className="w-full px-6 py-6 flex items-center justify-between text-left group"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    expandedIndex === index ? "bg-[var(--brand-color)] text-white" : "bg-white text-slate-400 group-hover:bg-slate-100"
                  )}>
                    <faq.icon size={20} />
                  </div>
                  <span className={cn(
                    "font-bold text-lg transition-colors",
                    expandedIndex === index ? "text-slate-900" : "text-slate-600 group-hover:text-slate-900"
                  )}>
                    {faq.question}
                  </span>
                </div>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  expandedIndex === index ? "bg-white text-[var(--brand-color)] rotate-180" : "bg-slate-50 text-slate-400"
                )}>
                  <ChevronDown size={18} />
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
                    <div className="px-6 pb-8 pt-2 pl-20 text-slate-500 font-medium text-base leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center text-center p-12 bg-slate-900 rounded-[2.5rem] text-white relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Couldn't find what you need?</h2>
          <p className="text-slate-400 max-w-lg mx-auto mb-8 font-medium">Our architecture is designed for ease of use, but if you're stuck, our solution architects are ready to help.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="h-14 px-10 rounded-2xl bg-[var(--brand-color)] text-white font-bold hover:bg-slate-800 hover:shadow-xl hover:opacity-100 transition-all border-none">Global Documentation</Button>
          </div>
        </div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
      </div>
    </div>
  );
};

export default HelpSupport;
