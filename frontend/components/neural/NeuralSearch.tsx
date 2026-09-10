import React from "react";
import { Search } from "lucide-react";

export function NeuralSearch() {
    return (
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
            </div>
            <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-transparent rounded-full leading-5 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 focus:border-slate-200 sm:text-sm shadow-soft transition-all duration-300 hover:shadow-soft-lg w-10 focus:w-64 cursor-pointer focus:cursor-text"
                placeholder="Search..."
            />
        </div>
    );
}
