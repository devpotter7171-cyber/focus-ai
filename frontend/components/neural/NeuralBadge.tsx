import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                primary:
                    "border-transparent bg-teal-500 text-white hover:bg-teal-600 shadow-sm",
                secondary:
                    "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200",
                destructive:
                    "border-transparent bg-rose-500 text-white hover:bg-rose-600 shadow-sm",
                outline:
                    "text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900 backdrop-blur-sm",
                glass:
                    "bg-white/50 text-slate-700 border border-white/50 backdrop-blur-md shadow-sm",
                research:
                    "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm",
                active:
                    "bg-teal-50 text-teal-700 border border-teal-100",
            },
            size: {
                default: "h-6 text-[10px] uppercase tracking-wider",
                sm: "h-5 text-[10px] px-2",
                lg: "h-7 text-xs px-3",
            }
        },
        defaultVariants: {
            variant: "secondary",
            size: "default",
        },
    }
);

export interface NeuralBadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function NeuralBadge({ className, variant, size, ...props }: NeuralBadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
    );
}

export { NeuralBadge, badgeVariants };
