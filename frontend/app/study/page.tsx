"use client";

import { StudySession } from "@/components/learning/StudySession";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function StudyPage() {
  return (
    <DashboardLayout>
      <div className="py-8">
        <StudySession />
      </div>
    </DashboardLayout>
  );
}
