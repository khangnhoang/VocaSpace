import CourseStats from "./_components/course-stats";
import TeacherCollabGroup from "./_components/teacher-collab-group";
import SyllabusAccordion from "./_components/syllabus-accordion";
import StickyEnrollCard from "./_components/sticky-enroll-card";
import { getCourseDetail } from "@/app/actions/course-detail";
import Link from "next/link"; // Thêm để làm nút quay về khi lỗi

interface PageProps {
  params: Promise<{ "course-slug": string }>;
}

export default async function CourseDetailPage(props: PageProps) {
  // Await params theo chuẩn Next.js 15+ thay vì dùng React.use()
  const params = await props.params;
  const courseSlug = params["course-slug"];
  
  // Gọi API Server Action kéo dữ liệu thật
  const { data, error } = await getCourseDetail(courseSlug);

  // Xử lý Edge Case: Lỗi hoặc khóa học không tồn tại
  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-5xl">🚧</div>
          <h2 className="text-2xl font-bold text-slate-800">Ôi hỏng!</h2>
          <p className="text-slate-500 font-medium">{error || "Khóa học không tồn tại hoặc đã bị gỡ."}</p>
          <Link 
            href="/learn" 
            className="inline-block mt-4 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-md hover:bg-slate-800 transition-all"
          >
            Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    );
  }

  // Render UI chính thức với dữ liệu thật
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      <div className="max-w-7xl mx-auto px-4 pt-6 md:pt-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs md:text-sm text-slate-500 mb-6 font-medium">
          <Link href="/" className="hover:text-emerald-600 transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <Link href="/learn" className="hover:text-emerald-600 transition-colors">
            Khóa học
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-semibold truncate max-w-45 sm:max-w-xs">
            {data.title}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* CỘT TRÁI (65% - 70%) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Hero Header */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {data.badges?.map((badge, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-bold tracking-wider uppercase bg-slate-900 text-white px-2.5 py-0.5 rounded-md shadow-sm"
                  >
                    {badge}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight">
                {data.title}
              </h1>
              {data.description && (
                <p className="text-sm md:text-base text-slate-500 font-medium leading-relaxed max-w-3xl whitespace-pre-wrap">
                  {data.description}
                </p>
              )}
            </div>

            {/* Các Component Con (Data truyền vào hoàn toàn tương thích nhờ DTO) */}
            <CourseStats stats={data.stats} />
            
            <TeacherCollabGroup
              owner={data.owner}
              collaborators={data.collaborators}
            />

            <SyllabusAccordion syllabus={data.syllabus} />
          </div>

          {/* CỘT PHẢI (30% - 35%) */}
          <div className="lg:col-span-1">
            <StickyEnrollCard
              courseId={data.id}
              price={data.price}
              original_price={data.original_price}
              thumbnail_url={data.thumbnail_url}
              is_enrolled={data.is_enrolled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}