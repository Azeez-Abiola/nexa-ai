import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/landing/ThemeToggle";
import { useNavigate } from "react-router-dom";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Use Cases", href: "#use-cases" },
  { label: "Security", href: "#security" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-4 left-0 right-0 z-50 px-6"
    >
      <div className="container mx-auto bg-white/70 backdrop-blur-md border border-border/40 rounded-3xl shadow-sm">
        <div className="flex items-center justify-between h-20 px-8">
          <a href="#" className="flex items-center gap-2">
            <div className="flex items-center justify-center">
              <img src="/1879-22.png" alt="Nexa AI Logo" className="w-10 h-10 object-contain" />
            </div>
            <span className="font-bold text-xl text-[#1A1A1A] tracking-tight">nexa.ai</span>
          </a>

          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-[15px] font-semibold text-muted-foreground hover:text-primary transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            {localStorage.getItem('nexa-token') ? (
              <>
                 <Button 
                    variant="ghost" 
                    className="font-bold text-[#1A1A1A]" 
                    onClick={() => {
                      const userStr = localStorage.getItem('nexa-user');
                      if (userStr) {
                        const user = JSON.parse(userStr);
                        if (user.businessUnit === 'SUPERADMIN' || user.grade === 'ADMIN' || user.isAdmin) {
                          window.location.href = "/admin/dashboard";
                        } else {
                          navigate("/user-chat");
                        }
                      }
                    }}
                  >
                    Dashboard
                  </Button>
                  <Button 
                    className="rounded-full px-8 font-bold shadow-lg shadow-primary/10 bg-primary"
                    onClick={() => navigate("/user-chat")}
                  >
                    Go to Chat
                  </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" className="font-bold text-[#1A1A1A]" onClick={() => navigate("/login")}>
                  Sign In
                </Button>
                <Button className="rounded-full px-8 font-bold shadow-lg shadow-primary/10 bg-primary">Contact</Button>
              </>
            )}
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-foreground">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden glass-card border-t border-border overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-3">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground py-2" onClick={() => setMobileOpen(false)}>
                  {l.label}
                </a>
              ))}
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <ThemeToggle />
                <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground hover:text-foreground" onClick={() => {
                  navigate("/login");
                  setMobileOpen(false);
                }}>
                  Sign In
                </Button>
              </div>
              <Button size="sm" className="w-full">Request Demo</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
