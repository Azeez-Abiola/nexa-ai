import { Mail, Linkedin, Youtube, Instagram, Twitter, ArrowRight, ArrowUp } from "lucide-react";
import { Link } from "react-router-dom";
import { scrollToPageTop } from "@/lib/scrollToPageTop";

const platformLinks = [
  { label: "Secure enterprise chat", href: "#features" },
  { label: "Document search & RAG", href: "#features" },
  { label: "Knowledge groups & access control", href: "#use-cases" },
  { label: "Compliance & audit-ready answers", href: "#security" },
  { label: "Analytics for adoption & usage", href: "#features" },
];

const Footer = () => (
  <footer className="relative flex w-full max-w-full flex-col overflow-x-hidden border-t border-border/40 bg-white pt-12 sm:pt-16 md:pt-20">
    <div className="container relative z-10 mx-auto w-full max-w-6xl min-w-0 px-4 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex shrink-0 items-center justify-center">
            <img src="/1879-22.png" alt="Nexa AI Logo" className="h-9 w-9 object-contain sm:h-10 sm:w-10" />
          </div>
          <span className="min-w-0 truncate font-bold tracking-tight text-[#1A1A1A] text-xl sm:text-2xl">nexa.ai</span>
        </div>
        <button
          type="button"
          aria-label="Back to top"
          onClick={() => scrollToPageTop()}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-full bg-primary text-white shadow-lg shadow-primary/25 transition-opacity hover:opacity-90 sm:self-auto"
        >
          <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      <div className="mb-12 grid grid-cols-1 gap-10 sm:mb-16 sm:gap-12 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-6 md:col-span-2 lg:col-span-2 lg:space-y-8">
          <p className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Nexa is an enterprise AI workspace that turns your approved internal documents, policies, and business
            reports into instant, cited answers — with role-based access, knowledge groups, and audit trails aligned to
            how your organization works.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="mailto:hi@nexa.com"
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/40 bg-[#F8F9FF] px-4 py-2 text-sm font-bold text-[#1A1A1A] transition-all hover:border-primary/20"
            >
              <Mail size={16} className="shrink-0 text-primary" />
              <span className="truncate">hi@nexa.com</span>
              <ArrowRight size={14} className="ml-1 shrink-0 opacity-40" />
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1 sm:gap-4 sm:pt-2">
            {[Linkedin, Youtube, Instagram, Twitter].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border/40 bg-[#F8F9FF] text-muted-foreground transition-all duration-300 hover:border-primary hover:bg-primary hover:text-white"
                aria-label="Social link"
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <h4 className="mb-4 font-sans font-bold text-[#1A1A1A] sm:mb-6">Platform</h4>
          <ul className="space-y-3 sm:space-y-4">
            {platformLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <h4 className="mb-4 font-sans font-bold text-[#1A1A1A] sm:mb-6">Get started</h4>
          <ul className="space-y-3 sm:space-y-4">
            <li>
              <Link to="/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Sign in
              </Link>
            </li>
            <li>
              <Link to="/contact" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Contact us
              </Link>
            </li>
            <li>
              <Link
                to="/contact?intent=demo"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Request a demo
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Terms of service
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/40 px-1 pb-6 pt-6 text-center sm:pb-8 sm:pt-8">
        <p className="mx-auto flex max-w-full flex-col items-center justify-center gap-1 break-words text-xs font-medium text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-2 sm:gap-y-1">
          <span className="inline-flex max-w-full items-center justify-center gap-1.5 px-1">
            <img src="/1879-22.png" alt="" className="h-4 w-4 shrink-0 object-contain opacity-90" width={16} height={16} />
            <span className="min-w-0">&copy; {new Date().getFullYear()} nexa.ai. All rights reserved.</span>
          </span>
          <span className="text-muted-foreground/50 hidden sm:inline" aria-hidden>
            ·
          </span>
          <span className="px-1">Powered by 1879 Tech Hub</span>
        </p>
      </div>
    </div>

    {/* Brand mark — last section of footer so it stays at the visual bottom; width clamp avoids vw scrollbar jitter */}
    <div className="mt-auto w-full max-w-full overflow-hidden border-t border-border/20 bg-gradient-to-b from-white to-slate-50/40 px-3 py-7 sm:px-4 sm:py-10">
      <p
        className="pointer-events-none select-none text-center font-black leading-none tracking-tighter text-[#EEF1F8] [text-shadow:0_1px_0_rgba(255,255,255,0.9)]"
        style={{ fontSize: "clamp(1.85rem, min(11vw, 12vh), 7rem)" }}
      >
        nexa.ai
      </p>
    </div>
  </footer>
);

export default Footer;
