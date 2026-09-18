import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, CheckCircle2, GitBranch, Play, Database, Zap, Cpu, FileText, Layers, RefreshCw } from 'lucide-react';

export const FlowchartHeroAnimation: React.FC<{ interactive?: boolean }> = ({ interactive = true }) => {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-[360px] md:h-[420px] bg-gradient-to-br from-slate-950 via-indigo-950/80 to-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-indigo-500/30 flex items-center justify-center p-4 md:p-8 select-none group">
      {/* Dynamic Animated Color Gradients in Background */}
      <div 
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: 'radial-gradient(#818cf8 1.2px, transparent 1.2px), radial-gradient(#38bdf8 1.2px, transparent 1.2px)',
          backgroundSize: '28px 28px',
          backgroundPosition: '0 0, 14px 14px'
        }}
      />

      {/* Multi-color Ambient Glowing Orbs */}
      <div className="absolute -top-20 -left-20 w-72 h-72 bg-blue-600/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-purple-600/30 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1.2s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '2.4s' }} />

      {/* Floating Animated Flowchart Shapes in Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Diamond (Decision) */}
        <motion.div
          animate={{ rotate: 360, y: [0, -12, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          className="absolute top-6 left-12 w-8 h-8 border-2 border-amber-400/40 bg-amber-500/10 rotate-45 rounded-sm"
        />
        {/* Parallelogram (Input/Output) */}
        <motion.div
          animate={{ y: [0, 10, 0], x: [0, 5, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-10 right-16 w-12 h-6 border-2 border-cyan-400/40 bg-cyan-500/10 skew-x-12 rounded-xs"
        />
        {/* Pill (Start/End) */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-10 right-28 w-10 h-5 border-2 border-emerald-400/40 bg-emerald-500/10 rounded-full"
        />
        {/* Document Curve */}
        <motion.div
          animate={{ rotate: [0, 10, 0], y: [0, -6, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-12 left-20 w-9 h-7 border-2 border-rose-400/40 bg-rose-500/10 rounded-xs"
        />
      </div>

      {/* Dynamic Connecting SVG Curves with Animated Flow Dash and Glowing Pulse Particles */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <defs>
          <linearGradient id="flowGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="flowGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
          </linearGradient>
          <filter id="glowEffect" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Path 1: Start to Decision */}
        <path
          d="M 140,200 C 220,200 240,200 310,200"
          stroke="url(#flowGrad1)"
          strokeWidth="3"
          fill="none"
          strokeDasharray="8,8"
          filter="url(#glowEffect)"
          className="animate-[dash_15s_linear_infinite]"
        />

        {/* Path 2: Decision to Branch A (Top: Fast Process) */}
        <path
          d="M 430,170 C 480,120 520,110 570,110"
          stroke="#a855f7"
          strokeWidth="3"
          fill="none"
          strokeDasharray="8,8"
          filter="url(#glowEffect)"
        />

        {/* Path 3: Decision to Branch B (Bottom: Cloud Database) */}
        <path
          d="M 430,230 C 480,280 520,290 570,290"
          stroke="#38bdf8"
          strokeWidth="3"
          fill="none"
          strokeDasharray="8,8"
          filter="url(#glowEffect)"
        />

        {/* Path 4: Branch A to Deploy */}
        <path
          d="M 710,110 C 770,110 790,160 840,185"
          stroke="url(#flowGrad2)"
          strokeWidth="3"
          fill="none"
          strokeDasharray="8,8"
          filter="url(#glowEffect)"
        />

        {/* Path 5: Branch B to Deploy */}
        <path
          d="M 710,290 C 770,290 790,240 840,215"
          stroke="url(#flowGrad2)"
          strokeWidth="3"
          fill="none"
          strokeDasharray="8,8"
          filter="url(#glowEffect)"
        />
      </svg>

      {/* Floating Animated Interactive Nodes */}
      <div className="relative z-10 w-full max-w-4xl flex items-center justify-between gap-2 md:gap-4 px-1 md:px-4">
        
        {/* Node 1: Start (Terminal Pill) */}
        <motion.div
          onClick={() => setActiveStep(0)}
          animate={{
            y: [0, -6, 0],
            scale: activeStep === 0 ? 1.08 : 1,
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className={`cursor-pointer rounded-2xl p-3.5 md:p-4 border-2 transition-all duration-300 ${
            activeStep === 0
              ? 'bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-400 text-white shadow-[0_0_30px_rgba(59,130,246,0.7)]'
              : 'bg-slate-900/85 backdrop-blur-md border-slate-700/80 text-slate-200 hover:border-blue-400/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              activeStep === 0 ? 'bg-white/20 text-white' : 'bg-blue-500/20 text-blue-400'
            }`}>
              <Play size={18} fill="currentColor" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-300 block">Início (ISO)</span>
              <span className="text-xs md:text-sm font-bold">Início de Fluxo</span>
            </div>
          </div>
        </motion.div>

        {/* Node 2: Decision (Rhombus / Diamond) */}
        <motion.div
          onClick={() => setActiveStep(1)}
          animate={{
            y: [0, 6, 0],
            scale: activeStep === 1 ? 1.08 : 1,
          }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className={`cursor-pointer rounded-2xl p-3.5 md:p-4 border-2 transition-all duration-300 relative ${
            activeStep === 1
              ? 'bg-gradient-to-br from-purple-600 to-pink-700 border-purple-400 text-white shadow-[0_0_30px_rgba(168,85,247,0.7)]'
              : 'bg-slate-900/85 backdrop-blur-md border-slate-700/80 text-slate-200 hover:border-purple-400/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              activeStep === 1 ? 'bg-white/20 text-white' : 'bg-purple-500/20 text-purple-400'
            }`}>
              <GitBranch size={18} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-300 block">Decisão</span>
              <span className="text-xs md:text-sm font-bold">Validação IA?</span>
            </div>
          </div>
          {/* Edge Label Badges */}
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[9px] font-black bg-emerald-500 text-white rounded-md shadow-xs">
            SIM
          </span>
          <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[9px] font-black bg-rose-500 text-white rounded-md shadow-xs">
            NÃO
          </span>
        </motion.div>

        {/* Node 3 & 4: Dual Branches (Vertical Stack) */}
        <div className="flex flex-col gap-6">
          <motion.div
            onClick={() => setActiveStep(2)}
            animate={{
              x: [0, 4, 0],
              scale: activeStep === 2 ? 1.06 : 1,
            }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            className={`cursor-pointer rounded-xl p-3 border-2 transition-all duration-300 ${
              activeStep === 2
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 border-amber-300 text-white shadow-[0_0_25px_rgba(245,158,11,0.6)]'
                : 'bg-slate-900/85 backdrop-blur-md border-slate-700/80 text-slate-200 hover:border-amber-400/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap size={16} className={activeStep === 2 ? 'text-white' : 'text-amber-400'} />
              <div>
                <span className="text-[9px] font-bold text-amber-300 block uppercase">Processo</span>
                <span className="text-xs font-bold">Execução Rápida</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            onClick={() => setActiveStep(2)}
            animate={{
              x: [0, -4, 0],
              scale: activeStep === 2 ? 1.06 : 1,
            }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            className={`cursor-pointer rounded-xl p-3 border-2 transition-all duration-300 ${
              activeStep === 2
                ? 'bg-gradient-to-r from-sky-600 to-blue-700 border-sky-300 text-white shadow-[0_0_25px_rgba(56,189,248,0.6)]'
                : 'bg-slate-900/85 backdrop-blur-md border-slate-700/80 text-slate-200 hover:border-sky-400/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <Database size={16} className={activeStep === 2 ? 'text-white' : 'text-sky-400'} />
              <div>
                <span className="text-[9px] font-bold text-sky-300 block uppercase">Banco de Dados</span>
                <span className="text-xs font-bold">Registro em Nuvem</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Node 5: Success / Deploy (Terminal Pill) */}
        <motion.div
          onClick={() => setActiveStep(3)}
          animate={{
            y: [0, -5, 0],
            scale: activeStep === 3 ? 1.08 : 1,
          }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
          className={`cursor-pointer rounded-2xl p-3.5 md:p-4 border-2 transition-all duration-300 ${
            activeStep === 3
              ? 'bg-gradient-to-br from-emerald-500 to-teal-700 border-emerald-300 text-white shadow-[0_0_30px_rgba(16,185,129,0.7)]'
              : 'bg-slate-900/85 backdrop-blur-md border-slate-700/80 text-slate-200 hover:border-emerald-400/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              activeStep === 3 ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300 block">Fim de Fluxo</span>
              <span className="text-xs md:text-sm font-bold">Entrega Concluída</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Interactive Step Timeline Controls at Top Right */}
      <div className="absolute top-4 right-6 hidden sm:flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-full border border-slate-700/70 backdrop-blur-md">
        {[0, 1, 2, 3].map((step) => (
          <button
            key={step}
            onClick={() => setActiveStep(step)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              activeStep === step ? 'bg-blue-400 scale-125 shadow-[0_0_8px_#60a5fa]' : 'bg-slate-600 hover:bg-slate-400'
            }`}
            title={`Passo ${step + 1}`}
          />
        ))}
      </div>

      {/* Floating Badges at Bottom */}
      <div className="absolute bottom-4 left-6 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 backdrop-blur-md shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Conexões Dinâmicas Ortogonais
        </span>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/40 backdrop-blur-md shadow-xs">
          <Sparkles size={13} className="text-purple-400" />
          Animação Interativa de Fluxo
        </span>
      </div>
    </div>
  );
};

