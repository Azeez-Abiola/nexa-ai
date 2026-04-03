import { motion } from "framer-motion";
import { Database, Lock, Brain, Layers } from "lucide-react";

const diffs = [
  { icon: Database, title: "Built for Internal Data", desc: "Unlike generic AI tools, UACN works exclusively with your approved internal documents — no hallucinated external data." },
  { icon: Lock, title: "Secure & Controlled", desc: "Enterprise-grade access controls, approval workflows, and audit logging. Your data never leaves your environment." },
  { icon: Brain, title: "Context-Aware Responses", desc: "UACN understands organizational context — departments, roles, document relationships — for truly relevant answers." },
  { icon: Layers, title: "Knowledge + Analytics", desc: "Not just retrieval. UACN combines knowledge base search with analytical intelligence for deeper insights." },
];

const DifferentiationSection = () => (
  <section className="section-padding bg-secondary/30">
    <div className="container mx-auto max-w-5xl">
      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
        <p className="mono-text text-xs text-primary mb-3 uppercase tracking-widest">Why UACN</p>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-balance mb-4">
          Not Another <span className="gradient-text">Chatbot</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
          UACN is purpose-built for enterprise knowledge — not a generic AI with your data bolted on.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-5">
        {diffs.map((d, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 glow-border"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <d.icon size={20} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2 text-foreground">{d.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{d.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default DifferentiationSection;
