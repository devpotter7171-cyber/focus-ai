"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Faculty Experiments — redirects to the existing admin experiment page.
 */
export default function TeacherExperimentsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/admin/experiment");
    }, [router]);
    return null;
}
