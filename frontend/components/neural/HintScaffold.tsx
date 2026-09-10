"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NeuralButton } from "./NeuralButton";
import { apiFetch } from "@/lib/api";
import { useAccessibility } from "@/hooks/useAccessibility";

interface HintScaffoldProps {
  questionId: string;
  onHintUsed?: (level: number) => void;
}

interface HintResponse {
  hint?: string;
  level?: number;
}

export const HintScaffold: React.FC<HintScaffoldProps> = ({ questionId, onHintUsed }) => {
  const [level, setLevel] = useState(0);
  const [hints, setHints] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(false);
  const { announce } = useAccessibility();

  const fetchHint = async () => {
    const nextLevel = level + 1;
    if (nextLevel > 3) return;

    setLoading(true);
    try {
      const response = await apiFetch<HintResponse>(`/questions/hint/${questionId}/${nextLevel}`);
      if (response && response.hint) {
        setHints((prev) => ({ ...prev, [nextLevel]: response.hint as string }));
        setLevel(nextLevel);
        if (onHintUsed) onHintUsed(nextLevel);
        // Speak the hint aloud for blind users
        const levelName = nextLevel === 1 ? "Concept" : nextLevel === 2 ? "Logic" : "Strategy";
        announce(
          `Hint level ${nextLevel}, ${levelName}: ${response.hint}`,
          { assertive: true },
        );
      }
    } catch (error) {
      console.error("Failed to fetch hint:", error);
      announce("Sorry, I couldn't get a hint right now.", { assertive: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-300">Stuck? Get a Nudge</h4>
        <NeuralButton
          variant="secondary"
          size="sm"
          onClick={fetchHint}
          disabled={level >= 3 || loading}
        >
          {loading ? "Thinking..." : level === 0 ? "Get Hint" : "Next Level Hint"}
        </NeuralButton>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {[1, 2, 3].map((l) => (
            l <= level && (
              <motion.div
                key={l}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-lg border text-sm ${
                  l === 1 ? "bg-slate-800/30 border-slate-700 text-slate-400" :
                  l === 2 ? "bg-purple-900/20 border-purple-800/50 text-purple-200" :
                  "bg-cyan-900/20 border-cyan-800/50 text-cyan-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-tighter opacity-50">
                    Level {l}: {l === 1 ? "Concept" : l === 2 ? "Logic" : "Strategy"}
                  </span>
                </div>
                {hints[l]}
              </motion.div>
            )
          ))}
        </AnimatePresence>
      </div>

      {level > 0 && (
        <div className="text-[10px] text-slate-500 text-center italic">
          Note: Using hints may slightly reduce your mastery gains for this question.
        </div>
      )}
    </div>
  );
};
