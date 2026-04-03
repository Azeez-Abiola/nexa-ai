import { motion } from "framer-motion";
import { Upload, ShieldCheck, MessageCircle, Sparkles } from "lucide-react";

const steps = [
  { icon: Upload, num: "01", title: "Upload & Approve", desc: "Privileged users upload documents — policies, reports, SOPs — and approve them for the knowledge base." },
  { icon: ShieldCheck, num: "02", title: "Secure Access Control", desc: "Define who can access what. Role-based permissions ensure the right people see the right information." },
  { icon: MessageCircle, num: "03", title: "Ask Anything", desc: "Employees ask questions in natural language through an intuitive chat interface." },
  { icon: Sparkles, num: "04", title: "Get Intelligent Answers", desc: "Nexa AI delivers precise, contextual answers with source references — in seconds." },
];

const HowItWorksSection = () => (
  <section id="how-it-works" className="section-padding">
    <div className="container mx-auto max-w-5xl">
      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
        <p className="mono-text text-xs text-primary mb-3 uppercase tracking-widest">How It Works</p>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-balance mb-4">
          Four Steps to <span className="gradient-text">Organizational Intelligence</span>
        </h2>
      </motion.div>

      <div className="grid md:grid-cols-4 gap-6">
        {steps.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12 }}
            className="relative text-center"
          >
            <div className="mono-text text-5xl font-black text-primary/10 mb-3">{s.num}</div>
            <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 glow-border flex items-center justify-center mb-4">
              <s.icon size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
