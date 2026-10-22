import { Loader2 } from "lucide-react";

export default function TeacherCoursesLoading() {
  return <div className="min-h-screen bg-slate-50 p-6 text-slate-900 sm:p-12"><div className="mx-auto max-w-310"><h1 className="text-3xl font-extrabold">Khóa học của tôi</h1><p role="status" className="mt-8 flex items-center gap-3 text-sm text-slate-600"><Loader2 className="motion-safe:animate-spin" aria-hidden="true" />Đang tải khóa học và việc cần xử lý…</p></div></div>;
}
