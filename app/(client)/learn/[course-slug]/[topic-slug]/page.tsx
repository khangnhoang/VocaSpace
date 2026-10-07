import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";
import { SIGN_IN_REQUIRED_LOGIN_PATH } from "@/lib/auth/sign-in-reason";
import LearningWorkspace from "./_components/LearningWorkspace";
import LearningWorkspaceFeedback from "./_components/LearningWorkspaceFeedback";

type PageProps = {
  params: Promise<{ "course-slug": string; "topic-slug": string }>;
};

// Metadata và page dùng chung một lần đọc trong cùng request.
const getCachedLearningWorkspace = cache(getLearningWorkspace);

// Chỉ xử lý `not_found` để title lấy từ app/not-found.tsx (F1 AC5); mọi trường hợp khác giữ title của layout learn.
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const result = await getCachedLearningWorkspace(params["course-slug"], params["topic-slug"]);
  if (result.status === "not_found") notFound();
  return {};
}

export default async function LearningWorkspacePage(props: PageProps) {
  const params = await props.params;
  const result = await getCachedLearningWorkspace(
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
