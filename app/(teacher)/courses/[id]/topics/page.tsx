import { redirect } from "next/navigation";
import { getCourseStructurePath } from "../_components/topic-builder-path";

export default async function TopicsIndexRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  redirect(getCourseStructurePath(resolvedParams.id));
}
