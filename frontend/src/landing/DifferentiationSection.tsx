import { motion } from "framer-motion";
import { Database, Lock, Brain, Layers } from "lucide-react";

const diffs = [
  { icon: Database, title: "Built for Internal Data", desc: "Nexa AI works with your approved internal documents, not generic public data." },
  { icon: Lock, title: "Secure & Controlled", desc: "Enterprise-grade access controls. Your data never leaves your environment." },
  { icon: Brain, title: "Context-Aware", desc: "Understands organizational context for truly relevant answers." },
  { icon: Layers, title: "Knowledge + Analytics", desc: "Combines search with analytical intelligence for deeper insights." },
];

const DifferentiationSection = () => (
  <section className="section-padding bg-[#F8F9FF] overflow-hidden">
    <div className="container mx-auto max-w-6xl">
      <div className="flex flex-col lg:flex-row items-center gap-16 md:gap-24">
        {/* Left Side: Content */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="flex-1 text-left"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 mb-6">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Why Nexa AI</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#1A1A1A] mb-8 font-sans leading-[1.1]">
            Beyond a <span className="gradient-text">Generic Assistant</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 font-medium">
            Nexa AI is purpose-built for enterprise knowledge — not a generic AI with your data bolted on. We focus on accuracy, security, and organizational relevance.
          </p>
          
          <button className="px-8 py-4 bg-primary text-white rounded-full font-bold hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 transform hover:-translate-y-1">
            Explore Documentation
          </button>
        </motion.div>

        {/* Right Side: Visual Grid */}
        <div className="flex-1 grid sm:grid-cols-2 gap-6 relative">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-primary/5 blur-3xl -z-10 rounded-full scale-150" />
          
          {diffs.map((d, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-[2rem] bg-white border border-border/40 shadow-sm hover:shadow-xl transition-all duration-500 group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#F8F9FF] flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-white transition-colors">
                <d.icon size={24} className="text-primary group-hover:text-white" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-[#1A1A1A]">{d.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{d.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </section>
);


export default DifferentiationSection;
