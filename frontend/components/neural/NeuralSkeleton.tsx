import { cn } from "@/lib/utils";

interface NeuralSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    dark?: boolean;
}

export function NeuralSkeleton({ className, dark = false, ...props }: NeuralSkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-[1rem]",
                dark ? "bg-slate-800" : "bg-slate-200/60",
                className
            )}
            {...props}
        />
    );
}

export function NeuralCardSkeleton() {
    return (
        <div className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-soft h-full w-full">
            <div className="flex items-center justify-between mb-4">
                <NeuralSkeleton className="h-6 w-32" />
                <NeuralSkeleton className="h-8 w-8 rounded-xl" />
            </div>
            <div className="space-y-3">
                <NeuralSkeleton className="h-4 w-full" />
                <NeuralSkeleton className="h-4 w-[80%]" />
                <NeuralSkeleton className="h-10 w-full mt-4 rounded-xl" />
            </div>
        </div>
    );
}

export function SuggestionSkeleton() {
    return (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/50 border border-slate-100">
            <NeuralSkeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2 flex-1">
                <NeuralSkeleton className="h-4 w-24" />
                <NeuralSkeleton className="h-3 w-48" />
            </div>
        </div>
    );
}
