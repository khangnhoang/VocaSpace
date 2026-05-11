import { HardHat } from "lucide-react";

export default function CoursesPlaceholder() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
        <HardHat size={48} className="text-emerald-600" />
      </div>
      <h3 className="mb-2 text-xl font-bold text-slate-800">
        Tính năng đang xây dựng
      </h3>
      <p className="max-w-sm text-sm leading-relaxed text-slate-500">
        Hệ thống theo dõi tiến độ khóa học và bài tập của bạn đang được chúng tôi hoàn thiện. Vui lòng quay lại sau nhé!
      </p>
    </div>
  );
}