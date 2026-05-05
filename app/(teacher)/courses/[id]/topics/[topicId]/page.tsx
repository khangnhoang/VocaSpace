import BackButton from "./_components/BackButton"; // Import nút vừa tạo
import TopicBuilderTabs from "./_components/TopicBuilderTabs";

export default async function TopicBuilderPage({
  params,
}: {
  params: Promise<{ id: string; topicId: string }>;
}) {
  const resolvedParams = await params;

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        {/* Thay thế thẻ <Link> bằng Client Component này */}
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Topic Builder</h1>
          <p className="text-xs text-slate-500 font-medium">
            Quản lý nội dung bài học
          </p>
        </div>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <TopicBuilderTabs topicId={resolvedParams.topicId} />
        </div>
      </div>
    </div>
  );
}