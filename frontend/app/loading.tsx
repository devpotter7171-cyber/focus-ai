
export default function Loading() {
    return (
        <div className="min-h-screen bg-[#fafbfc] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="relative">
                {/* Simple Spinner */}
                <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-slate-800 animate-spin" />
            </div>

            <div className="mt-8 flex flex-col items-center gap-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
                    Loading
                </p>
            </div>
        </div>
    );
}
