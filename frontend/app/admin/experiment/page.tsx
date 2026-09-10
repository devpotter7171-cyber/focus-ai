"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { NeuralSidebar as Sidebar } from "@/components/neural/Sidebar";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { NeuralIconButton } from "@/components/neural/NeuralIconButton";
import {
    FlaskConical,
    Plus,
    Play,
    Pause,
    Users,
    TestTube,
    Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Experiment {
    id: string;
    name: string;
    description: string;
    status: 'draft' | 'running' | 'completed' | 'paused';
    participants: number;
    startDate?: string;
    endDate?: string;
    controlGroup: number;
    treatmentGroup: number;
    banditEnabled: boolean;
}

const mockExperiments: Experiment[] = [
    {
        id: "exp_001",
        name: "Adaptive vs Static Learning",
        description: "Compare learning outcomes between adaptive AI recommendations and static content order.",
        status: "running",
        participants: 156,
        startDate: "2024-01-10",
        controlGroup: 78,
        treatmentGroup: 78,
        banditEnabled: true
    },
    {
        id: "exp_002",
        name: "Visual vs Text Explanations",
        description: "Test which explanation type leads to better knowledge retention.",
        status: "completed",
        participants: 200,
        startDate: "2023-12-01",
        endDate: "2024-01-05",
        controlGroup: 100,
        treatmentGroup: 100,
        banditEnabled: false
    },
    {
        id: "exp_003",
        name: "Confusion Intervention Timing",
        description: "Pilot test of real-time confusion detection with intervention prompts.",
        status: "draft",
        participants: 0,
        controlGroup: 0,
        treatmentGroup: 0,
        banditEnabled: true
    }
];

export default function ExperimentPanelPage() {
    const [experiments] = useState<Experiment[]>(mockExperiments);
    const { toast } = useToast();

    const handleAction = (action: string, exp: Experiment) => {
        toast({
            title: `Experiment Update`,
            description: `${action} triggered for: ${exp.name}`,
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running': return 'bg-emerald-100 text-emerald-700';
            case 'completed': return 'bg-blue-100 text-blue-700';
            case 'paused': return 'bg-amber-100 text-amber-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    return (
        <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
            <Sidebar className="hidden md:flex flex-shrink-0" />

            <main className="flex-1 flex flex-col p-8 md:pl-60 overflow-y-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Experiments</h1>
                        <p className="text-slate-500">A/B Testing and Bandit configurations.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <NeuralButton
                            variant="primary"
                            className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20"
                            onClick={() => toast({ title: "New Experiment", description: "Wizard started." })}
                        >
                            <Plus size={16} className="mr-2" />
                            New Experiment
                        </NeuralButton>
                        <NeuralIconButton icon={FlaskConical} />
                    </div>
                </header>

                <div className="max-w-6xl mx-auto w-full space-y-8">

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Play size={24} />
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-slate-900">{experiments.filter(e => e.status === 'running').length}</div>
                                <div className="text-sm font-medium text-slate-500">Active Experiments</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Users size={24} />
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-slate-900">
                                    {experiments.reduce((acc, e) => acc + e.participants, 0)}
                                </div>
                                <div className="text-sm font-medium text-slate-500">Total Participants</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                <FlaskConical size={24} />
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-slate-900">{experiments.length}</div>
                                <div className="text-sm font-medium text-slate-500">Total Defined</div>
                            </div>
                        </div>
                    </div>

                    {/* Experiment List */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <TestTube size={20} className="text-slate-500" />
                            All Experiments
                        </h2>

                        <div className="space-y-4">
                            {experiments.map((exp, i) => (
                                <motion.div
                                    key={exp.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100 hover:shadow-lg transition-all"
                                >
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">

                                        <div className="flex gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                                <Zap size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="text-lg font-bold text-slate-900">{exp.name}</h3>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${getStatusColor(exp.status)}`}>
                                                        {exp.status}
                                                    </span>
                                                </div>
                                                <p className="text-slate-500 text-sm max-w-2xl">{exp.description}</p>

                                                <div className="flex items-center gap-6 mt-4">
                                                    <div className="flex items-center gap-2">
                                                        <Users size={14} className="text-slate-400" />
                                                        <span className="text-sm font-semibold text-slate-700">{exp.participants} Users</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                                                        <span className="text-sm font-semibold text-slate-700">{exp.controlGroup} Control</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-slate-900" />
                                                        <span className="text-sm font-semibold text-slate-700">{exp.treatmentGroup} Treatment</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end md:self-center">
                                            {exp.status === 'draft' && (
                                                <NeuralButton
                                                    className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                                    onClick={() => handleAction('Start', exp)}
                                                >
                                                    <Play size={14} className="mr-2" /> Start
                                                </NeuralButton>
                                            )}
                                            {exp.status === 'running' && (
                                                <NeuralButton
                                                    className="bg-amber-50 text-amber-600 hover:bg-amber-100"
                                                    onClick={() => handleAction('Pause', exp)}
                                                >
                                                    <Pause size={14} className="mr-2" /> Pause
                                                </NeuralButton>
                                            )}
                                            <NeuralButton variant="ghost">Details</NeuralButton>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
