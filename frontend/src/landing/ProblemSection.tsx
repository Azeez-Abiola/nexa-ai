import { motion } from "framer-motion";
import { AlertTriangle, Clock, FileSearch, Users } from "lucide-react";

const problems = [
  { icon: FileSearch, title: "Scattered Information", desc: "Critical documents buried across shared drives, emails, and legacy systems nobody remembers." },
  { icon: Clock, title: "Slow Decisions", desc: "Hours wasted hunting for the right policy or report when decisions need to happen now." },
  { icon: Users, title: "People Dependency", desc: "Institutional knowledge locked in the heads of a few people — what happens when they leave?" },
  { icon: AlertTriangle, title: "Compliance Risk", desc: "Outdated procedures surface. Audit trails are incomplete. The risk compounds silently." },
];

const ProblemSection = () => (
  <section className="py-32 px-6 bg-white overflow-hidden relative">
    {/* Floating Orb Background Element */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
    
    <div className="container mx-auto max-w-6xl relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-24"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 mb-8">
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">The Problem</span>
        </div>
        
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#1A1A1A] mb-10 font-sans leading-[1.1]">
          Your Organization Knows More <br className="hidden md:block" />
          Than It Can <span className="gradient-text italic">Access</span>
        </h2>
        
        <div className="relative max-w-3xl mx-auto">
          {/* Central Floating Orb Visual */}
          <motion.div
            animate={{ 
              y: [0, -20, 0],
              scale: [1, 1.05, 1],
            }}
            transition={{ 
              duration: 6, 
              repeat: Infinity,
              ease: "easeInOut" 
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/10 rounded-full blur-3xl opacity-60 -z-10"
          />
          
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-medium">
            Nexa is your friendly AI chatbot designed to make daily conversations smarter and easier. 
            Whether you need quick answers, creative ideas, or just someone to chat with, Nexa fits 
            perfectly into your everyday life and workflow.
          </p>
        </div>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {problems.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group relative p-10 rounded-[2.5rem] bg-white border border-border/40 hover:border-primary/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-500 overflow-hidden"
          >
            {/* Subtle background pattern on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10 flex flex-col items-start text-left">
              <div className="w-16 h-16 rounded-2xl bg-[#F8F9FF] shadow-inner flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-destructive group-hover:text-white transition-all duration-500">
                <p.icon size={28} className="group-hover:text-white transition-colors text-destructive" />
              </div>
              <h3 className="font-bold text-2xl mb-4 text-[#1A1A1A] font-sans group-hover:text-primary transition-colors">{p.title}</h3>
              <p className="text-[16px] text-muted-foreground leading-relaxed font-medium">{p.desc}</p>
              
              {/* Decorative line */}
              <div className="mt-8 w-12 h-1 bg-border/40 group-hover:w-24 group-hover:bg-primary transition-all duration-500" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default ProblemSection;
