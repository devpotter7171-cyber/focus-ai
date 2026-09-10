"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { NeuralButton } from "../neural/NeuralButton";
import { NeuralCard } from "../neural/NeuralCard";
import { useToast } from "@/hooks/use-toast";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  subtopic_id: string;
}

export const StudySession: React.FC = () => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDueCards();
  }, []);

  const fetchDueCards = async () => {
    try {
      const response = await apiFetch<Flashcard[]>("/flashcards/due");
      setCards(response || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load study deck.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (quality: number) => {
    const card = cards[currentIndex];
    if (!card) return;
    // Map 0-5 quality to backend ReviewAnswer enum (AGAIN/HARD/GOOD/EASY).
    // The backend route is POST /flashcards/{card_id}/review and expects
    // body { answer: "AGAIN" | "HARD" | "GOOD" | "EASY" }.
    const qualityToAnswer = (q: number): "AGAIN" | "HARD" | "GOOD" | "EASY" => {
      if (q <= 1) return "AGAIN";
      if (q === 2 || q === 3) return "HARD";
      if (q === 4) return "GOOD";
      return "EASY";
    };

    try {
      await apiFetch(`/flashcards/${encodeURIComponent(card.id)}/review`, {
        method: "POST",
        body: JSON.stringify({
          answer: qualityToAnswer(quality),
        }),
      });

      // Move to next card
      if (currentIndex < cards.length - 1) {
        setIsFlipped(false);
        setCurrentIndex((prev) => prev + 1);
      } else {
        setCards([]); // Session complete
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Could not save progress.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm animate-pulse">Syncing your memory deck...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <NeuralCard className="flex flex-col items-center justify-center p-12 text-center">
        <div className="text-4xl mb-4">✨</div>
        <h3 className="text-xl font-bold text-white mb-2">Deck Clear!</h3>
        <p className="text-slate-400 mb-6 max-w-xs">
          You've reviewed all your due flashcards. Your long-term retention is optimizing.
        </p>
        <NeuralButton onClick={fetchDueCards}>Refresh Deck</NeuralButton>
      </NeuralCard>
    );
  }

  const currentCard = cards[currentIndex];
  if (!currentCard) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto">
      <div className="w-full flex justify-between items-center text-xs text-slate-500 uppercase tracking-tighter">
        <span>Active Study Session</span>
        <span>{currentIndex + 1} / {cards.length} Cards</span>
      </div>

      <div className="relative w-full h-80 perspective-1000">
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
          className="relative w-full h-full preserve-3d cursor-pointer"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* Front Side */}
          <NeuralCard className="absolute inset-0 backface-hidden flex items-center justify-center p-8 text-center bg-slate-900 border-2 border-slate-800">
            <div className="text-2xl font-medium text-white">{currentCard.front}</div>
            <div className="absolute bottom-4 text-[10px] text-slate-500 animate-pulse">Click to Reveal Answer</div>
          </NeuralCard>

          {/* Back Side */}
          <NeuralCard 
            className="absolute inset-0 backface-hidden flex items-center justify-center p-8 text-center bg-cyan-950/20 border-2 border-cyan-500/30"
            style={{ transform: "rotateY(180deg)" }}
          >
            <div className="text-xl text-cyan-50">
              {currentCard.back}
            </div>
            <div className="absolute top-4 left-4 text-[8px] text-cyan-500/50 uppercase font-bold tracking-widest">Answer</div>
          </NeuralCard>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {!isFlipped ? (
          <motion.div
            key="flip-hint"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-slate-500 text-sm italic"
          >
            Think about the concept, then flip to check.
          </motion.div>
        ) : (
          <motion.div
            key="ratings"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-wrap justify-center gap-3"
          >
            <NeuralButton onClick={() => handleReview(0)} variant="secondary" className="bg-red-500/10 hover:bg-red-500/20 border-red-500/30">
              Again (0)
            </NeuralButton>
            <NeuralButton onClick={() => handleReview(2)} variant="secondary" className="bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30">
              Hard (2)
            </NeuralButton>
            <NeuralButton onClick={() => handleReview(4)} variant="primary" className="bg-cyan-500/10 border-cyan-500/30">
              Good (4)
            </NeuralButton>
            <NeuralButton onClick={() => handleReview(5)} variant="primary" className="shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              Easy (5)
            </NeuralButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
