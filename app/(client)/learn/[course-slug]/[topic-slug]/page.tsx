import { notFound, redirect } from "next/navigation";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";
import { SIGN_IN_REQUIRED_LOGIN_PATH } from "@/lib/auth/sign-in-reason";
import LearningWorkspace from "./_components/LearningWorkspace";
import LearningWorkspaceFeedback from "./_components/LearningWorkspaceFeedback";

export default async function LearningWorkspacePage(props: {
  params: Promise<{ "course-slug": string; "topic-slug": string }>;
}) {
  const params = await props.params;
  const result = await getLearningWorkspace(
    params["course-slug"],
    params["topic-slug"],
  );

  if (result.status === "auth_required") redirect(SIGN_IN_REQUIRED_LOGIN_PATH);
  if (result.status === "not_found") notFound();

  if (result.status !== "success") {
    return <LearningWorkspaceFeedback result={result} />;
  }

  return (
    <LearningWorkspace
      key={`${result.data.courseSlug}/${result.data.currentTopic.slug}`}
      data={result.data}
    />
  );
}
