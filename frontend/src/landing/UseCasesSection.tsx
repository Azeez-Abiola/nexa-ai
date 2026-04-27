import { motion } from "framer-motion";
import { DollarSign, Scale, HardHat, Settings, TrendingUp, Megaphone } from "lucide-react";

const cases = [
  { icon: DollarSign, dept: "Finance & Reporting", prompt: '"Walk me through the P&L and flag material changes vs last year"', desc: "Analyze quarterly reports, build management packs, and prep leadership reviews in seconds. Compare periods, explain variances, and surface key metrics — with answers tied to your uploaded filings and internal commentary." },
  { icon: TrendingUp, dept: "Investments", prompt: '"Compare returns across our portfolio holdings and flag underperformers"', desc: "Surface portfolio performance, benchmark against targets, and pull underlying memos and deal documents into a single conversation grounded in your approved data." },
  { icon: Megaphone, dept: "Sales & Marketing", prompt: '"Pull the latest pricing approval and the campaign brief for Q2"', desc: "Reach approved pitch decks, pricing matrices, campaign briefs, and customer references on demand — so reps and marketers spend less time hunting and more time closing." },
  { icon: Scale, dept: "Compliance", prompt: '"Show me the latest anti-bribery policy and when it was last updated"', desc: "Instant access to policies, regulatory documents, and full audit trails for every interaction." },
  { icon: HardHat, dept: "HSE", prompt: '"What is the emergency evacuation procedure for Building 7?"', desc: "Quickly retrieve safety procedures, incident protocols, and training materials when every second counts." },
  { icon: Settings, dept: "Operations", prompt: '"What is the SOP for onboarding a new vendor?"', desc: "Reduce dependency on tribal knowledge. Standard procedures available to everyone, instantly." },
];

const UseCasesSection = () => (
  <section id="use-cases" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-white">
    <div className="container mx-auto max-w-6xl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        whileInView={{ opacity: 1, y: 0 }} 
        viewport={{ once: true }} 
        className="text-center mb-12 sm:mb-20"
      >
        <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight text-[#1A1A1A] mb-4 sm:mb-6 font-sans px-1">
          Built for Every <span className="gradient-text italic">Team</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg leading-relaxed px-1">
          From the boardroom to the plant floor — Nexa speaks every department's language.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
        {cases.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-[2rem] bg-[#F8F9FF] border border-border/40 hover:bg-white hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500"
          >
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500 shrink-0">
                <c.icon size={22} className="group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-lg sm:text-xl text-[#1A1A1A] font-sans">{c.dept}</h3>
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
