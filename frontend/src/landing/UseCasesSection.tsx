import { motion } from "framer-motion";
import { DollarSign, Scale, HardHat, Settings, LineChart } from "lucide-react";

const cases = [
  { icon: DollarSign, dept: "Finance", prompt: '"Summarize Q3 revenue vs Q2 and highlight anomalies"', desc: "Analyze quarterly reports in seconds. Compare periods, spot trends, surface key metrics — no spreadsheets required." },
  { icon: Scale, dept: "Compliance", prompt: '"Show me the latest anti-bribery policy and when it was last updated"', desc: "Instant access to policies, regulatory documents, and full audit trails for every interaction." },
  { icon: HardHat, dept: "HSE", prompt: '"What is the emergency evacuation procedure for Building 7?"', desc: "Quickly retrieve safety procedures, incident protocols, and training materials when every second counts." },
  { icon: Settings, dept: "Operations", prompt: '"What is the SOP for onboarding a new vendor?"', desc: "Reduce dependency on tribal knowledge. Standard procedures available to everyone, instantly." },
  { icon: LineChart, dept: "Executives", prompt: '"What were our top 3 risk factors last quarter?"', desc: "Ask strategic questions, get instant insights backed by your organization's actual data." },
];

const UseCasesSection = () => (
  <section id="use-cases" className="section-padding">
    <div className="container mx-auto max-w-5xl">
      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
        <p className="mono-text text-xs text-primary mb-3 uppercase tracking-widest">Use Cases</p>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-balance mb-4">
          Built for Every <span className="gradient-text">Team</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
          From the boardroom to the plant floor — Nexa AI speaks every department's language.
        </p>
      </motion.div>

      <div className="space-y-5">
        {cases.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="glass-card p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start hover:glow-border transition-all duration-300"
          >
            <div className="shrink-0">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <c.icon size={22} className="text-primary" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-lg text-foreground">{c.dept}</h3>
              </div>
              <p className="mono-text text-sm text-primary/80 mb-3 italic">{c.prompt}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default UseCasesSection;
