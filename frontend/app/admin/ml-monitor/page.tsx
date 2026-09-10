"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import { NeuralSidebar as Sidebar } from "@/components/neural/Sidebar";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { NeuralIconButton } from "@/components/neural/NeuralIconButton";
import { LatencyMonitorPanel, type LatencySnapshot } from "@/components/LatencyMonitorPanel";
import { BanditScoresPanel, type BanditState } from "@/components/BanditScoresPanel";
import { ConfusionDistributionPanel, type ConfusionDistribution } from "@/components/ConfusionDistributionPanel";
import {
    Activity,
    Server,
    Clock,
    AlertTriangle,
    Layers,
    Users,
    Brain,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Zap
} from "lucide-react";

interface ModelInfo {
    name: string;
    status: 'loaded' | 'not_loaded' | 'error';
    last_trained?: string;
    version?: string;
    accuracy?: number;
    samples_trained?: number;
}

interface MLModelsStatus {
    models: {
        confusion: ModelInfo;
        bandit: ModelInfo;
        profiler: ModelInfo;
        dkt: ModelInfo;
    }
}

const DEFAULT_MODELS: MLModelsStatus = {
    models: {
        confusion: { name: 'Confusion Detector', status: 'not_loaded' },
        bandit: { name: 'Bandit (LinUCB)', status: 'not_loaded' },
        profiler: { name: 'Cognitive Profiler', status: 'not_loaded' },
        dkt: { name: 'Deep Knowledge Tracing', status: 'not_loaded' },
    }
};

const modelDescriptions: Record<string, string> = {
    confusion: 'XGBoost classifier that predicts user confusion from behavioral signals.',
    bandit: 'LinUCB contextual bandit for optimal explanation type selection.',
    profiler: 'KMeans clustering for segmenting users into cognitive profiles.',
    dkt: 'LSTM-based Deep Knowledge Tracing for predicting future performance.',
};

