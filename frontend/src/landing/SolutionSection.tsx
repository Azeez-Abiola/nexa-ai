import { motion } from "framer-motion";
import { MessageSquare, Lock, BarChart3, Lightbulb } from "lucide-react";

const pillars = [
  { 
    icon: MessageSquare, 
    title: "Conversational AI", 
    desc: "Ask questions in plain language. Nexa AI understands context, nuance, and intent to provide human-like assistance.",
    color: "from-blue-500/20 to-cyan-500/20"
  },
  { 
    icon: Lock, 
    title: "Secure Document Access", 
    desc: "Only approved, authorized content is searchable. Every query respects your organization's access controls.",
    color: "from-red-500/20 to-orange-500/20"
  },
  { 
    icon: BarChart3, 
    title: "Instant Insights", 
    desc: "From financial summaries to compliance checks — get analytical answers in seconds from your data.",
    color: "from-purple-500/20 to-pink-500/20"
  },
];

const SolutionSection = () => (
  <section className="section-padding bg-white relative overflow-hidden">
    {/* Decorative background elements */}
    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/4" />
    
    <div className="container mx-auto max-w-6xl px-4 sm:px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        whileInView={{ opacity: 1, y: 0 }} 
        viewport={{ once: true }} 
        className="text-center mb-20"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 mb-6">
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">The Solution</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight text-[#1A1A1A] mb-6 font-sans">
          Meet <span className="gradient-text">Nexa AI</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg md:text-xl leading-relaxed">
          An AI assistant that turns your organization's documents into an intelligent, conversational knowledge engine.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-8">
        {pillars.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.8 }}
            className="group relative p-8 sm:p-10 rounded-[2.5rem] bg-white border border-border/40 hover:border-primary/30 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-700"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${p.color} opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-[2.5rem]`} />
            
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-[#F8F9FF] shadow-sm flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                <p.icon size={28} className="group-hover:text-white transition-colors text-primary" />
              </div>
              <h3 className="font-bold text-2xl mb-4 text-[#1A1A1A] font-sans group-hover:text-primary transition-colors">{p.title}</h3>
              <p className="text-[16px] text-muted-foreground leading-relaxed font-medium">{p.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);


export default SolutionSection;
