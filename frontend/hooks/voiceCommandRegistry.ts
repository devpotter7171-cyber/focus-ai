"use client";

import { useEffect } from "react";

/**
 * Module-level registry that lets any component contribute extra voice
 * commands to the global <VoiceCommandButton> without prop drilling.
 *
 * Usage from a page/component:
 *
 *   useRegisterVoiceCommands(quizCommands);   // registers on mount, clears on unmount
 *
 * The `VoiceCommandButton` reads this registry via `getRegisteredCommands()`.
 */

export interface RegisteredVoiceCommand {
    keywords: string[];
    synonyms?: string[];
    antiKeywords?: string[];
    action: () => void;
    confirm?: string;
    description: string;
    example: string;
    category?: "Navigation" | "Reading" | "Scrolling" | "Quiz" | "Other";
}

type Listener = () => void;

const registry: Map<symbol, RegisteredVoiceCommand[]> = new Map();
const listeners: Set<Listener> = new Set();

function notify() {
    listeners.forEach((l) => l());
}

export function getRegisteredCommands(): RegisteredVoiceCommand[] {
    const all: RegisteredVoiceCommand[] = [];
    registry.forEach((cmds) => all.push(...cmds));
    return all;
}

export function subscribeRegistry(l: Listener): () => void {
    listeners.add(l);
    return () => { listeners.delete(l); };
}

/**
 * Hook: register a set of voice commands while this component is mounted.
 * Pass `null` / `undefined` to unregister.
 */
export function useRegisterVoiceCommands(commands: RegisteredVoiceCommand[] | null | undefined) {
    useEffect(() => {
        if (!commands || commands.length === 0) return;
        const key = Symbol("voice-commands");
        registry.set(key, commands);
        notify();
        return () => {
            registry.delete(key);
            notify();
        };
    }, [commands]);
}
