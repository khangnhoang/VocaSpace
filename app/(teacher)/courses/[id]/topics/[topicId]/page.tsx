import { redirect } from "next/navigation";
import { verifyTopicAuthoringContext } from "@/app/actions/topic";
import { getCourseStructurePath } from "@/lib/course-authoring/routes";
import BackButton from "./_components/BackButton";
import TopicBuilderTabs from "./_components/TopicBuilderTabs";

export default async function TopicBuilderPage({
  params,
}: {
  params: Promise<{ id: string; topicId: string }>;
}) {
  const resolvedParams = await params;
  const context = await verifyTopicAuthoringContext({
    courseId: resolvedParams.id,
    topicId: resolvedParams.topicId,
  });

  if (!context.isValid) {
    if (context.reason === "forbidden") {
      redirect("/");
    }

    if (context.reason === "error") {
      throw new Error(context.error);
    }

    redirect(`${getCourseStructurePath(resolvedParams.id)}?topic_unavailable=1`);
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
          />
        </div>
      </div>
    </div>
  );
}
