"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface BehaviorData {
    user_id: string;
    session_id: string;
    question_id?: string;
    screen?: string;
    time_on_question_ms: number;
    hesitation_ms: number;
    tab_switches: number;
    scroll_depth_pct: number;
    attempts: number;
    hint_requests: number;
    wrong_option_hover_count: number;
    mouse_path_length_px: number;
    avg_mouse_velocity_px_ms: number;
    timestamp: string;
}

interface UseBehaviorOptions {
    userId: string;
    contextId: string;
    questionId?: string;
    onConfusion?: (score: number) => void;
    /**
     * Master switch — when false, all listeners and timers stay detached.
     * Used to scope behaviour tracking to the quiz only.
     * Defaults to true for backwards compatibility.
     */
    enabled?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export function useBehavior({ userId, contextId, questionId, onConfusion, enabled = true }: UseBehaviorOptions) {
    const startTime = useRef(0);

    // Initialize start time on mount
    useEffect(() => {
        startTime.current = Date.now();
    }, []);
    const firstInteractionTime = useRef<number | null>(null);
    const scrollDepth = useRef(0);
    const tabSwitches = useRef(0);
    const attempts = useRef(0);
    const hintRequests = useRef(0);
    const wrongOptionHoverCount = useRef(0);

    // Mouse Tracking Steps
    const mousePathLength = useRef(0);
    const lastMousePos = useRef<{ x: number, y: number } | null>(null);
    const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    const eventQueue = useRef<BehaviorData[]>([]);
    const [isTracking, setIsTracking] = useState(enabled);

    // Keep the tracking flag aligned with the prop so callers can flip enabled
    // mid-session (e.g. when the quiz dialog opens / closes).
    useEffect(() => {
        setIsTracking(enabled);
        if (enabled) {
            // Reset timing baseline when (re-)enabled so we don't carry stale ms
            startTime.current = Date.now();
            firstInteractionTime.current = null;
        }
    }, [enabled]);

    // Track scroll depth
    useEffect(() => {
        if (!isTracking) return;

        const handleScroll = () => {
            const scrollPct = Math.min(
                100,
                ((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100
            );
            if (scrollPct > scrollDepth.current) {
                scrollDepth.current = scrollPct;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isTracking]);

    // Track tab switches
    useEffect(() => {
        if (!isTracking) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                tabSwitches.current += 1;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isTracking]);

    // Track first interaction (hesitation)
    useEffect(() => {
        if (!isTracking) return;

        const handleFirstInteraction = () => {
            if (firstInteractionTime.current === null) {
                firstInteractionTime.current = Date.now();
            }
        };

        const events = ['keydown', 'mousedown', 'touchstart'];
        events.forEach(event => {
            document.addEventListener(event, handleFirstInteraction, { once: true });
        });

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, handleFirstInteraction);
            });
        };
    }, [isTracking]);

    // Track Mouse Path (Agitation Metric)
    useEffect(() => {
        if (!isTracking) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (lastMousePos.current) {
                const dx = e.clientX - lastMousePos.current.x;
                const dy = e.clientY - lastMousePos.current.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                mousePathLength.current += dist;
            }
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        };

        // Use passive listener for performance
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isTracking]);

    // Record an attempt
    const recordAttempt = useCallback(() => {
        attempts.current += 1;
    }, []);

    // Record hint request
    const recordHintRequest = useCallback(() => {
        hintRequests.current += 1;
    }, []);

    // Record wrong option hover
    const recordWrongOptionHover = useCallback(() => {
        wrongOptionHoverCount.current += 1;
    }, []);

    // Get current behavior data
    const getBehaviorData = useCallback((): BehaviorData => {
        const now = Date.now();
        const timeOnQuestion = now - startTime.current;
        const hesitationMs = firstInteractionTime.current
            ? firstInteractionTime.current - startTime.current
            : timeOnQuestion;

        const avgVelocity = timeOnQuestion > 0 ? (mousePathLength.current / timeOnQuestion) : 0;

        return {
            user_id: userId,
            session_id: sessionId,
            question_id: questionId,
            screen: contextId,
            time_on_question_ms: timeOnQuestion,
            hesitation_ms: hesitationMs,
            tab_switches: tabSwitches.current,
            scroll_depth_pct: Math.round(scrollDepth.current),
            attempts: attempts.current,
            hint_requests: hintRequests.current,
            wrong_option_hover_count: wrongOptionHoverCount.current,
            mouse_path_length_px: Math.round(mousePathLength.current),
            avg_mouse_velocity_px_ms: parseFloat(avgVelocity.toFixed(4)),
            timestamp: new Date().toISOString(),
        };
    }, [userId, contextId, questionId, sessionId]);

