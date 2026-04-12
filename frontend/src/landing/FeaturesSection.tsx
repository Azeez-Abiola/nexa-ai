import { motion } from "framer-motion";
import { Search, TrendingUp, ShieldCheck, ClipboardCheck, BookOpen, MessageSquare, Zap, Lock, ArrowRight } from "lucide-react";

const features = [
  { icon: MessageSquare, title: "Contextual Understanding", desc: "Nexa remembers the flow of your conversation to provide relevant and meaningful replies." },
  { icon: Zap, title: "Instant Responses", desc: "Get fast, accurate answers without waiting — perfect for quick info and brainstorming." },
  { icon: Lock, title: "Privacy & Security", desc: "Your conversations are private and protected with top-level security measures." },
  { icon: BookOpen, title: "Continuous Learning", desc: "As new documents are approved, Nexa learns and evolves — always current, always accurate." },
  { icon: ShieldCheck, title: "Role-Based Access", desc: "Granular permissions ensure every user only sees what they're authorized to access." },
  { icon: TrendingUp, title: "AI-Powered Analysis", desc: "Analyze financial reports, spot trends, compare data across periods — all through natural conversation." },
];

const FeaturesSection = () => (
  <section id="features" className="py-24 md:py-32 px-6 bg-white">
    <div className="container mx-auto max-w-6xl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        whileInView={{ opacity: 1, y: 0 }} 
        viewport={{ once: true }} 
        className="text-center mb-20"
      >
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[#1A1A1A] mb-6 font-sans">
          Everything Your Organization <span className="gradient-text italic">Needs to Know</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
          Nexa provides the tools to transform your static documents into an active, intelligent knowledge base.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
        {features.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group relative p-10 rounded-[3rem] bg-white border border-border/40 hover:border-primary/30 shadow-[0_10px_40px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_70px_rgba(0,0,0,0.12)] transition-all duration-700"
          >
            {/* Background Glow on Hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-[3rem]" />
            
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-[#F8F9FF] shadow-sm flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-500">
                <f.icon size={28} className="group-hover:text-white transition-colors text-primary" />
              </div>
              <h3 className="font-bold text-2xl mb-4 text-[#1A1A1A] font-sans group-hover:text-primary transition-colors">{f.title}</h3>
              <p className="text-[16px] text-muted-foreground leading-relaxed font-medium">{f.desc}</p>
              
              {/* Animated arrow on hover */}
              <div className="mt-8 flex items-center gap-2 text-primary font-bold text-sm opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-500 cursor-pointer">
                Learn more <ArrowRight size={16} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;
