"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Faculty ML Monitor — redirects to the existing admin ML monitor.
 */
export default function TeacherMLMonitorPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/admin/ml-monitor");
    }, [router]);
    return null;
}
