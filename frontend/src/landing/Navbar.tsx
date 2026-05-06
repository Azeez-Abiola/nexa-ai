import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { scrollToPageTop } from "@/lib/scrollToPageTop";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Use Cases", href: "#use-cases" },
  { label: "Security", href: "#security" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-2 sm:top-4 left-0 right-0 z-50 px-3 sm:px-6"
    >
      <div className="container mx-auto bg-white/70 backdrop-blur-md border border-border/40 rounded-2xl sm:rounded-3xl shadow-sm">
        <div className="flex items-center justify-between h-16 sm:h-20 px-3 sm:px-6 md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2"
            onClick={(e) => {
              if (location.pathname === "/") {
                e.preventDefault();
                scrollToPageTop();
              }
              setMobileOpen(false);
            }}
          >
            <div className="flex items-center justify-center">
              <img src="/1879-22.png" alt="Nexa AI Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
            </div>
            <span className="font-bold text-lg sm:text-xl text-[#1A1A1A] tracking-tight">nexa.ai</span>
          </Link>

          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-[15px] font-semibold text-muted-foreground hover:text-primary transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            {localStorage.getItem('nexa-token') ? (
              <>
                 <Button 
                    variant="ghost" 
                    className="font-bold text-[#1A1A1A]" 
                    onClick={() => {
                      const userStr = localStorage.getItem('nexa-user');
                      if (userStr) {
                        const user = JSON.parse(userStr);
                        if (user.businessUnit === 'SUPERADMIN' || user.isAdmin) {
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
                <Button variant="ghost" className="rounded-full px-6 font-bold text-[#1A1A1A]" onClick={() => navigate("/login")}>
                  Sign In
                </Button>
                <Button
                  className="rounded-full px-8 font-bold shadow-lg shadow-primary/10 bg-primary"
                  onClick={() => navigate("/contact")}
                >
                  Contact
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-foreground p-2 -mr-2 rounded-xl hover:bg-black/5"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden glass-card border-t border-border rounded-b-2xl sm:rounded-b-3xl shadow-lg max-h-[min(75vh,calc(100dvh-5.5rem))] overflow-y-auto overscroll-contain"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-sm font-semibold text-muted-foreground hover:text-foreground py-3 px-2 rounded-xl hover:bg-black/[0.04]"
                  onClick={() => setMobileOpen(false)}
                >
                  {l.label}
                </a>
              ))}
              <div className="pt-3 mt-2 border-t border-border flex flex-col gap-2">
                {localStorage.getItem("nexa-token") ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full font-bold rounded-xl"
                      onClick={() => {
                        const userStr = localStorage.getItem("nexa-user");
                        if (userStr) {
                          const user = JSON.parse(userStr);
                          if (user.businessUnit === "SUPERADMIN" || user.isAdmin) {
                            window.location.href = "/admin/dashboard";
                          } else {
                            navigate("/user-chat");
                          }
                        }
                        setMobileOpen(false);
                      }}
                    >
                      Dashboard
                    </Button>
                    <Button
                      size="sm"
                      className="w-full font-bold rounded-xl bg-primary"
                      onClick={() => {
                        navigate("/user-chat");
                        setMobileOpen(false);
                      }}
                    >
                      Go to Chat
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full font-bold rounded-xl justify-center"
                      onClick={() => {
                        navigate("/login");
                        setMobileOpen(false);
                      }}
                    >
                      Sign In
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full font-bold rounded-xl"
                      onClick={() => {
                        navigate("/contact");
                        setMobileOpen(false);
                      }}
                    >
                      Contact
                    </Button>
                    <Button
                      size="sm"
                      className="w-full font-bold rounded-xl bg-primary"
                      onClick={() => {
                        navigate("/contact?intent=demo");
                        setMobileOpen(false);
                      }}
                    >
                      Request Demo
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
