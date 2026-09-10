import React from "react";
import { cn } from "@/lib/utils";

interface NeuralCardProps extends React.HTMLAttributes<HTMLDivElement> {
    elevated?: boolean;
}

/**
 * NeuralCard — base surface used across the "neural" themed UI.
 * Mirrors the rounded-[2rem] white card pattern used inline throughout
 * the dashboard pages so we have a single component to import.
 */
export function NeuralCard({ children, elevated, className, ...props }: NeuralCardProps) {
    return (
        <div
            className={cn(
                "rounded-[2rem] bg-white border border-slate-100 shadow-soft",
                elevated && "shadow-lg",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
