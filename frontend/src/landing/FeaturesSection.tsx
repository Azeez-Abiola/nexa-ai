import { useState } from "react";
import { motion } from "framer-motion";
import { Search, TrendingUp, ShieldCheck, ClipboardCheck, BookOpen, ArrowRight, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Feature = {
  icon: LucideIcon;
  title: string;
  desc: string;
  highlight: boolean;
  detailTitle: string;
  detailParagraphs: string[];
};

const features: Feature[] = [
  {
    icon: Search,
    title: "Smart Document Search & Retrieval",
    desc: "Find exactly what you need across thousands of documents. Nexa understands meaning, not just keywords.",
    highlight: false,
    detailTitle: "Smart document search & retrieval",
    detailParagraphs: [
      "Nexa indexes your approved PDFs, policies, SOPs, and reports so employees can ask questions in plain language and get answers with traceability back to the source document.",
      "Semantic search goes beyond keyword matching to surface the right clause, table, or paragraph even when users do not know the exact file name or location.",
      "Administrators can refresh the knowledge base as documents change, so responses stay aligned with the latest approved materials.",
    ],
  },
  {
    icon: TrendingUp,
    title: "AI-Powered Analysis",
    desc: "Analyze financial reports, spot trends, compare data across periods — all through natural conversation.",
    highlight: false,
    detailTitle: "AI-powered analysis",
    detailParagraphs: [
      "Finance and strategy teams can compare periods, highlight variances, and explore management commentary through guided conversation — always grounded in documents they are allowed to see.",
      "Use Nexa to prep for reviews: ask for summaries of key risks, revenue drivers, or cost lines that moved, then drill into the underlying filings or internal packs.",
      "Outputs are assistive: critical numbers and decisions should still be validated in your official systems of record.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access & Security",
    desc: "Granular permissions ensure every user only sees what they're authorized to access.",
    highlight: true,
    detailTitle: "Role-based access & security",
    detailParagraphs: [
      "Access is tied to your organization structure: business unit, grade or role, and knowledge groups so that sensitive material never appears in the wrong context.",
      "Every query runs with the same entitlement rules as your knowledge base, reducing the risk of over-sharing compared to ad-hoc document sharing.",
      "Designed for enterprise environments where IT and compliance teams need predictable, auditable behavior.",
    ],
  },
  {
    icon: ClipboardCheck,
    title: "Compliance & Audit Readiness",
    desc: "Instant access to policies and procedures. Full audit trails of every query and response.",
    highlight: false,
    detailTitle: "Compliance & audit readiness",
    detailParagraphs: [
      "Employees can pull the current version of HR, legal, or safety policies without hunting through shared drives.",
      "Administrators benefit from visibility into how the assistant is used, supporting internal audit and governance workflows.",
      "Retention and handling of conversations follow your deployment model and organizational policies.",
    ],
  },
  {
    icon: BookOpen,
    title: "Continuous Learning Knowledge Base",
    desc: "As new documents are approved, Nexa learns and evolves — always current, always accurate.",
    highlight: false,
    detailTitle: "Continuous learning knowledge base",
    detailParagraphs: [
      "When teams upload new versions or categories of documents, Nexa’s retrieval layer is updated so answers reflect what is approved for use.",
      "Knowledge groups let you segment content by function — for example finance vs. plant operations — without duplicating infrastructure.",
      "The result is a single assistant experience that stays relevant as your organization’s information estate grows.",
    ],
  },
  {
    icon: BarChart3,
    title: "Insights & Adoption Analytics",
    desc: "See what your team is asking, which documents drive answers, and where knowledge gaps are forming.",
    highlight: false,
    detailTitle: "Insights & adoption analytics",
    detailParagraphs: [
      "Administrators get a clear view of usage trends — top questions, most-cited documents, and active users by department — so adoption is measurable, not assumed.",
      "Surface knowledge gaps quickly: when employees repeatedly ask questions Nexa cannot confidently answer, you know exactly which content to publish or update next.",
      "Tie usage back to ROI by understanding which teams benefit most and where to invest in expanding the knowledge base.",
    ],
  },
];

const FeaturesSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const active = openIndex !== null ? features[openIndex] : null;

  return (
    <section id="features" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-white">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-20"
        >
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight text-[#1A1A1A] mb-4 sm:mb-6 font-sans px-1">
            Everything Your Team <span className="gradient-text">Needs to Know</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-10">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`group relative p-6 sm:p-8 md:p-10 rounded-2xl sm:rounded-[2.5rem] md:rounded-[3rem] bg-white border shadow-[0_10px_40px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(0,0,0,0.12)] transition-all duration-700 hover:border-primary/30 ${
                f.highlight ? "border-primary/40 ring-2 ring-primary/20" : "border-border/40"
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl sm:rounded-[2.5rem] md:rounded-[3rem]" />

              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-[#F8F9FF] shadow-sm flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-500">
                  <f.icon size={28} className="group-hover:text-white transition-colors text-primary" />
                </div>
                <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-[#1A1A1A] font-sans group-hover:text-primary transition-colors">
                  {f.title}
                </h3>
                <p className="text-[16px] text-muted-foreground leading-relaxed font-medium">{f.desc}</p>

                <button
                  type="button"
                  className="mt-8 flex items-center gap-2 text-primary font-bold text-sm cursor-pointer bg-transparent border-0 p-0 font-sans transition-transform duration-300 hover:gap-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenIndex(i);
                  }}
                >
                  Learn more <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[min(88vh,40rem)] overflow-y-auto rounded-2xl p-4 sm:p-6">
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-extrabold text-left pr-8">{active.detailTitle}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-[15px] text-muted-foreground leading-relaxed pt-2">
                {active.detailParagraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default FeaturesSection;
