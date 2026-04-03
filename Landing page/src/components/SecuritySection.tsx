import { motion } from "framer-motion";
import { Shield, KeyRound, CheckCircle2, Server } from "lucide-react";

const items = [
  { icon: Shield, title: "Data Privacy First", desc: "Your documents stay within your infrastructure. Zero data exposure to external systems." },
  { icon: KeyRound, title: "Role-Based Access Control", desc: "Fine-grained permissions at user, team, and document level. See only what you're authorized to." },
  { icon: CheckCircle2, title: "Approval Workflows", desc: "Every document goes through an approval process before entering the knowledge base." },
  { icon: Server, title: "Enterprise Architecture", desc: "SOC 2 compliant infrastructure, encrypted at rest and in transit, with comprehensive audit logging." },
];

const SecuritySection = () => (
  <section id="security" className="section-padding">
    <div className="container mx-auto max-w-5xl">
      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
        <p className="mono-text text-xs text-primary mb-3 uppercase tracking-widest">Trust & Security</p>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-balance mb-4">
          Enterprise-Grade <span className="gradient-text">Security</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
          Built from the ground up with the security posture that enterprise organizations demand.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-5">
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 hover:glow-border transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <item.icon size={20} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2 text-foreground">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default SecuritySection;
