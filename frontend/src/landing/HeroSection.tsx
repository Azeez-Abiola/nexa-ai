import { motion } from "framer-motion";
import { ArrowRight, Brain, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const bullets = [
  { icon: Brain, text: "AI-powered answers from your internal knowledge base" },
  { icon: Shield, text: "Enterprise-grade security with role-based access" },
  { icon: Zap, text: "Instant insights from policies, reports & documents" },
];

const HeroSection = () => (
  <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
    {/* Background */}
    <div className="absolute inset-0">
      <img src="/hero-bg.jpg" alt="" className="w-full h-full object-cover opacity-40" width={1920} height={1080} />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
    </div>

    {/* Avatar */}
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, delay: 0.3 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <img
        src="/avatar-1.png"
        alt=""
        className="max-w-[300px] h-auto opacity-15 dark:opacity-10 animate-float select-none"
        width={1024}
        height={1024}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
    </motion.div>

    <div className="container relative z-10 mx-auto px-6 py-20 md:py-32">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-4xl mx-auto text-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 glass-card px-4 py-1.5 mb-8 text-xs mono-text text-muted-foreground"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
          Enterprise AI Assistant
        </motion.div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.08] text-balance mb-6">
          The Intelligent
          <br />
          <span className="gradient-text">Brain of Your</span>
          <br />
          Organization
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-balance">
          <strong>Nexa AI</strong> connects your people to your knowledge. Ask questions, get instant answers from approved internal documents — securely, intelligently, instantly.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Button size="lg" className="text-base gap-2 px-8 h-12">
            Request Demo <ArrowRight size={16} />
          </Button>
          <Button size="lg" variant="outline" className="text-base px-8 h-12 border-border/60 text-foreground hover:bg-secondary">
            See How It Works
          </Button>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {bullets.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.15 }}
              className="glass-card p-4 flex items-start gap-3 text-left"
            >
              <b.icon size={18} className="text-primary mt-0.5 shrink-0" />
              <span className="text-sm text-secondary-foreground">{b.text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

export default HeroSection;
