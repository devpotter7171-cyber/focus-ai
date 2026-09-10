"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionContextType {
    openItems: Set<string>;
    toggleItem: (id: string) => void;
    multiple?: boolean;
}

const AccordionContext = React.createContext<AccordionContextType | null>(null);

interface AccordionProps {
    children: React.ReactNode;
    type?: "single" | "multiple";
    defaultValue?: string | string[];
    className?: string;
}

export function Accordion({
    children,
    type = "single",
    defaultValue,
    className,
}: AccordionProps) {
    const [openItems, setOpenItems] = React.useState<Set<string>>(() => {
        if (defaultValue) {
            return new Set(Array.isArray(defaultValue) ? defaultValue : [defaultValue]);
        }
        return new Set();
    });

    const toggleItem = React.useCallback(
        (id: string) => {
            setOpenItems((prev) => {
                const next = new Set(prev);
                if (next.has(id)) {
                    next.delete(id);
                } else {
                    if (type === "single") {
                        next.clear();
                    }
                    next.add(id);
                }
                return next;
            });
        },
        [type]
    );

    return (
        <AccordionContext.Provider value={{ openItems, toggleItem, multiple: type === "multiple" }}>
            <div className={cn("space-y-2", className)}>{children}</div>
        </AccordionContext.Provider>
    );
}

interface AccordionItemProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}

export function AccordionItem({ value, children, className }: AccordionItemProps) {
    return (
        <div
            data-state={value}
            className={cn(
                "rounded-lg border border-border bg-card overflow-hidden",
                className
            )}
        >
            {children}
        </div>
    );
}

interface AccordionTriggerProps {
    children: React.ReactNode;
    className?: string;
    value: string;
}

export function AccordionTrigger({ children, className, value }: AccordionTriggerProps) {
    const context = React.useContext(AccordionContext);
    if (!context) throw new Error("AccordionTrigger must be used within Accordion");

    const isOpen = context.openItems.has(value);

    return (
        <button
            type="button"
            onClick={() => context.toggleItem(value)}
            aria-expanded={isOpen}
            className={cn(
                "flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-all hover:bg-muted/50",
                className
            )}
        >
            <span className="flex-1 text-left">{children}</span>
            <ChevronDown
                className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                )}
            />
        </button>
    );
}

interface AccordionContentProps {
    children: React.ReactNode;
    className?: string;
    value: string;
}

export function AccordionContent({ children, className, value }: AccordionContentProps) {
    const context = React.useContext(AccordionContext);
    if (!context) throw new Error("AccordionContent must be used within Accordion");

    const isOpen = context.openItems.has(value);

    if (!isOpen) return null;

    return (
        <div
            className={cn(
                "overflow-hidden border-t border-border",
                "animate-in slide-in-from-top-1 duration-200",
                className
            )}
        >
            <div className="px-4 py-3">{children}</div>
        </div>
    );
}

// Higher-level Unit Accordion for Course Overview
interface UnitData {
    id: string;
    title: string;
    progress: number;
    subtopics: SubtopicData[];
}

interface SubtopicData {
    id: string;
    title: string;
    difficulty: number;
    completed?: boolean;
}

interface UnitAccordionProps {
    units: UnitData[];
    onSubtopicClick?: (unitId: string, subtopicId: string) => void;
    onStartUnit?: (unitId: string) => void;
}

export function UnitAccordion({ units, onSubtopicClick, onStartUnit }: UnitAccordionProps) {
    const getDifficultyColor = (difficulty: number) => {
        if (difficulty <= 2) return "bg-green-100 text-green-700";
        if (difficulty <= 3) return "bg-amber-100 text-amber-700";
        return "bg-red-100 text-red-700";
    };

    return (
        <Accordion type="single" className="space-y-3">
            {units.map((unit) => (
                <AccordionItem key={unit.id} value={unit.id}>
                    <div className="flex items-center gap-4">
                        <AccordionTrigger value={unit.id} className="flex-1">
                            <div className="flex items-center gap-3">
                                <span className="font-semibold">{unit.title}</span>
                                <span className="text-xs text-muted-foreground">
                                    {Math.round(unit.progress)}% complete
                                </span>
                            </div>
                        </AccordionTrigger>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onStartUnit?.(unit.id);
                            }}
                            className="mr-4 px-3 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            Start
                        </button>
                    </div>

                    {/* Progress bar */}
                    <div className="px-4 pb-2">
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${unit.progress}%` }}
                            />
                        </div>
                    </div>

                    <AccordionContent value={unit.id}>
                        <div className="space-y-2">
                            {unit.subtopics.map((subtopic) => (
                                <div
                                    key={subtopic.id}
                                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                                    onClick={() => onSubtopicClick?.(unit.id, subtopic.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={cn(
                                                "w-2 h-2 rounded-full",
                                                subtopic.completed ? "bg-green-500" : "bg-muted-foreground/30"
                                            )}
                                        />
                                        <span className="text-sm">{subtopic.title}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={cn(
                                                "px-2 py-0.5 text-xs font-medium rounded",
                                                getDifficultyColor(subtopic.difficulty)
                                            )}
                                        >
                                            {subtopic.difficulty}/5
                                        </span>
                                        <button
                                            className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs rounded bg-secondary hover:bg-secondary/80 transition-all"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSubtopicClick?.(unit.id, subtopic.id);
                                            }}
                                        >
                                            View
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}
