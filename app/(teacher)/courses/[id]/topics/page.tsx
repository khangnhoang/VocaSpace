import { redirect } from "next/navigation";
import { getCourseStructurePath } from "@/lib/course-authoring/routes";

export default async function TopicsIndexRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  redirect(getCourseStructurePath(resolvedParams.id));
}
