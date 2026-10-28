import { redirect } from "next/navigation";
import { getTopicWorkflow } from "@/app/actions/topic";
import { getTopicReviewNotes } from "@/app/actions/review-notes";
import { getCourseStructurePath } from "@/lib/course-authoring/routes";
import {
  getCourseStructureIssueUnavailablePath,
  parseCourseAuthoringIssueDestination,
} from "@/lib/course-authoring/issue-context";
import TopicBuilderTabs from "./_components/TopicBuilderTabs";
import { TopicReviewNotesProvider } from "./_components/TopicReviewNotes";

export default async function TopicBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; topicId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const initialSearchParams = toUrlSearchParams(resolvedSearchParams);
  const initialSearch = initialSearchParams.toString();
  const issueDestinationState =
    parseCourseAuthoringIssueDestination(initialSearchParams);
  const workflow = await getTopicWorkflow({
    courseId: resolvedParams.id,
    topicId: resolvedParams.topicId,
  });
  // Đường đọc ghi chú tách khỏi DTO vòng đời topic: RLS là nơi ép quyền, nên
  // action chỉ trả về đúng những gì policy `select` cho phép.
  const reviewNotes = await getTopicReviewNotes({
    topicId: resolvedParams.topicId,
  });

  if ("error" in workflow) {
    if (workflow.reason === "forbidden") {
      redirect("/");
    }
    if (workflow.reason === "unavailable") {
      redirect(`${getCourseStructurePath(resolvedParams.id)}?topic_unavailable=1`);
    }
    throw new Error(workflow.error);
  }

  const parentChapterId = workflow.data.chapterId;

  if (issueDestinationState.kind === "invalid_context") {
    // URL dashboard hỏng được xử lý ở server trước khi render tab,
    // để màn topic không nháy một target sai rồi mới tự chuyển hướng.
    redirect(
      getCourseStructureIssueUnavailablePath(
        resolvedParams.id,
        parentChapterId,
      ),
    );
  }

  if (
    (issueDestinationState.kind === "valid" ||
      issueDestinationState.kind === "invalid_tab") &&
    issueDestinationState.context.issue === "topic_has_no_learning_content" &&
    issueDestinationState.context.target !== resolvedParams.topicId
  ) {
    // Vấn đề cấp topic phải trỏ đúng topic hiện tại; sai topic được coi là target cũ.
    redirect(
      getCourseStructureIssueUnavailablePath(
        resolvedParams.id,
        parentChapterId,
      ),
    );
  }

  const notesPayload = "error" in reviewNotes ? null : reviewNotes.data;

  return (
    // Header (tên bài học, vòng đời, đường quay về chương) nằm trong TopicWorkflowPanel để
    // mọi hành động vòng đời đi qua cùng guard thay đổi chưa lưu với editor.
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto w-full max-w-[90rem] px-4 py-5 sm:px-6 lg:py-6">
          <TopicReviewNotesProvider
            topicId={resolvedParams.topicId}
            notes={notesPayload?.notes ?? null}
            readError={"error" in reviewNotes ? reviewNotes.error : null}
            currentUserId={notesPayload?.currentUserId ?? ""}
            canRead={
              notesPayload !== null &&
              (workflow.data.canReview ||
                workflow.data.isCurrentUserResponsible ||
                workflow.data.isCurrentUserContributor ||
                workflow.data.originalCreator.userId === notesPayload.currentUserId)
            }
            canReview={workflow.data.canReview}
          >
            <TopicBuilderTabs
              courseId={resolvedParams.id}
              topicId={resolvedParams.topicId}
              parentChapterId={parentChapterId}
              initialSearch={initialSearch}
              workflow={workflow.data}
            />
          </TopicReviewNotesProvider>
      </div>
    </div>
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
