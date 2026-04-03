const Footer = () => (
  <footer className="border-t border-border/50 py-12 px-6">
    <div className="container mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center">
          <span className="gradient-text font-black text-sm">N</span>
        </div>
        <span className="font-bold text-foreground">UACN</span>
        <span className="text-muted-foreground text-sm ml-2">— The Central Intelligence Hub</span>
      </div>
      <p className="text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} UACN AI. All rights reserved.
      </p>
    </div>
  </footer>
);

export default Footer;
