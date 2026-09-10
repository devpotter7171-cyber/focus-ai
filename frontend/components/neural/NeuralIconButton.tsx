import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NeuralIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: LucideIcon;
    active?: boolean;
    size?: "sm" | "md" | "lg";
}

export function NeuralIconButton({ icon: Icon, active, size = "md", className, ...props }: NeuralIconButtonProps) {
    const sizeClasses = {
        sm: "w-8 h-8",
        md: "w-10 h-10",
        lg: "w-12 h-12"
    };

    return (
        <button
            className={cn(
                "rounded-full flex items-center justify-center transition-all duration-300",
                "bg-white shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 hover:bg-slate-50",
                "text-slate-600 hover:text-slate-900",
                active && "bg-black text-white hover:bg-neutral-800 hover:text-white shadow-lg shadow-black/20",
                sizeClasses[size],
                className
            )}
            {...props}
        >
            <Icon size={size === "lg" ? 24 : size === "sm" ? 16 : 20} className="transition-transform group-active:scale-95" />
        </button>
    );
}
