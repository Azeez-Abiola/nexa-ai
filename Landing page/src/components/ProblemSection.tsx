import { motion } from "framer-motion";
import { AlertTriangle, Clock, FileSearch, Users } from "lucide-react";

const problems = [
  { icon: FileSearch, title: "Scattered Information", desc: "Critical documents buried across shared drives, emails, and legacy systems nobody remembers." },
  { icon: Clock, title: "Slow Decisions", desc: "Hours wasted hunting for the right policy or report when decisions need to happen now." },
  { icon: Users, title: "People Dependency", desc: "Institutional knowledge locked in the heads of a few people — what happens when they leave?" },
  { icon: AlertTriangle, title: "Compliance Risk", desc: "Outdated procedures surface. Audit trails are incomplete. The risk compounds silently." },
];

const ProblemSection = () => (
  <section className="section-padding">
    <div className="container mx-auto max-w-5xl">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <p className="mono-text text-xs text-primary mb-3 uppercase tracking-widest">The Problem</p>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-balance mb-4">
          Your Organization Knows More <br className="hidden md:block" />
          Than It Can <span className="gradient-text">Access</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
          Every day, teams waste hours searching for answers that already exist somewhere in your organization.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-5">
        {problems.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 group hover:glow-border transition-all duration-300"
          >
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center mb-4">
              <p.icon size={20} className="text-destructive" />
            </div>
            <h3 className="font-semibold text-lg mb-2 text-foreground">{p.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default ProblemSection;
