import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "How can I help you optimize your organizational knowledge today?" }
  ]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    setMessages([...messages, { role: "user", content: inputValue }]);
    setInputValue("");
    // Mock response
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "assistant", content: "That's a great question! Based on your internal documents, I can help you with that. Would you like me to summarize the key points?" }]);
    }, 1000);
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-32 pb-12 bg-[#F8F9FF]">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
        
        {/* Abstract curved line like in the first screenshot */}
        <svg
          className="absolute top-0 right-0 w-full h-full opacity-[0.03] dark:opacity-[0.05]"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M0,20 Q40,40 60,0 T100,20"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-primary"
          />
          <path
            d="M0,50 Q30,70 50,30 T100,50"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.3"
            className="text-primary"
          />
        </svg>
      </div>

      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-8 text-[#1A1A1A] font-sans"
          >
            The Personal AI for
            <br />
            Next Gen <span className="gradient-text italic">Success</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Meet the AI chatbot that understands, learns, and delivers your personal
            assistant for everything from customer support to creative ideas.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-5 justify-center items-center mb-20"
          >
            <Button size="lg" className="h-14 px-10 text-base font-bold rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all group bg-primary">
              Try It Free
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          <Button size="lg" variant="outline" className="h-14 px-10 text-base font-bold rounded-full border-2 bg-white/50 backdrop-blur-sm group hover:bg-white hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
            <div className="mr-3 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
              <Play className="w-3.5 h-3.5 fill-primary text-primary group-hover:fill-white group-hover:text-white ml-0.5 transition-colors" />
            </div>
            <span className="group-hover:text-primary transition-colors">Watch Demo</span>
          </Button>
          </motion.div>

          {/* Floating Chat UI Concept */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="relative max-w-4xl mx-auto"
          >
            <div className="bg-white rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-border/40 p-4 md:p-8 backdrop-blur-xl">
              {/* Mock Chat Interface */}
              <div className="space-y-6 text-left">
                <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1A1A1A]">Nexa Assistant</p>
                      <p className="text-[11px] text-green-500 font-medium flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                        Online & Ready
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-border/60" />
                    <div className="w-2 h-2 rounded-full bg-border/60" />
                    <div className="w-2 h-2 rounded-full bg-border/60" />
                  </div>
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-primary/10' : 'bg-secondary'}`}>
                        {msg.role === 'user' ? <div className="w-5 h-5 rounded-full bg-primary/20" /> : null}
                      </div>
                      <div className={`${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none shadow-md shadow-primary/10' : 'bg-secondary/40 text-foreground/80 rounded-tl-none'} rounded-2xl p-4`}>
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input Area */}
                <div className="mt-8 pt-6 border-t border-border/40">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="bg-[#F8F9FF] border border-border/60 rounded-2xl p-2 flex items-center gap-4 focus-within:border-primary/40 transition-colors"
                  >
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Ask a question or make a request..."
                      className="flex-1 bg-transparent border-none outline-none px-4 text-sm text-foreground placeholder:text-muted-foreground"
                    />
                    <div className="flex items-center gap-2">
                      <button type="button" className="w-8 h-8 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:bg-white transition-colors">
                        <span className="text-xs font-bold">+</span>
                      </button>
                      <button 
                        type="submit"
                        className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Decorative blobs around the chat UI */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl -z-10" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl -z-10" />
          </motion.div>

          {/* Trust/Partners Section (Inspired by the bottom of the first screenshot) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="mt-24 pt-12 border-t border-border/40"
          >
            <p className="text-[13px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mb-10">
              Connect Nexa to the apps you love
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
              {["Phoenix", "Foxen", "Boycott", "Arts Mafia", "Natural"].map((partner) => (
                <span key={partner} className="text-xl md:text-2xl font-black tracking-tighter text-[#1A1A1A]">
                  {partner}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
