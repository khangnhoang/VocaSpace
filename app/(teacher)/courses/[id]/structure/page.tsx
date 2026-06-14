import CourseStructureWorkspace from "../_components/CourseStructureWorkspace";

export default async function CourseStructurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  return <CourseStructureWorkspace courseId={resolvedParams.id} />;
}
