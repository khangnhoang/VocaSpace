import CourseStructureWorkspace from "../_components/CourseStructureWorkspace";
import CourseStructureRouteFeedback from "../_components/CourseStructureRouteFeedback";
import { parseCourseStructureIssueFeedback } from "@/lib/course-authoring/issue-context";

export default async function CourseStructurePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const initialIssueFeedback = parseCourseStructureIssueFeedback(
    toUrlSearchParams(resolvedSearchParams),
  );

  return (
    <>
      <CourseStructureRouteFeedback />
      <CourseStructureWorkspace
        courseId={resolvedParams.id}
        initialIssueFeedback={initialIssueFeedback}
      />
    </>
  );
}

function toUrlSearchParams(
  rawParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(rawParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
      continue;
    }

    if (value != null) params.set(key, value);
  }

  return params;
}
