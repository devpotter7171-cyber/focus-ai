"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { NeuralBadge } from "@/components/neural/NeuralBadge";
import { sendFeedback } from "@/lib/feedbackApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Info,
    Brain,
    Target,
    TrendingUp,
    User,
    Zap,
    BarChart3,
    BookOpen,
    Image,
    List,
    Lightbulb,
    ArrowDown,
    ArrowUp,
    Sparkles
} from "lucide-react";

// Types for adaptive decisions
export interface AdaptiveDecision {
    // Bandit selection
    selected_arm: {
        name: string;
        id: number;
        confidence: number;
    };
    // Context used
    context: {
        confusion_score: number;
        mastery: number;
        learning_style: string;
        time_on_question_norm?: number;
    };
    // All arm scores for transparency
    all_arm_scores?: Array<{
        name: string;
        score: number;
        is_selected: boolean;
    }>;
    // Reasoning
    reason: string;
    // Timestamp
    timestamp: string;
}

interface AdaptiveInsightsPanelProps {
    userId?: string;
    decision: AdaptiveDecision | null;
    isLoading?: boolean;
    variant?: "badge" | "button" | "icon";
    onRequestNewRecommendation?: () => void;
}

const ARM_ICONS: Record<string, React.ReactNode> = {
    visual: <Image className="h-4 w-4" />,
    step: <List className="h-4 w-4" />,
    example: <BookOpen className="h-4 w-4" />,
    analogy: <Lightbulb className="h-4 w-4" />,
    easier: <ArrowDown className="h-4 w-4" />,
    harder: <ArrowUp className="h-4 w-4" />,
};

const ARM_DESCRIPTIONS: Record<string, string> = {
    visual: "Visual diagrams and infographics",
    step: "Step-by-step walkthrough",
    example: "Concrete examples",
    analogy: "Real-world analogies",
    easier: "Simplified explanation",
    harder: "More challenging version",
};

