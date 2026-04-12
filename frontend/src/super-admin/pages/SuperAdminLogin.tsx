import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion } from "framer-motion";
import { 
  FiLock, 
  FiMail, 
  FiArrowRight,
  FiChevronLeft,
  FiAlertCircle,
  FiEye,
  FiEyeOff
} from 'react-icons/fi';
import { Sparkles } from "lucide-react";
import { Button } from '@/components/ui/button';

const SuperAdminLogin: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const { data } = await axios.post('/api/v1/admin/auth/login', { email, password });
      localStorage.setItem('cpanelToken', data.token);
      localStorage.setItem('cpanelUser', JSON.stringify(data.admin));
      navigate('/super-admin/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || "Authentication failed. Access denied.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* Left Side: Visual/Content */}
      <div className="lg:w-1/2 relative flex flex-col justify-center p-8 md:p-16 lg:p-24 overflow-hidden min-h-[500px] lg:min-h-screen">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=2000&auto=format&fit=crop" 
            alt="Abstract AI Background" 
            className="w-full h-full object-cover opacity-20 grayscale brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#F8F9FF]/60 via-white/40 to-transparent" />
        </div>

        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-red-500/5 rounded-full blur-[150px] -mr-96 -mt-96 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-red-500/5 rounded-full blur-[120px] -ml-64 -mb-64 pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl mx-auto lg:mx-0 w-full">
          <div className="flex items-center gap-4 mb-16">
            <div className="flex items-center justify-center">
              <img src="/1879-22.png" alt="1879 Logo" className="w-12 h-12 object-contain" />
            </div>
            <span className="font-bold text-3xl text-[#1A1A1A] tracking-tight">nexa.ai <span className="text-red-500 font-normal italic">admin</span></span>
          </div>

          <div className="space-y-10">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-[#1A1A1A] leading-[1.05] font-sans">
              Infrastructure <br /><span className="text-red-500 italic font-normal">Governance</span> portal.
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-xl font-normal">
              Secure access for enterprise-level infrastructure management, tenant provisioning, and global system configuration.
            </p>
          </div>

          {/* Mock UI Visual - Same as User Login */}
          <div className="relative mt-24 w-full max-w-xl">
            <motion.div 
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="bg-white rounded-[3rem] shadow-[0_48px_96px_-24px_rgba(0,0,0,0.12)] border border-border/40 p-10 relative z-10 w-full"
            >
              <div className="flex items-center gap-5 mb-8">
                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-red-500" />
                </div>
                <div className="space-y-2">
                  <div className="h-3.5 w-48 bg-[#1A1A1A]/10 rounded-full" />
                  <div className="h-2.5 w-28 bg-[#1A1A1A]/5 rounded-full" />
                </div>
              </div>
              <div className="space-y-5">
                <div className="h-3 w-full bg-[#1A1A1A]/5 rounded-full" />
                <div className="h-3 w-11/12 bg-[#1A1A1A]/5 rounded-full" />
                <div className="h-3 w-4/5 bg-[#1A1A1A]/5 rounded-full" />
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="bg-red-600 text-white rounded-[2.5rem] shadow-2xl p-10 max-w-md absolute -bottom-20 -right-4 lg:-right-20 z-20 border-8 border-white"
            >
              <p className="text-base font-black uppercase tracking-[0.2em] mb-4 opacity-80">Admin Insight</p>
              <p className="text-xl font-bold leading-relaxed">
                "System-wide performance is optimized. All 24 tenant business units are currently operating within peak efficiency parameters."
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="lg:w-1/2 flex flex-col justify-center p-8 md:p-16 lg:p-24 bg-white relative z-10">
        <div className="max-w-xl mx-auto w-full flex flex-col min-h-[600px]">
          {/* Back Button */}
          <button 
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-900 transition-colors mb-12 group w-fit"
          >
            <FiChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-base font-semibold">Back</span>
          </button>

          <div className="mb-12">
            <h2 className="text-3xl font-semibold text-[#1A1A1A] mb-3 font-sans tracking-tight">
              Sign In to Control Panel
            </h2>
            <p className="text-lg text-muted-foreground font-normal">
              Enter your admin credentials to manage tenants.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6 flex-1">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1A1A1A] ml-1">Admin Email Address</label>
              <div className="relative group">
                <FiMail className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-red-500 transition-colors" />
                <input
                  type="email"
                  placeholder="admin@nexa.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-14 pr-5 py-5 bg-[#F8F9FF] border border-border/60 rounded-2xl focus:outline-none focus:border-red-500/40 focus:ring-4 focus:ring-red-500/5 transition-all font-medium text-[#1A1A1A]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm font-bold text-[#1A1A1A]">Admin Password</label>
              </div>
              <div className="relative group">
                <FiLock className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-red-500 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-14 pr-14 py-5 bg-[#F8F9FF] border border-border/60 rounded-2xl focus:outline-none focus:border-red-500/40 focus:ring-4 focus:ring-red-500/5 transition-all font-medium text-[#1A1A1A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-5 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold flex items-center gap-3"
              >
                <FiAlertCircle size={18} className="shrink-0" />
                {error}
              </motion.div>
            )}

            <Button 
              type="submit" 
              disabled={isLoading} 
              className="w-full py-7 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold text-lg shadow-2xl shadow-red-500/20 transition-all flex items-center justify-center gap-3 group mt-4"
            >
              {isLoading ? "Logging in..." : (
                <>
                  Login
                  <FiArrowRight className="group-hover:translate-x-1 transition-transform w-5 h-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-24 flex items-center justify-center gap-3">
            <img src="/1879-22.png" alt="1879 Logo" className="w-6 h-6 object-contain opacity-50" />
            <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">
              Powered by 1879 Tech Hub
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
