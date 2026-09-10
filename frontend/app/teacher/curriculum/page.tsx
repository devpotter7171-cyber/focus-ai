"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Faculty Curriculum page — redirects to the existing admin content editor.
 * In a future iteration this will be a dedicated faculty-scoped editor.
 */
export default function TeacherCurriculumPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/admin/content");
    }, [router]);
    return null;
}