export function AdaptiveInsightsPanel({
    userId = "user_123", // Default for dev/mock
    decision,
    isLoading = false,
    variant = "badge",
    onRequestNewRecommendation
}: AdaptiveInsightsPanelProps) {
    const [open, setOpen] = useState(false);
    const [feedbackSent, setFeedbackSent] = useState(false);

    if (!decision && !isLoading) return null;

    const TriggerContent = () => {
        if (variant === "icon") {
            return (
                <NeuralButton variant="ghost" className="h-8 w-8 p-0">
                    <Info className="h-4 w-4" />
                </NeuralButton>
            );
        }

        if (variant === "button") {
            return (
                <NeuralButton variant="glass" className="h-8 px-3 text-xs gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    Why this content?
                </NeuralButton>
            );
        }

        // Default: badge
        return (
            <NeuralBadge
                variant="research"
                className="gap-1.5 px-2.5 py-1 cursor-pointer hover:bg-indigo-50 transition-colors"
                onClick={() => setOpen(true)}
            >
                <Zap className="h-3 w-3 fill-indigo-200" />
                <span className="text-xs font-medium">AI-Selected</span>
            </NeuralBadge>
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div onClick={(e) => e.stopPropagation()}>
                    <TriggerContent />
                </div>
            </DialogTrigger>

            <DialogContent className="max-w-lg rounded-[2rem]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                            <Brain className="h-5 w-5 text-indigo-500" />
                        </div>
                        Adaptive Content Insights
                    </DialogTitle>
                    <DialogDescription>
                        Understanding why this content was selected for you
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : decision ? (
                        <>
                            {/* Selected Strategy */}
                            <Card className="border-indigo-500/30 bg-indigo-500/5 shadow-none rounded-2xl">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Selected Strategy
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-xl bg-indigo-500/10">
                                            {ARM_ICONS[decision.selected_arm.name] || <Target className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-lg capitalize">
                                                {decision.selected_arm.name.replace(/_/g, ' ')}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {ARM_DESCRIPTIONS[decision.selected_arm.name] || "Personalized content"}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Context Metrics */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                                        <Target className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Confusion</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">
                                        {(decision.context.confusion_score * 100).toFixed(0)}%
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                                        <TrendingUp className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Mastery</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">
                                        {(decision.context.mastery * 100).toFixed(0)}%
                                    </p>
                                </div>
                            </div>

                            {/* Learning Profile */}
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <User className="h-4 w-4" />
                                    <span className="text-sm font-medium">Learning Profile</span>
                                </div>
                                <NeuralBadge variant="secondary" className="capitalize">
                                    {decision.context.learning_style}
                                </NeuralBadge>
                            </div>

                            {/* All Arm Scores */}
                            {decision.all_arm_scores && decision.all_arm_scores.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                                        <BarChart3 className="h-4 w-4" />
                                        Bandit Arm Scores (LinUCB)
                                    </div>
                                    <div className="space-y-2">
                                        {decision.all_arm_scores
                                            .sort((a, b) => b.score - a.score)
                                            .map((arm) => (
                                                <div
                                                    key={arm.name}
                                                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${arm.is_selected
                                                        ? 'bg-indigo-50 border border-indigo-100'
                                                        : 'bg-slate-50'
                                                        }`}
                                                >
                                                    <div className="w-20 flex items-center gap-2">
                                                        {ARM_ICONS[arm.name]}
                                                        <span className="text-xs capitalize truncate">
                                                            {arm.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min(100, arm.score * 100)}%` }}
                                                            className={`h-full rounded-full ${arm.is_selected
                                                                ? 'bg-indigo-500'
                                                                : 'bg-slate-300'
                                                                }`}
                                                        />
                                                    </div>
                                                    <span className="w-12 text-xs text-right font-mono text-slate-500">
                                                        {arm.score.toFixed(2)}
                                                    </span>
                                                    {arm.is_selected && (
                                                        <NeuralBadge variant="primary" size="sm">
                                                            Selected
                                                        </NeuralBadge>
                                                    )}
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}

                            {/* Reasoning */}
                            <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-100">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-full bg-teal-100/50 mt-0.5">
                                        <Lightbulb className="h-4 w-4 text-teal-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm mb-1 text-teal-900">Why this selection?</p>
                                        <p className="text-sm text-teal-700 leading-relaxed">
                                            {decision.reason}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Feedback Loop */}
                            <div className="border-t border-slate-100 pt-4 mt-2">
                                <p className="text-xs font-bold text-slate-400 mb-3 text-center uppercase tracking-wider">
                                    Was this content confusing?
                                </p>
                                <div className="flex justify-center gap-4">
                                    <NeuralButton
                                        variant="ghost"
                                        disabled={feedbackSent}
                                        className="h-10 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                                        onClick={async () => {
                                            if (feedbackSent) return;
                                            await sendFeedback({
                                                user_id: userId,
                                                subtopic_id: decision.context.learning_style,
                                                is_confused: true,
                                                recommended_arm: decision.selected_arm.name
                                            });
                                            setFeedbackSent(true);
                                            setTimeout(() => setOpen(false), 800);
                                        }}
                                    >
                                        <span className="text-lg mr-2">🤔</span> Yes, confusing
                                    </NeuralButton>
                                    <NeuralButton
                                        variant="ghost"
                                        disabled={feedbackSent}
                                        className="h-10 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                                        onClick={async () => {
                                            if (feedbackSent) return;
                                            await sendFeedback({
                                                user_id: userId,
                                                subtopic_id: decision.context.learning_style,
                                                is_confused: false,
                                                recommended_arm: decision.selected_arm.name
                                            });
                                            setFeedbackSent(true);
                                            setTimeout(() => setOpen(false), 800);
                                        }}
                                    >
                                        <span className="text-lg mr-2">💡</span> No, clear
                                    </NeuralButton>
                                </div>
                            </div>

                            {/* Request new recommendation */}
                            {onRequestNewRecommendation && (
                                <NeuralButton
                                    variant="ghost"
                                    className="w-full border border-slate-200"
                                    onClick={() => {
                                        onRequestNewRecommendation();
                                        setOpen(false);
                                    }}
                                >
                                    Request Different Explanation
                                </NeuralButton>
                            )}
                        </>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Compact inline badge variant for headers
export function AdaptiveBadge({
    armName,
    onClick
}: {
    armName: string;
    onClick?: () => void;
}) {
    return (
        <NeuralBadge
            variant="research"
            className="gap-1.5 px-2.5 py-1 cursor-pointer hover:bg-indigo-50 transition-colors"
            onClick={onClick}
        >
            {ARM_ICONS[armName] || <Zap className="h-3 w-3" />}
            <span className="text-xs font-medium capitalize">{armName}</span>
            <Info className="h-3 w-3 opacity-60 ml-1" />
        </NeuralBadge>
    );
}