export default function MLMonitorPage() {
    const [modelsStatus, setModelsStatus] = useState<MLModelsStatus>(DEFAULT_MODELS);
    const [loading, setLoading] = useState(true);
    const [latency, setLatency] = useState<LatencySnapshot | null>(null);
    const [bandit, setBandit] = useState<BanditState | null>(null);
    const [confusion, setConfusion] = useState<ConfusionDistribution | null>(null);
    const [liveLoading, setLiveLoading] = useState(true);

    useEffect(() => {
        fetchModelStatus();
        fetchLiveMetrics();
        // Auto-refresh the live metrics every 15 seconds.
        const handle = setInterval(fetchLiveMetrics, 15_000);
        return () => clearInterval(handle);
    }, []);

    const fetchModelStatus = async () => {
        setLoading(true);
        try {
            const data = await apiFetch<MLModelsStatus>('/ml/models/status');
            setModelsStatus(data);
        } catch (error) {
            console.error('Failed to fetch model status:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLiveMetrics = async () => {
        const [lat, ban, conf] = await Promise.allSettled([
            apiFetch<LatencySnapshot>('/ml/metrics/latency'),
            apiFetch<BanditState>('/ml/metrics/bandit'),
            apiFetch<ConfusionDistribution>('/ml/metrics/confusion-distribution?hours=24'),
        ]);
        if (lat.status === "fulfilled") setLatency(lat.value);
        if (ban.status === "fulfilled") setBandit(ban.value);
        if (conf.status === "fulfilled") setConfusion(conf.value);
        setLiveLoading(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'loaded': return 'text-emerald-500 bg-emerald-50 border-emerald-100';
            case 'not_loaded': return 'text-slate-400 bg-slate-50 border-slate-100';
            case 'error': return 'text-rose-500 bg-rose-50 border-rose-100';
            default: return 'text-slate-500 bg-slate-50';
        }
    };

    const getModelIcon = (modelKey: string) => {
        const iconClass = "h-6 w-6";
        switch (modelKey) {
            case 'confusion': return <AlertTriangle className={`${iconClass} text-amber-500`} />;
            case 'bandit': return <Layers className={`${iconClass} text-blue-500`} />;
            case 'profiler': return <Users className={`${iconClass} text-teal-500`} />;
            case 'dkt': return <Brain className={`${iconClass} text-purple-500`} />;
            default: return <Zap className={iconClass} />;
        }
    };

    const loadedCount = Object.values(modelsStatus.models).filter(m => m.status === 'loaded').length;

    return (
        <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
            <Sidebar className="hidden md:flex flex-shrink-0" />

            <main className="flex-1 flex flex-col p-8 md:pl-60 overflow-y-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">ML Monitor</h1>
                        <p className="text-slate-500">Real-time inference engine status and metrics.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <NeuralButton
                            onClick={() => {
                                fetchModelStatus();
                                fetchLiveMetrics();
                            }}
                            variant="glass"
                            className="bg-white border border-slate-200 text-slate-600 hover:text-teal-600"
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh Status
                        </NeuralButton>
                        <NeuralIconButton icon={Brain} />
                    </div>
                </header>

                <div className="max-w-6xl mx-auto w-full space-y-8">

                    {/* System Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-500">
                                    <Activity className="h-6 w-6" />
                                </div>
                                {loadedCount === 4
                                    ? <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">Health: 100%</span>
                                    : <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">Degraded</span>
                                }
                            </div>
                            <h3 className="text-3xl font-bold text-slate-900 mb-1">Operational</h3>
                            <p className="text-sm text-slate-500">System Status</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 rounded-2xl bg-blue-50 text-blue-500">
                                    <Server className="h-6 w-6" />
                                </div>
                                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">Capacity: 4</span>
                            </div>
                            <h3 className="text-3xl font-bold text-slate-900 mb-1">{loadedCount} / 4</h3>
                            <p className="text-sm text-slate-500">Active Models</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 rounded-2xl bg-purple-50 text-purple-500">
                                    <Clock className="h-6 w-6" />
                                </div>
                                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">12ms Latency</span>
                            </div>
                            <h3 className="text-3xl font-bold text-slate-900 mb-1">Live</h3>
                            <p className="text-sm text-slate-500">Sync Status</p>
                        </motion.div>
                    </div>

                    {/* Live monitoring panels (real production telemetry) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <LatencyMonitorPanel
                            data={latency}
                            loading={liveLoading}
                            className="lg:col-span-2"
                        />
                        <BanditScoresPanel data={bandit} loading={liveLoading} />
                        <ConfusionDistributionPanel
                            data={confusion}
                            loading={liveLoading}
                        />
                    </div>

                    {/* Models Grid */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <Zap className="text-amber-500" size={24} />
                            Inference Engines
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {Object.entries(modelsStatus.models).map(([key, model], index) => (
                                <motion.div
                                    key={key}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={`bg-white rounded-[2rem] p-8 shadow-soft border group transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${model.status === 'error' ? 'border-rose-100' : 'border-slate-100'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-700 group-hover:bg-slate-100 transition-colors">
                                            {getModelIcon(key)}
                                        </div>
                                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 ${getStatusColor(model.status)}`}>
                                            {model.status === 'loaded' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                            {model.status === 'loaded' ? 'ACTIVE' : model.status.toUpperCase().replace('_', ' ')}
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-900 mb-2">{model.name}</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-6 min-h-[40px]">
                                        {modelDescriptions[key]}
                                    </p>

                                    {model.status === 'loaded' ? (
                                        <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Accuracy</p>
                                                <p className="text-lg font-bold text-slate-900 font-mono">
                                                    {model.accuracy ? `${(model.accuracy * 100).toFixed(1)}%` : 'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Samples</p>
                                                <p className="text-lg font-bold text-slate-900 font-mono">
                                                    {model.samples_trained ? model.samples_trained.toLocaleString() : '0'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Version</p>
                                                <p className="text-sm font-semibold text-slate-700">{model.version || 'v1.0.0'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Up Time</p>
                                                <p className="text-sm font-semibold text-slate-700">{model.last_trained || 'Just now'}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-6 border-t border-slate-100 text-center">
                                            <p className="text-sm text-slate-400 italic">Engine offline</p>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
