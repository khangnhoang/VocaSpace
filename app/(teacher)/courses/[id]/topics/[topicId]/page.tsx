import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import TopicBuilderTabs from "./_components/TopicBuilderTabs";

// ĐÃ FIX 1: Thêm chữ 'async' vào trước function
// ĐÃ FIX 2: Bọc Type của params lại bằng Promise<>
export default async function TopicBuilderPage({
  params,
}: {
  params: Promise<{ id: string; topicId: string }>;
}) {
  // ĐÃ FIX 3: Dùng await để "mở khóa" params trước khi render giao diện
  const resolvedParams = await params;

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Topbar điều hướng ngược lại danh sách chương */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link
          // ĐÃ FIX 4: Thay params.id thành resolvedParams.id
          href={`/courses/${resolvedParams.id}`}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Topic Builder</h1>
          <p className="text-xs text-slate-500 font-medium">
            Quản lý nội dung bài học
          </p>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <TopicBuilderTabs />
        </div>
      </div>
    </div>
  );
}
