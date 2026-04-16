import { motion } from "framer-motion";
import { Upload, ShieldCheck, MessageCircle, Sparkles } from "lucide-react";

const steps = [
  { icon: Upload, num: "01", title: "Upload & Approve", desc: "Privileged users upload documents — policies, reports, SOPs — and approve them for the knowledge base." },
  { icon: ShieldCheck, num: "02", title: "Secure Access Control", desc: "Define who can access what. Role-based permissions ensure the right people see the right information." },
  { icon: MessageCircle, num: "03", title: "Ask Anything", desc: "Employees ask questions in natural language through an intuitive chat interface." },
  { icon: Sparkles, num: "04", title: "Get Intelligent Answers", desc: "Nexa AI delivers precise, contextual answers with source references — in seconds." },
];

const HowItWorksSection = () => (
  <section id="how-it-works" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-[#F8F9FF]">
    <div className="container mx-auto max-w-6xl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        whileInView={{ opacity: 1, y: 0 }} 
        viewport={{ once: true }} 
        className="text-center mb-20"
      >
        <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight text-[#1A1A1A] mb-4 sm:mb-6 font-sans px-1">
          Four Steps to <span className="gradient-text italic">Organizational Intelligence</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg leading-relaxed px-1">
          Nexa streamlines the process of building and accessing your private AI knowledge base.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 md:gap-8">
        {steps.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group relative"
          >
            {/* Connector Line */}
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-[1px] bg-border/40 -z-0" />
            )}
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-white shadow-lg shadow-primary/5 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                <s.icon size={32} className="group-hover:text-white transition-colors" />
              </div>
              <div className="flex flex-col items-center gap-2 mb-4 sm:flex-row sm:justify-center">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">{s.num}</span>
                <h3 className="font-bold text-base sm:text-lg text-[#1A1A1A] font-sans text-center sm:text-left">{s.title}</h3>
              </div>
              <p className="text-[14px] text-muted-foreground leading-relaxed px-4">{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
