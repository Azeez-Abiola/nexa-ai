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
  <section id="use-cases" className="py-24 md:py-32 px-6 bg-white">
    <div className="container mx-auto max-w-6xl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        whileInView={{ opacity: 1, y: 0 }} 
        viewport={{ once: true }} 
        className="text-center mb-20"
      >
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[#1A1A1A] mb-6 font-sans">
          Built for Every <span className="gradient-text italic">Team</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
          From the boardroom to the plant floor — Nexa speaks every department's language.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {cases.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group p-8 rounded-[2rem] bg-[#F8F9FF] border border-border/40 hover:bg-white hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500">
                <c.icon size={22} className="group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-xl text-[#1A1A1A] font-sans">{c.dept}</h3>
            </div>
            
            <div className="bg-white/60 rounded-2xl p-4 mb-6 border border-border/20 italic text-sm text-primary/80 font-medium group-hover:bg-white transition-colors">
              {c.prompt}
            </div>
            
            <p className="text-[14px] text-muted-foreground leading-relaxed">{c.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default UseCasesSection;
