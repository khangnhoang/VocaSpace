import CourseStructureWorkspace from "../_components/CourseStructureWorkspace";

export default async function CourseStructurePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ topic_unavailable?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <CourseStructureWorkspace
      courseId={resolvedParams.id}
      initialNotice={
        resolvedSearchParams.topic_unavailable === "1"
          ? "topic-unavailable"
          : undefined
      }
    />
  );
}
