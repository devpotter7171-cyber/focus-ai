"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const spinnerVariants = cva(
    "animate-spin rounded-full border-2 border-current border-t-transparent",
    {
        variants: {
            size: {
                sm: "h-4 w-4",
                md: "h-6 w-6",
                lg: "h-8 w-8",
                xl: "h-12 w-12",
            },
        },
        defaultVariants: {
            size: "md",
        },
    }
);

export interface SpinnerProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> { }

export function Spinner({ className, size, ...props }: SpinnerProps) {
    return (
        <div
            role="status"
            aria-label="Loading"
            className={cn(spinnerVariants({ size }), className)}
            {...props}
        >
            <span className="sr-only">Loading...</span>
        </div>
    );
}

// Skeleton component for loading states
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({
    className,
    variant = "rectangular",
    ...props
}: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse bg-muted",
                {
                    "h-4 w-full rounded": variant === "text",
                    "rounded-full": variant === "circular",
                    "rounded-md": variant === "rectangular",
                },
                className
            )}
            {...props}
        />
    );
}

// Progress Ring (circular progress)
export interface ProgressRingProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    className?: string;
    showLabel?: boolean;
}

export function ProgressRing({
    progress,
    size = 48,
    strokeWidth = 4,
    className,
    showLabel = true,
}: ProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className={cn("relative inline-flex items-center justify-center", className)}>
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    className="text-muted"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="text-primary transition-all duration-300 ease-out"
                />
            </svg>
            {showLabel && (
                <span className="absolute text-xs font-medium">
                    {Math.round(progress)}%
                </span>
            )}
        </div>
    );
}

// Linear Progress Bar
export interface ProgressBarProps {
    progress: number;
    className?: string;
    showLabel?: boolean;
    variant?: "default" | "success" | "warning" | "danger";
}

export function ProgressBar({
    progress,
    className,
    showLabel = false,
    variant = "default",
}: ProgressBarProps) {
    const variantClasses = {
        default: "bg-primary",
        success: "bg-green-500",
        warning: "bg-amber-500",
        danger: "bg-red-500",
    };

    return (
        <div className={cn("relative", className)}>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                    className={cn(
                        "h-full rounded-full transition-all duration-300 ease-out",
                        variantClasses[variant]
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
            </div>
            {showLabel && (
                <span className="absolute right-0 -top-5 text-xs text-muted-foreground">
                    {Math.round(progress)}%
                </span>
            )}
        </div>
    );
}
