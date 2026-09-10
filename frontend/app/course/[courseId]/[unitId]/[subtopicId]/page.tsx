import CoursePlayer from '@/components/CoursePlayer';

export default async function Page(props: { params: Promise<{ courseId: string, unitId: string, subtopicId: string }> }) {
    const params = await props.params;
    return (
        <CoursePlayer
            courseId={params.courseId}
            unitId={params.unitId}
            subtopicId={params.subtopicId}
        />
    );
}
