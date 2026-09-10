import { apiFetch } from '@/lib/api';

export interface FeedbackData {
    user_id: string;
    subtopic_id?: string;
    is_confused: boolean;
    feedback_text?: string;
    recommended_arm?: string;
}

export const sendFeedback = async (data: FeedbackData) => {
    try {
        await apiFetch('/behavior/feedback', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return true;
    } catch (e) {
        console.error("Feedback submission failed", e);
        return false;
    }
};
