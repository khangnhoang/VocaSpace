import CourseStructureWorkspace from "../_components/CourseStructureWorkspace";
import CourseStructureRouteFeedback from "../_components/CourseStructureRouteFeedback";

export default async function CourseStructurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  return (
    <>
      <CourseStructureRouteFeedback />
      <CourseStructureWorkspace courseId={resolvedParams.id} />
    </>
  );
}
