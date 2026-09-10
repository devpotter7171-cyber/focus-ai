import React from "react";
import { cn } from "@/lib/utils";

interface NeuralButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "glass";
    size?: "sm" | "md" | "lg";
    active?: boolean;
}

export function NeuralButton({ children, variant = "ghost", size = "md", active, className, ...props }: NeuralButtonProps) {
    const variants = {
        primary: "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 hover:-translate-y-0.5",
        secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200",
        ghost: "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50",
        glass: "bg-white/60 backdrop-blur-md text-slate-800 shadow-sm hover:bg-white/80"
    };

    const sizes = {
        sm: "px-3 py-1 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base"
    };

    const activeStyles = "text-slate-900 font-semibold bg-white shadow-sm";

    return (
        <button
            className={cn(
                "rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
                sizes[size],
                variants[variant],
                active && variant === "ghost" && activeStyles,
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}
