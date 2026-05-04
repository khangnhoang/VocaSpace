// app/(client)/learn/[course-slug]/[topic-slug]/page.tsx
import { getCourseSyllabus } from "@/app/actions/learn";
import LearningWorkspace from "./_components/LearningWorkspace";

export default async function CourseDetailPage(props: {
  params: Promise<{ "course-slug": string; "topic-slug": string }>;
}) {
  const params = await props.params;
  const courseSlug = params["course-slug"];
  const topicSlug = params["topic-slug"];

  // Lấy dữ liệu cấu trúc khóa học từ Backend
  const res = await getCourseSyllabus(courseSlug);

  // Xử lý lỗi nếu khóa học không tồn tại
  if (res.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <h1 className="text-2xl font-bold text-rose-500">{res.error}</h1>
      </div>
    );
  }

  // Render Workspace và truyền dữ liệu vào
  return (
    <LearningWorkspace 
      courseTitle={res.courseTitle || "Đang tải..."} 
      syllabus={res.syllabus || []} 
    />
  );
}