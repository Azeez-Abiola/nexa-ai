import { motion } from "framer-motion";
import { Search, TrendingUp, ShieldCheck, ClipboardCheck, BookOpen } from "lucide-react";

const features = [
  { icon: Search, title: "Smart Document Search & Retrieval", desc: "Find exactly what you need across thousands of documents. Nexa AI understands meaning, not just keywords." },
  { icon: TrendingUp, title: "AI-Powered Analysis", desc: "Analyze financial reports, spot trends, compare data across periods — all through natural conversation." },
  { icon: ShieldCheck, title: "Role-Based Access & Security", desc: "Granular permissions ensure every user only sees what they're authorized to access." },
  { icon: ClipboardCheck, title: "Compliance & Audit Readiness", desc: "Instant access to policies and procedures. Full audit trails of every query and response." },
  { icon: BookOpen, title: "Continuous Learning Knowledge Base", desc: "As new documents are approved, Nexa AI learns and evolves — always current, always accurate." },
];

const FeaturesSection = () => (
  <section id="features" className="section-padding bg-secondary/30">
    <div className="container mx-auto max-w-5xl">
      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
        <p className="mono-text text-xs text-primary mb-3 uppercase tracking-widest">Core Features</p>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-balance mb-4">
          Everything Your Organization <span className="gradient-text">Needs to Know</span>
        </h2>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-5">
        {features.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className={`glass-card p-6 hover:glow-border transition-all duration-300 ${i >= 3 ? "md:col-span-1" : ""}`}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <f.icon size={20} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2 text-foreground">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;
