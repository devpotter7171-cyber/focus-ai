"use client";

import React from "react";
import { motion } from "framer-motion";

interface NeuralMasteryProps {
  mastery: number; // 0.0 to 1.0
  label?: string;
}

export const NeuralMastery: React.FC<NeuralMasteryProps> = ({ mastery, label = "Mastery" }) => {
  // Calculate glow color based on mastery
  // Low (0.3): Dim Blue/Purple
  // High (0.9): Bright Cyan/Electric
  const glowOpacity = 0.2 + mastery * 0.6;
  const glowColor = mastery > 0.7 ? "rgba(0, 255, 242, 0.5)" : "rgba(147, 51, 234, 0.5)";

  return (
    <div className="relative flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-900/50 border border-slate-800 backdrop-blur-md">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-widest">{label}</div>
      
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Outer Pulsing Glow */}
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [glowOpacity, glowOpacity * 1.5, glowOpacity],
          }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-0 rounded-full blur-xl"
          style={{ backgroundColor: glowColor }}
        />
        
        {/* Progress Ring */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            className="text-slate-800"
          />
          <motion.circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray="251.2"
            initial={{ strokeDashoffset: 251.2 }}
            animate={{ strokeDashoffset: 251.2 - (251.2 * mastery) }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={mastery > 0.7 ? "text-cyan-400" : "text-purple-500"}
          />
        </svg>

        {/* Percentage Label */}
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-bold text-white">
            {Math.round(mastery * 100)}%
          </span>
        </div>
      </div>

      {/* Status Text */}
      <div className="text-[10px] text-slate-500 italic">
        {mastery > 0.8 ? "Concept Mastered" : mastery > 0.5 ? "Learning Progressing" : "Initial Acquisition"}
      </div>
    </div>
  );
};
