import React from 'react';
import { motion } from 'motion/react';
import { CompanyLogo } from './CompanyLogo';

interface GlowLoadingProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

export const GlowLoading: React.FC<GlowLoadingProps> = ({ 
  message = "GUNMYUNG", 
  subMessage = "System Initializing", 
  fullScreen = true 
}) => {
  return (
    <div className={`${fullScreen ? 'h-screen w-full fixed inset-0 z-[100]' : 'h-64 w-full'} flex flex-col items-center justify-center bg-[#050505] overflow-hidden font-sans`}>
      {/* Dynamic Background Grid */}
      <div className="absolute inset-0 z-0 opacity-20" style={{ 
        backgroundImage: `linear-gradient(#22d3ee22 1px, transparent 1px), linear-gradient(90deg, #22d3ee22 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />
      
      {/* Background Pulses */}
      <motion.div 
        animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"
      />

      <div className="relative flex flex-col items-center gap-12 z-10">
        {/* Complex Orbital System */}
        <div className="relative w-48 h-48 flex items-center justify-center">
          {/* Inner breathing glow */}
          <motion.div 
            animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-primary/30 rounded-full blur-3xl"
          />

          {/* Core Logo Container */}
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative w-28 h-28 flex items-center justify-center z-10 overflow-hidden rounded-full bg-black/40 backdrop-blur-sm"
          >
            <CompanyLogo className="w-full h-full drop-shadow-[0_0_15px_rgba(56,189,248,0.5)] mix-blend-lighten scale-75" />
          </motion.div>

          {/* Outer Orbital Rings - Cyber Style */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-[1px] border-t-primary/80 border-r-transparent border-b-transparent border-l-transparent"
          />
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            className="absolute inset-4 rounded-full border-[1.5px] border-b-primary/60 border-t-transparent border-r-transparent border-l-transparent"
          />
          <motion.div 
            animate={{ rotate: 180 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-10 rounded-full border-[0.5px] border-primary/20"
          />

          {/* Orbiting Particle */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_10px_#38bdf8]" />
          </motion.div>
        </div>

        {/* Loading Information */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="space-y-1">
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="font-black text-4xl tracking-tighter text-white bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400"
            >
              {message}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-[10px] font-bold text-primary tracking-[0.4em] uppercase"
            >
              {subMessage}
            </motion.p>
          </div>

          <div className="flex items-center gap-2 overflow-hidden w-48 h-1 bg-white/5 rounded-full relative">
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent w-full"
            />
          </div>
          
          <motion.span 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-[8px] font-mono text-gray-500 font-bold"
          >
            SECURE_DATA_ACCESS_...
          </motion.span>
        </div>
      </div>
    </div>
  );
};
