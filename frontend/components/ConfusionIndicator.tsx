"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertTriangle, CheckCircle, HelpCircle, TrendingUp } from "lucide-react";

export interface ConfusionData {
    confusion_score: number;
    is_confused: boolean;
    confidence: number;
    feature_contributions?: {
        hesitation_ms?: number;
        tab_switches?: number;
        scroll_depth?: number;
        time_on_question?: number;
        attempts?: number;
    };
}

interface ConfusionIndicatorProps {
    confusionData: ConfusionData | null;
    isLoading?: boolean;
    showDetails?: boolean;
    onAdaptationTriggered?: (type: string) => void;
}

export function ConfusionIndicator({
    confusionData,
    isLoading = false,
    showDetails = true,
    onAdaptationTriggered
}: ConfusionIndicatorProps) {
    const [showPulse, setShowPulse] = useState(false);
    const [prevConfusion, setPrevConfusion] = useState<number | null>(null);

    // Detect changes in confusion level
    useEffect(() => {
        if (confusionData && prevConfusion !== null) {
            const delta = confusionData.confusion_score - prevConfusion;
            if (Math.abs(delta) > 0.15) {
                setShowPulse(true);
                setTimeout(() => setShowPulse(false), 2000);
            }
        }
        if (confusionData) {
            setPrevConfusion(confusionData.confusion_score);
        }
    }, [confusionData, prevConfusion]);

    const getConfusionLevel = (score: number): {
        level: "low" | "moderate" | "high";
        label: string;
        color: string;
        bgColor: string;
        icon: React.ReactNode;
        description: string;
    } => {
        if (score < 0.35) {
            return {
                level: "low",
                label: "On Track",
                color: "text-emerald-500",
                bgColor: "bg-emerald-500/10 border-emerald-500/30",
                icon: <CheckCircle className="h-4 w-4" />,
                description: "You're progressing well through this material"
            };
        } else if (score < 0.65) {
            return {
                level: "moderate",
                label: "Moderate Confusion",
                color: "text-amber-500",
                bgColor: "bg-amber-500/10 border-amber-500/30",
                icon: <HelpCircle className="h-4 w-4" />,
                description: "Some hesitation detected – considering additional support"
            };
        } else {
            return {
                level: "high",
                label: "High Confusion",
                color: "text-red-500",
                bgColor: "bg-red-500/10 border-red-500/30",
                icon: <AlertTriangle className="h-4 w-4" />,
                description: "Switching to adaptive explanation to help"
            };
        }
    };

    if (!confusionData && !isLoading) return null;

    const confusion = confusionData || { confusion_score: 0, is_confused: false, confidence: 0 };
    const { level, label, color, bgColor, icon, description } = getConfusionLevel(confusion.confusion_score);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex"
                    >
                        <Badge
                            variant="outline"
                            className={`
                                flex items-center gap-2 px-3 py-1.5 cursor-help
                                ${bgColor} ${color} border
                                transition-all duration-300
                                ${showPulse ? 'ring-2 ring-offset-2 ring-current animate-pulse' : ''}
                            `}
                        >
                            {isLoading ? (
                                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    {icon}
                                    <span className="font-medium text-xs">{label}</span>
                                </>
                            )}
                        </Badge>
                    </motion.div>
                </TooltipTrigger>

                <TooltipContent
                    side="bottom"
                    className="w-80 p-0"
                    sideOffset={8}
                >
                    <div className="p-4 space-y-4">
                        {/* Header */}
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-full ${bgColor}`}>
                                <Brain className={`h-4 w-4 ${color}`} />
                            </div>
                            <div>
                                <p className="font-semibold text-sm">Confusion Detection</p>
                                <p className="text-xs text-muted-foreground">{description}</p>
                            </div>
                        </div>

                        {/* Score Bar */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Confusion Score</span>
                                <span className="font-mono font-medium">
                                    {(confusion.confusion_score * 100).toFixed(0)}%
                                </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${confusion.confusion_score * 100}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                    className={`h-full rounded-full ${level === "low"
                                        ? "bg-emerald-500"
                                        : level === "moderate"
                                            ? "bg-amber-500"
                                            : "bg-red-500"
                                        }`}
                                />
                            </div>
                        </div>

                        {/* Feature Contributions */}
                        {showDetails && confusion.feature_contributions && (
                            <div className="pt-2 border-t border-border">
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Detected Signals
                                </p>
                                <div className="space-y-1.5 text-xs">
                                    {Object.entries(confusion.feature_contributions)
                                        .filter(([_, val]) => val && val > 0.1)
                                        .sort(([, a], [, b]) => (b || 0) - (a || 0))
                                        .slice(0, 3)
                                        .map(([key, value]) => (
                                            <div key={key} className="flex items-center gap-2">
                                                <div className="w-20 text-muted-foreground capitalize">
                                                    {key.replace(/_/g, ' ')}
                                                </div>
                                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary/60 rounded-full"
                                                        style={{ width: `${(value || 0) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="w-8 text-right text-muted-foreground">
                                                    {((value || 0) * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}

                        {/* Model Confidence */}
                        <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                Model Confidence
                            </span>
                            <span className="font-medium">
                                {(confusion.confidence * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// Standalone notification toast for adaptation events
export function AdaptationToast({
    message,
    type
}: {
    message: string;
    type: "easier" | "visual" | "step" | "example" | "analogy" | "harder"
}) {
    const typeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
        easier: { label: "Simplified", icon: <TrendingUp className="h-4 w-4 rotate-180" /> },
        visual: { label: "Visual", icon: <Brain className="h-4 w-4" /> },
        step: { label: "Step-by-Step", icon: <CheckCircle className="h-4 w-4" /> },
        example: { label: "Example", icon: <HelpCircle className="h-4 w-4" /> },
        analogy: { label: "Analogy", icon: <Brain className="h-4 w-4" /> },
        harder: { label: "Challenge", icon: <TrendingUp className="h-4 w-4" /> },
    };

    // Ensure config is always defined with a fallback
    const config = typeLabels[type] ?? typeLabels.example!;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border shadow-lg"
            >
                <div className="p-2 rounded-full bg-primary/10">
                    {config.icon}
                </div>
                <div>
                    <p className="font-medium text-sm">Adapting to {config.label}</p>
                    <p className="text-xs text-muted-foreground">{message}</p>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

