import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTASection = () => (
  <section className="section-padding">
    <div className="container mx-auto max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass-card glow-border p-10 md:p-16 text-center"
      >
        <p className="mono-text text-xs text-primary mb-3 uppercase tracking-widest">Get Started</p>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-balance mb-4">
          Ready to Unlock Your <br />
          Organization's <span className="gradient-text">Intelligence</span>?
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto text-lg mb-8">
          Join forward-thinking enterprises that trust Nexa AI to turn internal knowledge into a competitive advantage.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="text-base gap-2 px-8 h-12">
            Request a Demo <ArrowRight size={16} />
          </Button>
          <Button size="lg" variant="outline" className="text-base px-8 h-12 border-border/60 text-foreground hover:bg-secondary">
            Talk to Sales
          </Button>
        </div>
      </motion.div>
    </div>
  </section>
);

export default CTASection;
