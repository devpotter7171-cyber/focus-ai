"use client";

import { CourseGenerator } from "@/components/admin/CourseGenerator";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function AdminPage() {
  return (
    <DashboardLayout>
      <div className="py-12">
        <CourseGenerator />
      </div>
    </DashboardLayout>
  );
}
