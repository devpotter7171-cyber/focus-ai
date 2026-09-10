
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, BookOpen } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { NeuralButton } from "@/components/neural/NeuralButton";


interface ConceptExplainerModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    content: string;
    isLoading?: boolean;
}

export default function ConceptExplainerModal({ isOpen, onClose, title, content, isLoading = false }: ConceptExplainerModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-[70] px-4"
                    >
                        <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-900/20 overflow-hidden ring-1 ring-slate-900/5 max-h-[85vh] flex flex-col">

                            {/* Header */}
                            <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <Sparkles size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 leading-tight">Concept Review</h3>
                                        <p className="text-xs text-slate-500 font-medium">AI-Simplified Explanation</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-900 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-8 overflow-y-auto min-h-[200px]">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                        <p className="text-slate-400 text-sm font-medium animate-pulse">Generating simplified explanation...</p>
                                    </div>
                                ) : (
                                    <div className="prose prose-slate prose-lg max-w-none prose-p:leading-relaxed prose-headings:text-slate-900 prose-strong:text-indigo-700">
                                        <h2 className="text-2xl font-bold text-slate-900 mb-6">{title}</h2>
                                        <ReactMarkdown
                                            components={{
                                                code: ({ node, inline, className, children, ...props }: any) => (
                                                    <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded-md font-mono text-sm" {...props}>
                                                        {children}
                                                    </code>
                                                )
                                            }}
                                        >
                                            {content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 shrink-0 flex justify-end">
                                <NeuralButton
                                    onClick={onClose}
                                    variant="primary"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                                >
                                    Got it, thanks!
                                </NeuralButton>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
