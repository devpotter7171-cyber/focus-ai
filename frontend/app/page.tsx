"use client";

import Link from "next/link";
import { useState } from "react";
import { NeuralBadge } from "@/components/neural/NeuralBadge";
import { Spotlight } from "@/components/ui/Spotlight";
import {
    Brain,
    Menu,
    X,
    Sparkles,
    Bot,
    TrendingUp,
    ArrowRight,
    Eye,
    Activity,
    Target,
    Layers,
    BookOpen,
    Zap,
    Cpu,
} from "lucide-react";
import { motion } from "framer-motion";

/* ---------------------------------------------------------------- helpers */

function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ----------------------------------------------------------------- page  */

export default function LandingPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-slate-900 selection:text-white">
            {/* ------------------------------------------------- Navigation */}
            <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl">
                <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-full px-4 md:px-6 h-14 flex items-center justify-between shadow-lg shadow-slate-900/5">
                    <Link href="/" className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-lg tracking-tight text-slate-900">
                            Focus-AI
                        </span>
                    </Link>

                    <div className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-500">
                        <button
                            onClick={() => scrollToId("features")}
                            className="px-3 py-1.5 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-all"
                        >
                            Features
                        </button>
                        <button
                            onClick={() => scrollToId("how")}
                            className="px-3 py-1.5 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-all"
                        >
                            How it works
                        </button>
                        <button
                            onClick={() => scrollToId("technology")}
                            className="px-3 py-1.5 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-all"
                        >
                            Stack
                        </button>
                    </div>

                    <div className="hidden md:flex items-center gap-2 shrink-0">
                        <Link href="/login">
                            <button className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                                Log in
                            </button>
                        </Link>
                        <Link href="/signup">
                            <button className="px-4 py-1.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.97] transition-all">
                                Get started
                            </button>
                        </Link>
                    </div>

                    <button
                        className="md:hidden p-2 text-slate-600"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {mobileMenuOpen && (
                    <div className="md:hidden mt-2 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-2 shadow-xl">
                        <button
                            className="px-4 py-3 text-left rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            onClick={() => {
                                setMobileMenuOpen(false);
                                scrollToId("features");
                            }}
                        >
                            Features
                        </button>
                        <button
                            className="px-4 py-3 text-left rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            onClick={() => {
                                setMobileMenuOpen(false);
                                scrollToId("how");
                            }}
                        >
                            How it works
                        </button>
                        <button
                            className="px-4 py-3 text-left rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            onClick={() => {
                                setMobileMenuOpen(false);
                                scrollToId("technology");
                            }}
                        >
                            Stack
                        </button>
                        <div className="border-t border-slate-100 mt-1 pt-2 flex flex-col gap-2">
                            <Link
                                href="/login"
                                className="px-4 py-3 text-center text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                Log in
                            </Link>
                            <Link
                                href="/signup"
                                className="px-4 py-3 text-center bg-slate-900 text-white rounded-xl font-semibold text-sm"
                            >
                                Get started
                            </Link>
                        </div>
                    </div>
                )}
            </nav>

            <main className="pt-24">
                {/* --------------------------------------------------- Hero */}
                <section className="relative w-full overflow-hidden bg-white antialiased bg-grid-black/[0.02] pt-24 pb-20">
                    <Spotlight
                        className="-top-40 left-0 md:left-60 md:-top-20"
                        fill="black"
                    />
                    <div className="max-w-6xl mx-auto px-6 relative z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="max-w-3xl"
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 mb-6">
                                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                                Adaptive learning, grounded in behavioral signals
                            </div>

                            <h1 className="text-5xl md:text-7xl lg:text-[5.25rem] leading-[1.05] mb-6 text-slate-900 tracking-tighter font-bold">
                                Detect confusion.{" "}
                                <br className="hidden md:block" />
                                Adapt the lesson in real time.
                            </h1>

                            <p className="text-lg md:text-xl text-slate-500 mb-10 max-w-[60ch] leading-relaxed font-medium">
                                Focus-AI watches dwell time, scroll patterns, and tab switches to
                                spot when a student is struggling, then a contextual bandit picks
                                the next explanation, hint, or practice item.
                            </p>

                            <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
                                <Link href="/signup">
                                    <button className="group h-14 px-8 rounded-full bg-slate-900 text-white font-bold text-base hover:bg-slate-800 transition-all active:scale-[0.98] shadow-xl shadow-slate-900/20 inline-flex items-center gap-2">
                                        Start learning
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                                    </button>
                                </Link>
                                <button
                                    onClick={() => scrollToId("how")}
                                    className="group h-14 px-8 rounded-full bg-white text-slate-900 font-bold text-base border-2 border-slate-200 hover:border-slate-900 transition-all active:scale-[0.98] inline-flex items-center gap-2"
                                >
                                    See how it works
                                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                                </button>
                            </div>

                            <p className="text-xs uppercase tracking-widest font-bold text-slate-400">
                                Bayesian Knowledge Tracing · LinUCB Bandit · XGBoost + LSTM
                            </p>
                        </motion.div>
                    </div>
                </section>

                {/* ------------------------------------- Interface Mockup */}
                <section className="max-w-[1400px] mx-auto px-6 mb-32">
                    <div className="bg-[#f9fafb] rounded-[2.5rem] p-4 md:p-8 border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
                        <div className="bg-white rounded-t-2xl border-b border-slate-100 p-4 flex items-center gap-4 mb-px">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-400" />
                                <div className="w-3 h-3 rounded-full bg-amber-400" />
                                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                            </div>
                            <div className="flex gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                                <Brain className="w-3.5 h-3.5 text-teal-600" />
                                Neural_Interface_v2.0
                            </div>
                            <div className="w-px h-4 bg-slate-200" />
                            <div className="text-xs font-medium text-slate-400 hover:text-slate-600 cursor-pointer">
                                Real-time Confusion Monitoring...
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row h-[600px] bg-white rounded-b-2xl overflow-hidden relative">
                            <div className="flex-1 p-8 md:p-12 overflow-y-auto border-r border-slate-100 bg-slate-50/30">
                                <div className="max-w-2xl mx-auto bg-white shadow-sm border border-slate-200/50 p-8 md:p-12 min-h-full rounded-2xl relative">
                                    <div className="absolute top-8 right-8">
                                        <NeuralBadge variant="destructive" className="animate-pulse">
                                            Confusion Detected
                                        </NeuralBadge>
                                    </div>

                                    <h2 className="text-3xl font-bold mb-2 tracking-tight text-slate-900">
                                        Introduction to Transformers
                                    </h2>
                                    <p className="text-xs text-slate-500 mb-8 font-mono uppercase tracking-wider">
                                        Module 3.1 · Neural Architecture
                                    </p>

                                    <div className="space-y-6 text-sm leading-relaxed text-slate-600">
                                        <p>
                                            Unlike RNNs,{" "}
                                            <span className="bg-amber-100 text-amber-900 px-1 rounded font-medium border-b-2 border-amber-200">
                                                Transformers process the entire input sequence simultaneously
                                            </span>
                                            . This parallelization allows for significantly faster training times.
                                        </p>

                                        <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl my-6 relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
                                            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                                <Bot className="w-4 h-4 text-teal-600" />
                                                Adaptive Insight
                                            </h4>
                                            <p className="text-slate-600 mb-4">
                                                I noticed you slowed down on the concept of
                                                &ldquo;Parallelization&rdquo;. Let&rsquo;s break it down with a
                                                visual analogy.
                                            </p>
                                            <div className="h-32 bg-white border border-slate-200 border-dashed rounded-xl flex items-center justify-center text-slate-400 text-xs uppercase tracking-widest font-bold">
                                                Interactive Diagram: RNN vs Transformer Flow
                                            </div>
                                        </div>

                                        <p>
                                            The core mechanism that enables this is{" "}
                                            <strong>Self-Attention</strong>, which weighs the importance of
                                            different words in the sequence relative to each other.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full lg:w-[450px] flex flex-col bg-white">
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                    <span className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                        <Sparkles className="w-4 h-4 text-teal-500" /> Cognitive Load
                                    </span>
                                    <span className="text-[10px] font-bold bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100">
                                        LIVE
                                    </span>
                                </div>

                                <div className="flex-1 p-6 space-y-8 overflow-y-auto">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold text-slate-600">
                                            <span>Current Confusion Level</span>
                                            <span className="text-rose-500">High (78%)</span>
                                        </div>
                                        <div className="h-24 flex items-end gap-1 pb-2 border-b border-slate-100">
                                            {[20, 30, 25, 40, 35, 50, 65, 80, 75, 60, 78, 72].map(
                                                (h, i) => (
                                                    <div
                                                        key={i}
                                                        className={`flex-1 rounded-t-sm transition-all duration-500 ${h > 60 ? "bg-rose-500" : "bg-teal-500/30"
                                                            }`}
                                                        style={{ height: `${h}%` }}
                                                    />
                                                ),
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl">
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm text-teal-600">
                                                <Sparkles className="w-4 h-4" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-slate-900">
                                                    Bandit Adjusted
                                                </p>
                                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                                    Switched explanation arm to{" "}
                                                    <span className="font-mono">analogy</span> based on dwell
                                                    spike + scroll-back pattern.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                                            <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">
                                                Focus Score
                                            </p>
                                            <p className="text-2xl font-bold text-slate-900">92</p>
                                        </div>
                                        <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                                            <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">
                                                Est. Mastery
                                            </p>
                                            <p className="text-2xl font-bold text-slate-900">
                                                0.74
                                                <span className="text-sm text-slate-500 font-medium ml-1">
                                                    BKT
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --------------------------------------- Role: Students */}
                <section
                    id="features"
                    className="max-w-7xl mx-auto px-6 mb-32 scroll-mt-24"
                >
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <NeuralBadge variant="default" className="mb-4">
                                <Brain className="w-3 h-3 mr-1" /> Adaptive Engine
                            </NeuralBadge>
                            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tighter mb-6">
                                A tutor that notices when you&rsquo;re stuck.
                            </h2>
                            <p className="text-lg text-slate-500 leading-relaxed font-medium mb-8">
                                You read, scroll, click, and answer. Focus-AI quietly turns those
                                signals into a confusion estimate, then changes what you see next.
                                No raised hands. No waiting until the next quiz to find out you
                                were lost.
                            </p>

                            <ul className="space-y-4 mb-10">
                                {[
                                    {
                                        icon: Eye,
                                        title: "Behavior-aware",
                                        body: "Dwell time, scrollbacks, and tab switches feed an XGBoost + LSTM ensemble that flags confusion early.",
                                    },
                                    {
                                        icon: Layers,
                                        title: "Five difficulty levels per topic",
                                        body: "Each subtopic ships with five generated variants. The bandit picks the one most likely to help you right now.",
                                    },
                                    {
                                        icon: Bot,
                                        title: "Hints that scale, not spoil",
                                        body: "Three hint levels: conceptual, logical, then near-answer. You stay in the driver's seat.",
                                    },
                                    {
                                        icon: Activity,
                                        title: "Spaced review built in",
                                        body: "An SRS scheduler and per-skill BKT mastery decide what to resurface, so the things you almost forgot keep coming back.",
                                    },
                                ].map(({ icon: Icon, title, body }) => (
                                    <li key={title} className="flex gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 mb-1">{title}</p>
                                            <p className="text-sm text-slate-500 leading-relaxed">
                                                {body}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="flex flex-wrap gap-3">
                                <Link href="/signup">
                                    <button className="h-12 px-6 rounded-full bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 active:scale-[0.97] transition-all inline-flex items-center gap-2">
                                        Get started free
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </Link>
                            </div>
                        </div>

                        {/* Right: student preview card */}
                        <div className="bg-gradient-to-br from-slate-50 to-white rounded-[2rem] border border-slate-200 p-6 shadow-xl shadow-slate-200/40">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <BookOpen className="w-4 h-4" /> Subtopic · Joins
                                </div>
                                <NeuralBadge variant="default">Adaptive</NeuralBadge>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { label: "Level 1 · Foundation", state: "done" },
                                    { label: "Level 2 · Core", state: "done" },
                                    { label: "Level 3 · Applied", state: "active" },
                                    { label: "Level 4 · Advanced", state: "locked" },
                                    { label: "Level 5 · Mastery", state: "locked" },
                                ].map((row) => (
                                    <div
                                        key={row.label}
                                        className={`flex items-center justify-between p-4 rounded-2xl border ${row.state === "active"
                                                ? "bg-teal-50 border-teal-200"
                                                : row.state === "done"
                                                    ? "bg-white border-slate-200"
                                                    : "bg-slate-50/60 border-slate-100"
                                            }`}
                                    >
                                        <span className="text-sm font-semibold text-slate-800">
                                            {row.label}
                                        </span>
                                        {row.state === "done" && (
                                            <span className="text-xs font-bold text-emerald-600">
                                                Mastered
                                            </span>
                                        )}
                                        {row.state === "active" && (
                                            <span className="text-xs font-bold text-teal-700 inline-flex items-center gap-1">
                                                <Activity className="w-3 h-3" /> In progress
                                            </span>
                                        )}
                                        {row.state === "locked" && (
                                            <span className="text-xs font-bold text-slate-400">
                                                Up next
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 p-4 rounded-2xl bg-slate-900 text-white">
                                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
                                    Mastery (BKT)
                                </p>
                                <div className="flex items-end gap-3">
                                    <p className="text-3xl font-bold">0.62</p>
                                    <p className="text-xs text-slate-300 mb-1.5">
                                        +0.08 since last session
                                    </p>
                                </div>
                                <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full w-[62%] bg-teal-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ----------------------------------------- How it works */}
                <section
                    id="how"
                    className="max-w-7xl mx-auto px-6 mb-32 scroll-mt-24"
                >
                    <div className="mb-14">
                        <NeuralBadge variant="default" className="mb-4">
                            <Zap className="w-3 h-3 mr-1" /> Pipeline
                        </NeuralBadge>
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-slate-900 mb-4 max-w-2xl">
                            How a single click becomes a smarter lesson.
                        </h2>
                        <p className="text-lg text-slate-500 max-w-[55ch] leading-relaxed">
                            Every interaction goes through the same four-stage loop. Latency
                            stays under 200ms end-to-end.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            {
                                step: "01",
                                icon: Eye,
                                title: "Capture signals",
                                body: "useBehavior hook batches dwell, scroll, and tab-switch events to the behavior API.",
                            },
                            {
                                step: "02",
                                icon: Brain,
                                title: "Predict confusion",
                                body: "ml_service runs an XGBoost + LSTM ensemble over the recent feature window.",
                            },
                            {
                                step: "03",
                                icon: Sparkles,
                                title: "Pick the next move",
                                body: "A LinUCB contextual bandit selects between explanation arms: analogy, example, simpler text.",
                            },
                            {
                                step: "04",
                                icon: TrendingUp,
                                title: "Update beliefs",
                                body: "Reward flows back into the bandit and per-skill BKT mastery for better future decisions.",
                            },
                        ].map(({ step, icon: Icon, title, body }) => (
                            <div
                                key={step}
                                className="relative rounded-[2rem] border border-slate-200 bg-white p-6 hover:shadow-lg hover:shadow-slate-200/50 transition-all group overflow-hidden"
                            >
                                <span className="absolute -top-2 -right-1 text-[5rem] font-bold text-slate-100 leading-none select-none pointer-events-none group-hover:text-slate-200 transition-colors">
                                    {step}
                                </span>
                                <div className="relative z-10">
                                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-6">
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ----------------------------------------- Features */}
                <section className="max-w-7xl mx-auto px-6 mb-32">
                    <div className="grid md:grid-cols-5 gap-6">
                        {/* Wide card — spans 3 cols */}
                        <div className="md:col-span-3 group rounded-[2rem] bg-[#f9fafb] p-8 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 border border-transparent hover:border-slate-100">
                            <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-8 shadow-sm h-48 flex flex-col justify-center relative overflow-hidden group-hover:shadow-md transition-shadow">
                                <div className="absolute inset-0 bg-gradient-to-br from-rose-50 to-transparent opacity-50" />
                                <Sparkles className="w-8 h-8 text-rose-500/20 absolute top-4 left-4" />
                                <div className="flex items-end justify-center gap-1 h-32 opacity-80">
                                    <div className="w-4 bg-slate-100 h-12 rounded-t-md" />
                                    <div className="w-4 bg-slate-100 h-16 rounded-t-md" />
                                    <div className="w-4 bg-rose-400 h-24 rounded-t-md animate-pulse shadow-lg shadow-rose-500/30" />
                                    <div className="w-4 bg-slate-100 h-14 rounded-t-md" />
                                </div>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-slate-900">
                                Confusion detection from behavior
                            </h3>
                            <p className="text-slate-500 leading-relaxed font-medium text-sm max-w-[50ch]">
                                Dwell, scrolls, and tab switches feed an XGBoost + LSTM ensemble.
                                No webcam, no eye-tracker — just the signals every browser already
                                gives you.
                            </p>
                        </div>

                        {/* Narrow card — spans 2 cols */}
                        <div className="md:col-span-2 group rounded-[2rem] bg-[#f9fafb] p-8 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 border border-transparent hover:border-slate-100">
                            <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-8 shadow-sm h-48 flex flex-col justify-center items-center group-hover:shadow-md transition-shadow relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-transparent opacity-50" />
                                <div className="bg-white px-4 py-2 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3 relative z-10">
                                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                                    <span className="text-xs font-bold text-slate-700">
                                        Arm switched · analogy
                                    </span>
                                </div>
                                <div className="w-px h-8 bg-slate-200 my-2" />
                                <div className="flex gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100" />
                                    <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                                        <TrendingUp size={16} />
                                    </div>
                                    <div className="w-8 h-8 rounded-lg bg-slate-100" />
                                </div>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-slate-900">
                                LinUCB bandit picks the next arm
                            </h3>
                            <p className="text-slate-500 leading-relaxed font-medium text-sm">
                                A contextual bandit chooses the explanation type, hint level, or
                                practice item most likely to unblock this learner right now.
                            </p>
                        </div>

                        {/* Wide card — spans 2 cols, second row */}
                        <div className="md:col-span-2 group rounded-[2rem] bg-[#f9fafb] p-8 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 border border-transparent hover:border-slate-100">
                            <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-8 shadow-sm h-48 flex flex-col justify-center group-hover:shadow-md transition-shadow relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent opacity-50" />
                                <div className="space-y-3 px-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-400">
                                            BKT MASTERY · INDEXING
                                        </span>
                                        <span className="text-[10px] font-bold text-indigo-600">
                                            0.74
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full w-[74%] bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                    </div>
                                    <p className="text-xs text-slate-500 text-center mt-2 font-medium">
                                        Bayesian Knowledge Tracing per skill
                                    </p>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-slate-900">
                                Mastery you can actually trust
                            </h3>
                            <p className="text-slate-500 leading-relaxed font-medium text-sm">
                                BKT keeps a calibrated probability of mastery per skill. Spaced
                                review uses it to schedule what to resurface and when.
                            </p>
                        </div>

                        {/* Third card — spans 3 cols */}
                        <div className="md:col-span-3 group rounded-[2rem] bg-slate-900 p-8 transition-all hover:shadow-xl hover:shadow-slate-900/30 border border-slate-800">
                            <div className="rounded-2xl border border-slate-700 p-6 mb-8 h-48 flex flex-col justify-center relative overflow-hidden">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
                                        <Cpu className="w-6 h-6 text-teal-400" />
                                    </div>
                                    <div>
                                        <p className="text-white font-bold">Cost-aware LLM routing</p>
                                        <p className="text-slate-400 text-xs mt-0.5">Free models first, paid as fallback</p>
                                    </div>
                                </div>
                                <div className="mt-6 flex gap-2">
                                    {["Tier 1", "Tier 2", "Tier 3", "Paid"].map((t, i) => (
                                        <div key={t} className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${i < 2 ? "bg-teal-500/10 text-teal-400 border border-teal-500/30" : i === 2 ? "bg-slate-800 text-slate-400 border border-slate-700" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"}`}>
                                            {t}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-white">
                                AI tutoring that costs almost nothing
                            </h3>
                            <p className="text-slate-400 leading-relaxed font-medium text-sm max-w-[50ch]">
                                A tiered routing layer sends 96% of generative requests through
                                free models. Caching and token caps keep the system viable for any
                                institution.
                            </p>
                        </div>
                    </div>
                </section>

                {/* ------------------------------------------------ Technology */}
                <section
                    id="technology"
                    className="max-w-7xl mx-auto px-6 mb-32 scroll-mt-24"
                >
                    <div className="rounded-[2.5rem] border border-slate-200 bg-white p-10 md:p-16 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -z-0 opacity-70" />
                        <div className="grid md:grid-cols-5 gap-10 items-center relative z-10">
                            <div className="md:col-span-3">
                                <NeuralBadge variant="default" className="mb-4">
                                    Under the hood
                                </NeuralBadge>
                                <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-slate-900 mb-4">
                                    Adapts in real time, not after the fact.
                                </h2>
                                <p className="text-slate-500 leading-relaxed font-medium mb-6 max-w-[55ch]">
                                    Behavioral signals — pause duration, scroll position, tab
                                    switches — feed a confusion detector the moment they happen.
                                    A reinforcement learning engine picks the response: simpler
                                    text, a visual analogy, or a worked example. All under 200ms.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <Link href="/signup">
                                        <button className="h-11 px-5 rounded-full bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 active:scale-[0.97] transition-all inline-flex items-center gap-2">
                                            Get started
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </Link>
                                </div>
                            </div>

                            <div className="md:col-span-2 grid grid-cols-2 gap-3">
                                {[
                                    { v: "<200ms", l: "Response" },
                                    { v: "5", l: "Levels" },
                                    { v: "3", l: "Hint tiers" },
                                    { v: "0.85", l: "AUC" },
                                ].map((s) => (
                                    <div
                                        key={s.l}
                                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                                    >
                                        <p className="text-2xl font-bold text-slate-900 font-mono">{s.v}</p>
                                        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mt-1">
                                            {s.l}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* -------------------------------------------------- Footer */}
                <footer className="max-w-7xl mx-auto px-6 py-10 border-t border-slate-100">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <p className="font-bold text-slate-900 text-lg tracking-tight mb-1">Focus-AI</p>
                            <p className="text-sm text-slate-400">Adaptive learning for everyone.</p>
                        </div>
                        <div className="flex flex-wrap gap-6 text-sm font-medium text-slate-500">
                            <button
                                onClick={() => scrollToId("features")}
                                className="hover:text-slate-900 transition-colors"
                            >
                                Features
                            </button>
                            <button
                                onClick={() => scrollToId("how")}
                                className="hover:text-slate-900 transition-colors"
                            >
                                How it works
                            </button>
                            <button
                                onClick={() => scrollToId("technology")}
                                className="hover:text-slate-900 transition-colors"
                            >
                                Technology
                            </button>
                            <Link href="/login" className="hover:text-slate-900 transition-colors">
                                Log in
                            </Link>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-8">&copy; {new Date().getFullYear()} Focus-AI</p>
                </footer>
            </main>
        </div>
    );
}
