import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, ArrowRight, ShieldCheck, Zap, Activity } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate login network request
    setTimeout(() => {
      setIsLoading(false);
      onLogin();
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full flex bg-[#f8fafc] overflow-hidden font-sans">
      
      {/* Left side: Branding & Animation (Hidden on mobile) */}
      <div 
        className="hidden lg:flex lg:w-[45%] relative overflow-hidden flex-col justify-between p-12 text-white bg-cover bg-center"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      >
        {/* Overlay to ensure text readability */}
        <div className="absolute inset-0 bg-[#003355]/80 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#001f33]/90 via-transparent to-[#001f33]/40"></div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded bg-gradient-to-br from-[#0066b3] to-[#0099ff] flex items-center justify-center shadow-lg border border-white/20">
              <span className="text-white font-bold text-xl tracking-tight">SI</span>
            </div>
            <span className="text-2xl font-bold tracking-wide">
              SISL <span className="font-normal text-[#99b3c6]">Portal</span>
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
              Modern HR <br />
              <span className="text-[#66b3ff]">Management</span>
            </h1>
            <p className="text-[#99b3c6] text-lg max-w-md">
              Streamline your workflow, empower your team, and manage resources efficiently with our comprehensive platform.
            </p>
          </motion.div>
        </div>

        {/* Animated Feature Cards */}
        <div className="relative z-10 flex gap-4 mt-12">
          {[
            { icon: ShieldCheck, title: "Secure", delay: 0.4 },
            { icon: Zap, title: "Fast", delay: 0.6 },
            { icon: Activity, title: "Reliable", delay: 0.8 }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: feature.delay, duration: 0.5 }}
              className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-full border border-white/10"
            >
              <feature.icon className="w-4 h-4 text-[#66b3ff]" />
              <span className="text-sm font-medium text-white/90">{feature.title}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="w-full lg:w-[55%] flex items-center justify-center p-6 sm:p-12 relative z-10 bg-[var(--bg)] shadow-[-20px_0_40px_rgba(0,0,0,0.05)]">
        {/* Mobile Header (Hidden on large screens) */}
        <div className="absolute top-8 left-8 flex lg:hidden items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-[#0066b3] to-[#0099ff] flex items-center justify-center shadow-inner">
            <span className="text-white font-bold text-[15px] tracking-tight">SI</span>
          </div>
          <span className="text-[17px] font-bold text-[#003355] tracking-wide">
            SISL <span className="font-normal text-[#5c7083]">Portal</span>
          </span>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-[440px] bg-white p-8 sm:p-10 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100"
        >
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight mb-3 syne">Welcome back</h2>
            <p className="text-slate-500 text-[15px] font-medium">Please enter your details to sign in.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-0.5 syne tracking-wide">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[var(--accent)] transition-colors z-10">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="!pl-11 !py-3 font-medium text-[14px]"
                    placeholder="admin@sisl.com"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5 ml-0.5">
                  <label className="block text-sm font-semibold text-slate-700 syne tracking-wide">Password</label>
                  <a href="#" className="text-sm font-bold text-[var(--accent)] hover:text-[#004b7c] transition-colors">
                    Forgot password?
                  </a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[var(--accent)] transition-colors z-10">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="!pl-11 !py-3 font-medium text-[14px]"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center mt-5">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-slate-600 cursor-pointer">
                Remember me for 30 days
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-3.5 border border-transparent rounded-[8px] shadow-[0_4px_14px_rgba(37,99,235,0.3)] text-[15px] font-semibold text-white bg-[var(--accent)] hover:bg-[#1d4ed8] focus:outline-none transition-all disabled:opacity-70 mt-6 relative overflow-hidden group"
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-center items-center"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="text"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    Sign In
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </form>

          {/* Footer Text */}
          <p className="mt-10 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <a href="#" className="font-semibold text-[#0066b3] hover:text-[#004b7c] transition-colors">
              Contact Your Administrator
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
