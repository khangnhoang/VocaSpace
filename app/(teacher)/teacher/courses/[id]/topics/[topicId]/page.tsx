import { redirect } from "next/navigation";
import { getTopicWorkflow } from "@/app/actions/topic";
import { getCourseStructurePath } from "@/lib/course-authoring/routes";
import {
  getCourseStructureIssueUnavailablePath,
  parseCourseAuthoringIssueDestination,
} from "@/lib/course-authoring/issue-context";
import BackButton from "./_components/BackButton";
import TopicBuilderTabs from "./_components/TopicBuilderTabs";

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

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <BackButton courseId={resolvedParams.id} />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Topic Builder</h1>
          <p className="text-xs text-slate-500 font-medium">
            Quản lý nội dung bài học
          </p>
        </div>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <TopicBuilderTabs
            courseId={resolvedParams.id}
            topicId={resolvedParams.topicId}
            parentChapterId={parentChapterId}
            initialSearch={initialSearch}
            workflow={workflow.data}
          />
        </div>
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
