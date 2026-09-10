// Common types used across the frontend

export interface Question {
    id: string;
    text: string;
    options: string[];
    correctAnswer: string | number;
    difficulty?: string;
    skill_tags?: string[];
}

export interface Course {
    id: string;
    title: string;
    description: string;
    units?: Unit[];
}

export interface Unit {
    id: string;
    title: string;
    order: number;
    subtopics?: Subtopic[];
}

export interface Subtopic {
    id: string;
    title: string;
    content: string;
    textbook_reference?: string;
}

export interface User {
    id: string;
    email: string;
    role: 'student' | 'teacher' | 'admin';
    profile_segment?: string;
}

export interface BehaviorEvent {
    user_id: string;
    session_id: string;
    event_type: string;
    data: {
        time_ms?: number;
        tab_switches?: number;
        scroll_depth?: number;
        hesitation_ms?: number;
        question_id?: string;
    };
    timestamp: string;
}

export interface ConfusionScore {
    confusion_score: number;
    is_confused: boolean;
    confidence: number;
}

export interface Recommendation {
    explanation_type: 'visual' | 'step' | 'example' | 'analogy' | 'easier' | 'harder';
    arm_id: number;
    reason: string;
    next_question_id?: string;
}

export interface MasteryData {
    mastery_by_skill: Record<string, number>;
    weak_skills: string[];
    overall_mastery: number;
}

export interface DashboardData {
    total_students: number;
    active_students: number;
    confused_students?: number;
    avg_confusion?: number;
    avg_mastery?: number;
    active_sessions?: number;
    active_experiments?: number;
    students?: Array<{
        id: string;
        name: string;
        email: string;
        confusion_level: number;
        mastery: number;
        last_active: string;
    }>;
    student_stats?: Record<string, {
        id: string;
        name: string;
        mastery: number;
        total_events: number;
        confusion_events: number;
        last_active: string;
    }>;
    confusion_by_unit?: Record<string, number>;
    mastery_by_unit?: Record<string, number>;
    recent_logs?: Array<{
        user_id: string;
        event: string;
        time: string;
    }>;
    recent_interventions?: Array<{
        user_id: string;
        subtopic: string;
        confusion_score: number;
        bandit_arm_selected: string;
        timestamp: string;
    }>;
}



// ─── Classes / cohorts ──────────────────────────────────────────────────────

export interface ClassSummary {
    id: string;
    name: string;
    description: string;
    course_id?: string | null;
    owner_uid: string;
    owner_name?: string | null;
    join_code?: string | null;
    member_count: number;
    created_at?: string | null;
}

export interface ClassListResponse {
    role: 'student' | 'teacher' | 'admin';
    owned: ClassSummary[];
    joined: ClassSummary[];
}

export interface ClassDetail extends ClassSummary {
    is_owner: boolean;
    is_member: boolean;
}

export interface ClassStudent {
    user_id: string;
    email?: string | null;
    full_name: string;
    profile_segment?: string | null;
    joined_at?: string | null;
    overall_mastery: number;
    weak_skills: { skill: string; score: number }[];
}

export interface ClassRoster {
    class_id: string;
    name: string;
    students: ClassStudent[];
    count: number;
}