    // Send behavior data to server
    const sendBehaviorData = useCallback(async (data: BehaviorData) => {
        try {
            const result = await apiFetch<{ confusion_score?: number; confusion?: { confusion_score?: number } }>(
                '/behavior',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: data.user_id,
                        event_type: 'behavior_snapshot',
                        data: {
                            session_id: data.session_id,
                            question_id: data.question_id,
                            screen: data.screen,
                            time_ms: data.time_on_question_ms,
                            hesitation_ms: data.hesitation_ms,
                            tab_switches: data.tab_switches,
                            scroll_depth: data.scroll_depth_pct,
                            attempts: data.attempts,
                            hint_requests: data.hint_requests,
                            wrong_option_hover_count: data.wrong_option_hover_count,
                            mouse_path: data.mouse_path_length_px,
                            mouse_velocity: data.avg_mouse_velocity_px_ms,
                        },
                        timestamp: data.timestamp,
                    }),
                }
            );

            const score = result?.confusion?.confusion_score ?? result?.confusion_score;
            if (typeof score === 'number' && onConfusion) {
                onConfusion(score);
            }
        } catch (error) {
            // Queue for retry
            eventQueue.current.push(data);
            console.warn('Behavior tracking failed, queued for retry:', error);
        }
    }, [onConfusion]);

    // Flush behavior data
    const flush = useCallback(() => {
        const data = getBehaviorData();
        sendBehaviorData(data);
    }, [getBehaviorData, sendBehaviorData]);

    // Reset for new question
    const reset = useCallback(() => {
        startTime.current = Date.now();
        firstInteractionTime.current = null;
        scrollDepth.current = 0;
        tabSwitches.current = 0;
        attempts.current = 0;
        hintRequests.current = 0;
        wrongOptionHoverCount.current = 0;
        mousePathLength.current = 0;
        lastMousePos.current = null;
    }, []);

    // Stop tracking
    const stopTracking = useCallback(() => {
        setIsTracking(false);
        flush();
    }, [flush]);

    // Resume tracking
    const startTracking = useCallback(() => {
        reset();
        setIsTracking(true);
    }, [reset]);

    // Send data on unmount (only if there was active tracking on this mount)
    useEffect(() => {
        return () => {
            if (!isTracking) return;
            const data = getBehaviorData();
            // Use sendBeacon for reliable delivery on unmount; auth header is
            // not strictly required for the /behavior route (see main.py).
            navigator.sendBeacon(
                `${API_URL}/behavior`,
                JSON.stringify({
                    user_id: data.user_id,
                    event_type: 'page_unload',
                    data: {
                        session_id: data.session_id,
                        time_ms: data.time_on_question_ms,
                        scroll_depth: data.scroll_depth_pct,
                        tab_switches: data.tab_switches,
                    },
                    timestamp: new Date().toISOString(),
                })
            );
        };
    }, [getBehaviorData, isTracking]);

    // Retry queued events periodically, but only while tracking is active.
    useEffect(() => {
        if (!isTracking) return;
        const retryInterval = setInterval(() => {
            if (eventQueue.current.length > 0) {
                const event = eventQueue.current.shift();
                if (event) {
                    sendBehaviorData(event);
                }
            }
        }, 15000);

        return () => clearInterval(retryInterval);
    }, [sendBehaviorData, isTracking]);

    return {
        sessionId: sessionId,
        recordAttempt,
        recordHintRequest,
        recordWrongOptionHover,
        getBehaviorData,
        flush,
        reset,
        stopTracking,
        startTracking,
        isTracking,
    };
}

// Simple version for basic page tracking
export function useSimpleBehavior(userId: string, contextId: string) {
    const startTime = useRef(0);

    useEffect(() => {
        startTime.current = Date.now();
    }, []);
    const scrollDepth = useRef(0);
    const tabSwitches = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            const scrollPct = (window.scrollY + window.innerHeight) / document.body.scrollHeight;
            if (scrollPct > scrollDepth.current) {
                scrollDepth.current = scrollPct;
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                tabSwitches.current += 1;
            }
        };

        window.addEventListener('scroll', handleScroll);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            document.removeEventListener('visibilitychange', handleVisibilityChange);

            // Log on unmount
            // Log on unmount
            const timeOnPage = Date.now() - startTime.current;
            const payload = {
                user_id: userId,
                event_type: "page_view",
                data: {
                    context_id: contextId,
                    time_ms: timeOnPage,
                    scroll_depth: scrollDepth.current,
                    tab_switches: tabSwitches.current
                },
                timestamp: new Date().toISOString()
            };

            navigator.sendBeacon(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/behavior`,
                JSON.stringify(payload)
            );
        };
    }, [userId, contextId]);
}
