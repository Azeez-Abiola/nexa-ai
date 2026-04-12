import { motion } from "framer-motion";
import { Mail, Linkedin, Youtube, Instagram, Twitter, ArrowRight } from "lucide-react";

const Footer = () => (
  <footer className="bg-white pt-24 pb-12 px-6 border-t border-border/40 overflow-hidden relative">
    <div className="container mx-auto max-w-6xl relative z-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-20">
        {/* Brand Column */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <img src="/1879-22.png" alt="Nexa AI Logo" className="w-10 h-10 object-contain" />
            </div>
            <span className="font-bold text-2xl text-[#1A1A1A] tracking-tight">nexa.ai</span>
          </div>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-sm">
            Nexa is your friendly AI chatbot designed to make daily conversations smarter and easier. 
            Whether you need quick answers, creative ideas, or just someone to chat with.
          </p>
          <div className="flex items-center gap-4">
            <a href="mailto:hi@nexa.com" className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#F8F9FF] border border-border/40 text-sm font-bold text-[#1A1A1A] hover:border-primary/20 transition-all">
              <Mail size={16} className="text-primary" />
              hi@nexa.com
              <ArrowRight size={14} className="ml-1 opacity-40" />
            </a>
          </div>
          <div className="flex items-center gap-4 pt-4">
            {[Linkedin, Youtube, Instagram, Twitter].map((Icon, i) => (
              <a key={i} href="#" className="w-10 h-10 rounded-full bg-[#F8F9FF] border border-border/40 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white hover:border-primary transition-all duration-300">
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        {/* Links Columns */}
        <div>
          <h4 className="font-bold text-[#1A1A1A] mb-6 font-sans">Product</h4>
          <ul className="space-y-4">
            {["Smart Chat Assistant", "Image Generator", "Voice Chat", "Custom Prompts", "Multi-language Support", "Mobile App"].map((link) => (
              <li key={link}>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium">{link}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-[#1A1A1A] mb-6 font-sans">Solutions</h4>
          <ul className="space-y-4">
            {["For Students", "For Content Creators", "For Startups", "For Remote Teams", "For Developers"].map((link) => (
              <li key={link}>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium">{link}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-[#1A1A1A] mb-6 font-sans">Company</h4>
          <ul className="space-y-4">
            {["Our Team", "Careers", "Contact Us", "Partnerships", "Privacy Policy", "Terms of Service"].map((link) => (
              <li key={link}>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium">{link}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="pt-12 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center">
            <img src="/1879-22.png" alt="Nexa AI Logo" className="w-6 h-6 object-contain" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            &copy; {new Date().getFullYear()} nexa.ai. All Rights Reserved.
          </p>
        </div>
        
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2 px-6 py-2 rounded-full bg-[#F8F9FF] border border-border/40 text-xs font-bold text-[#1A1A1A] hover:bg-white hover:shadow-lg transition-all"
        >
          Go Back To Top
          <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-primary">↑</span>
        </button>
      </div>

      {/* Large Background Text (Inspired by the screenshot) */}
      <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 text-[20vw] font-black text-[#F8F9FF] -z-10 select-none pointer-events-none tracking-tighter">
        nexa.ai
      </div>
    </div>
  </footer>
);

export default Footer;
