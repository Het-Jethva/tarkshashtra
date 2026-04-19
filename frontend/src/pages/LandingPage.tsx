import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fcfcfc] px-6 relative overflow-hidden">
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        animate={{ 
          y: [0, -30, 0], 
          x: [0, 15, 0],
          rotate: [0, 4, 0] 
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-[5%] xl:left-20 top-32 hidden lg:block opacity-40 pointer-events-none"
      >
        <div className="w-64 h-32 rounded-3xl border border-zinc-200/50 bg-white/40 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col p-5 justify-between transition-transform duration-1000 ease-out hover:scale-105">
          <div className="h-4 w-1/3 bg-zinc-200/80 rounded-full" />
          <div className="space-y-2.5">
            <div className="h-3 w-full bg-zinc-100 rounded-full" />
            <div className="h-3 w-4/5 bg-zinc-100 rounded-full" />
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={{ 
          y: [0, 30, 0], 
          x: [0, -15, 0],
          rotate: [0, -4, 0] 
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute right-[5%] xl:right-20 bottom-32 hidden lg:block opacity-40 pointer-events-none"
      >
        <div className="w-56 h-40 rounded-3xl border border-zinc-200/50 bg-white/40 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col p-5 gap-4 transition-transform duration-1000 ease-out hover:scale-105">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100/50" />
            <div className="h-3.5 w-20 bg-zinc-200/80 rounded-full" />
          </div>
          <div className="flex-1 rounded-2xl bg-zinc-100/50" />
        </div>
      </motion.div>
      
      {/* Floating Abstract UI Elements (Desktop Only) */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-3xl w-full text-center relative z-10"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-950 text-white mb-8 shadow-2xl shadow-zinc-900/20"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-check">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        </motion.div>
        
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-zinc-950 mb-6 drop-shadow-sm flex items-center justify-center gap-3">
          Triage 
          <motion.span 
            className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 via-zinc-600 to-zinc-400 bg-[length:200%_auto]"
            animate={{ backgroundPosition: ["0% 50%", "200% 50%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            AI
          </motion.span>
        </h1>
        
        <p className="text-xl text-zinc-500 mb-12 max-w-2xl mx-auto leading-relaxed">
          The intelligent complaint resolution platform. Submit a new support request or access the agent workspace to manage the active queue.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 relative">
          <Link 
            to="/submit"
            className="relative overflow-hidden w-full sm:w-auto inline-flex items-center justify-center h-14 px-8 rounded-xl bg-zinc-950 text-white text-base font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] hover:bg-zinc-800 transition-all duration-200 active:scale-[0.98] group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[150%] skew-x-12 transition-transform duration-1000 ease-out group-hover:translate-x-[150%]" />
            <span className="relative z-10 flex items-center">
              Submit a Complaint
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 transition-transform duration-200 group-hover:translate-x-1"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </span>
          </Link>
          <Link 
            to="/admin"
            className="w-full sm:w-auto inline-flex items-center justify-center h-14 px-8 rounded-xl bg-white/80 backdrop-blur-md text-zinc-900 text-base font-semibold border border-zinc-200/80 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all duration-200 active:scale-[0.98] group"
          >
            Agent Workspace
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 text-zinc-400 transition-colors duration-200 group-hover:text-zinc-900"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
