import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getCourseLearningSummary } from "@/app/actions/learning-activity";
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

  // Key theo dữ liệu thẻ: sau `router.refresh()` vì thẻ mới (LF3 AC6) workspace dựng lại state từ dữ liệu mới thay vì giữ hàng đợi cũ.
  // Không dùng nonce; trong một phiên học dữ liệu trang không đổi nên key không đổi và state không bị dựng lại.
  const { courseSlug, currentTopic, flashcards, unseenCardIds, unratedCardIds, dueCardIds } = result.data;
  const workspaceKey = [
    `${courseSlug}/${currentTopic.slug}`,
    flashcards.map((card) => card.id).join(","),
    unseenCardIds.join(","),
    unratedCardIds.join(","),
    dueCardIds.join(","),
  ].join("|");

  // Chuỗi ngày học của khóa cho header; lỗi không chặn không gian học (AC10).
  const learningSummary = await getCourseLearningSummary(result.data.courseId);

  return <LearningWorkspace key={workspaceKey} data={result.data} learningSummary={learningSummary} />;
}
