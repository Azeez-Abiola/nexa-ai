import { motion } from "framer-motion";
import { MessageSquare, Lock, BarChart3, Lightbulb } from "lucide-react";

const pillars = [
  { icon: MessageSquare, title: "Conversational AI", desc: "Ask questions in plain language. UACN understands context, nuance, and intent." },
  { icon: Lock, title: "Secure Document Access", desc: "Only approved, authorized content is searchable. Every query respects access controls." },
  { icon: BarChart3, title: "Instant Insights", desc: "From financial summaries to compliance checks — get analytical answers in seconds." },
  { icon: Lightbulb, title: "Data-Driven Decisions", desc: "Move from gut-feel to evidence-based decisions with AI that knows your data." },
];

const SolutionSection = () => (
  <section className="section-padding bg-secondary/30">
    <div className="container mx-auto max-w-5xl">
      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
        <p className="mono-text text-xs text-primary mb-3 uppercase tracking-widest">The Solution</p>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-balance mb-4">
          Meet <span className="gradient-text">UACN</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
          An AI assistant that turns your organization's documents into an intelligent, conversational knowledge engine.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-5">
        {pillars.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 glow-border"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <p.icon size={20} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2 text-foreground">{p.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default SolutionSection;
