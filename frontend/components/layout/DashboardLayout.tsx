"use client";

import React from "react";
import { NeuralSidebar as Sidebar } from "@/components/neural/Sidebar";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

/**
 * DashboardLayout — shared shell for authenticated app pages
 * (admin, study, settings, etc.). Wraps the neural sidebar and a
 * scrollable main column.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <div className="flex h-screen w-full bg-[#f2f4f6] text-slate-800 font-sans overflow-hidden">
            <Sidebar className="hidden md:flex flex-shrink-0" />
            <main className="flex-1 flex flex-col p-8 md:pl-60 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}

export default DashboardLayout;
