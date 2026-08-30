import { useState } from "react";
import { motion } from "framer-motion";
import { Search, TrendingUp, ShieldCheck, ClipboardCheck, BookOpen, ArrowRight, BarChart3, Cpu, Layers, Users, ListChecks, Check } from "lucide-react";
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
  /** "What you can do" — capabilities in plain terms, under the prose. Optional so a
      card without a list still renders. */
  detailBullets?: string[];
};

const features: Feature[] = [
  {
    icon: Layers,
    title: "Multimodal AI",
    desc: "Work with text, documents, spreadsheets, images and voice, all in one conversation with Nexa.",
    highlight: false,
    detailTitle: "Multimodal AI",
    detailParagraphs: [
      "Nexa understands more than plain text. Upload a document, spreadsheet, image, chart or other supported file and ask questions about it directly in your conversation.",
      "Analyse a financial report, review a scanned contract, interpret a chart, summarise a document or extract information from a spreadsheet without switching between different tools.",
      "Nexa can also support voice interactions, allowing users to ask questions and receive spoken responses where enabled. The same access controls and security policies apply regardless of the format you are working with.",
    ],
    detailBullets: [
      "Ask questions about documents and files",
      "Analyse spreadsheets and business data",
      "Understand charts, diagrams and images",
      "Summarise and extract information",
      "Interact with Nexa using voice",
    ],
  },
  {
    icon: Users,
    title: "AI-Powered Team Collaboration",
    desc: "Bring your team and Nexa into the same conversation to share knowledge, solve problems and get work done together.",
    highlight: false,
    detailTitle: "AI-powered team collaboration",
    detailParagraphs: [
      "Nexa brings people and AI into the same workspace. Create shared conversations where team members can discuss an issue, exchange information and ask Nexa questions without leaving the conversation.",
      "Instead of copying information between emails, chats and AI tools, your team can work from a shared thread and use Nexa to summarise discussions, answer questions, analyse information and support decision-making.",
      "Everyone can contribute to the same conversation while Nexa provides AI assistance when needed.",
    ],
    detailBullets: [
      "Create shared conversations with colleagues",
      "Bring Nexa into team discussions",
      "Ask questions and get AI assistance",
      "Share information and files with your team",
      "Keep discussions and AI responses in one place",
    ],
  },
  {
    icon: ListChecks,
    title: "Integrated Task Management",
    desc: "Turn conversations into action. Create, assign and track tasks without leaving Nexa.",
    highlight: false,
    detailTitle: "Integrated task management",
    detailParagraphs: [
      "Great conversations should lead to action. Nexa helps your team turn decisions, requests and follow-ups into actionable tasks without leaving the conversation.",
      "Create tasks, assign them to the right people, set deadlines and track progress from one place. This makes it easier to move from discussing what needs to be done to actually getting it done.",
      "For example, after a team discussion, Nexa can help turn agreed actions into structured tasks that can be assigned and followed through.",
    ],
    detailBullets: [
      "Create tasks from conversations",
      "Assign tasks to team members",
      "Set deadlines and priorities",
      "Track task status and progress",
      "Keep tasks connected to the conversation that created them",
    ],
  },
  {
    icon: Search,
    title: "Ask Your Documents",
    desc: "Find the information you need across your organisation's documents by simply asking Nexa in natural language.",
    highlight: false,
    detailTitle: "Ask your documents",
    detailParagraphs: [
      "Finding information should not require searching through folders, opening multiple files and scanning pages of documents.",
      "With Nexa, you can ask questions in everyday language and find relevant information across your organisation's connected knowledge sources.",
      "Ask questions such as \"What is our travel policy?\", \"What are the payment terms in this contract?\" or \"What changed in the latest policy?\" and Nexa can identify relevant information from the documents available to you.",
      "Nexa helps employees spend less time searching and more time using the information they need.",
    ],
    detailBullets: [
      "Search across large document collections",
      "Ask questions using natural language",
      "Find relevant policies and procedures",
      "Retrieve information from business documents",
      "Reduce time spent manually searching for information",
    ],
  },
  {
    icon: TrendingUp,
    title: "AI-Powered Analysis",
    desc: "Analyse reports, compare data, identify trends and uncover business insights simply by asking Nexa questions.",
    highlight: false,
    detailTitle: "AI-powered analysis",
    detailParagraphs: [
      "Nexa helps turn business information into actionable insights. Instead of manually reviewing reports or building every analysis from scratch, ask Nexa questions about your data and documents using natural language.",
      "Compare performance across periods, identify trends, summarise reports, investigate changes and explore business information through conversation.",
      "For example, you could ask: \"Compare our Q2 expenses with Q1 and highlight the biggest changes.\" Nexa can analyse the available information and present the findings in a way that is easier to understand and act on.",
    ],
    detailBullets: [
      "Analyse business and financial reports",
      "Compare data across periods",
      "Identify trends and changes",
      "Summarise complex information",
      "Ask follow-up questions in natural language",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Secure, Role-Based Access",
    desc: "Control who can access information and features based on their role, responsibilities and permissions.",
    highlight: true,
    detailTitle: "Secure, role-based access",
    detailParagraphs: [
      "Enterprise AI needs enterprise-grade access control. Nexa allows organisations to manage what users can access based on their assigned roles and permissions.",
      "This means employees can use Nexa to access the information and capabilities relevant to their work without automatically gaining access to information they are not authorised to see.",
      "Access controls can be applied across users, content and platform capabilities, helping organisations maintain appropriate boundaries around sensitive business information.",
    ],
    detailBullets: [
      "Define user roles and permissions",
      "Control access to information",
      "Restrict sensitive content to authorised users",
      "Manage access based on responsibilities",
      "Support organisational security and governance",
    ],
  },
  {
    icon: ClipboardCheck,
    title: "Compliance & Audit Support",
    desc: "Give teams quick access to policies and procedures while maintaining visibility into how Nexa is used.",
    highlight: false,
    detailTitle: "Compliance & audit support",
    detailParagraphs: [
      "Nexa helps organisations make important policies, procedures and business information easier to find and use.",
      "Employees can quickly access approved information instead of relying on outdated documents, personal copies or informal explanations. Where audit logging is enabled, Nexa also provides visibility into user interactions, helping organisations understand how the platform is being used.",
      "This creates a more structured approach to accessing organisational knowledge and supports governance, compliance and audit activities.",
    ],
    detailBullets: [
      "Make policies and procedures easier to access",
      "Help employees find approved information",
      "Maintain visibility into Nexa usage",
      "Support governance and compliance processes",
      "Provide an auditable record where logging is enabled",
    ],
  },
  {
    icon: BookOpen,
    title: "Continuous Learning Knowledge Base",
    desc: "Keep Nexa aligned with your organisation's latest policies, procedures and approved information.",
    highlight: false,
    detailTitle: "Continuous learning knowledge base",
    detailParagraphs: [
      "Your organisation's knowledge is constantly changing. Policies are updated, procedures evolve and new documents are introduced.",
      "Nexa's knowledge base allows organisations to add and update approved information so employees can access the latest available content when asking questions.",
      "When information changes, the knowledge available to Nexa can be refreshed without requiring employees to manually search through multiple locations for the latest version.",
      "This helps create a centralised, accessible source of organisational knowledge that evolves with the business.",
    ],
    detailBullets: [
      "Add and update organisational documents",
      "Maintain a centralised knowledge source",
      "Make new policies and procedures available",
      "Reduce reliance on outdated information",
      "Keep organisational knowledge accessible to employees",
    ],
  },
  {
    icon: BarChart3,
    title: "Insights & Adoption Analytics",
    desc: "Understand how your teams use Nexa, what they're asking, and where knowledge gaps are emerging.",
    highlight: false,
    detailTitle: "Insights & adoption analytics",
    detailParagraphs: [
      "Nexa does not just help your employees, it can also help your organisation understand how AI is being used.",
      "Usage and adoption analytics give administrators visibility into how teams interact with Nexa, the types of questions employees ask, and the information they rely on most.",
      "These insights can help organisations identify frequently requested information, discover knowledge gaps, improve the knowledge base and understand where Nexa is delivering value.",
    ],
    detailBullets: [
      "Monitor platform usage and adoption",
      "Identify frequently asked questions",
      "Understand how teams use Nexa",
      "Identify potential knowledge gaps",
      "Improve your organisational knowledge base",
      "Measure adoption over time",
    ],
  },
  {
    icon: Cpu,
    title: "Multiple AI Models",
    desc: "Choose from leading AI models to balance capability, speed and cost for different tasks.",
    highlight: false,
    detailTitle: "Multiple AI models",
    detailParagraphs: [
      "Nexa is not tied to a single AI model. It can connect to multiple AI models, including GPT, Claude, Kimi and DeepSeek, giving organisations greater flexibility over how AI capabilities are used.",
      "Different models can have different strengths, costs and performance characteristics. Nexa allows organisations to select the model that best fits a particular task or configure model selection according to their needs.",
      "As new and more capable AI models become available, Nexa's multi-model architecture provides flexibility to evolve the AI stack without rebuilding the entire platform.",
    ],
    detailBullets: [
      "Work with multiple AI models from one platform",
      "Select different models for different use cases",
      "Balance capability, speed and cost",
      "Configure model preferences or fallback options",
      "Add new models as your AI strategy evolves",
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
          {features.map((f, i) => {
            // A final row holding a single card looks stranded, so let it
            // stretch across the full width of that row instead.
            const isLastCard = i === features.length - 1;
            const spanFullMd = isLastCard && features.length % 2 === 1;
            const spanFullLg = isLastCard && features.length % 3 === 1;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`group relative p-6 sm:p-8 md:p-10 rounded-2xl sm:rounded-[2.5rem] md:rounded-[3rem] bg-white border shadow-[0_10px_40px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(0,0,0,0.12)] transition-all duration-700 hover:border-primary/30 ${
                  f.highlight ? "border-primary/40 ring-2 ring-primary/20" : "border-border/40"
                } ${spanFullMd ? "md:col-span-2" : ""} ${spanFullLg ? "lg:col-span-3" : ""}`}
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
            );
          })}
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

                {/* Scannable capabilities after the prose. Rendered only when a card has
                    them, so the older cards keep their current shape. */}
                {active.detailBullets?.length ? (
                  <div className="pt-2">
                    <h4 className="mb-3 text-[13px] font-bold uppercase tracking-widest text-foreground/70">
                      What you can do
                    </h4>
                    <ul className="space-y-2">
                      {active.detailBullets.map((item, idx) => (
                        <li key={idx} className="flex gap-2.5">
                          <Check className="mt-[3px] h-4 w-4 shrink-0 text-[var(--brand-color,#ed0000)]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default FeaturesSection;
