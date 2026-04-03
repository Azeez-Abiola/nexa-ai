const Footer = () => (
  <footer className="border-t border-border/50 py-12 px-6">
    <div className="container mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 md:w-10 md:h-10 rounded-md flex items-center justify-center">
          <img src="/logo.png" alt="Nexa AI Logo" className="w-5 h-5 md:w-8 md:h-8 object-contain" />
        </div>
        <span className="font-bold text-foreground">Nexa AI</span>
        <span className="text-muted-foreground text-sm ml-2">— The Central Intelligence Hub</span>
      </div>
      <p className="text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Nexa AI. All rights reserved.
      </p>
    </div>
  </footer>
);

export default Footer;
