import { use } from "react";
import CourseStats from "./_components/course-stats";
import TeacherCollabGroup from "./_components/teacher-collab-group";
import SyllabusAccordion from "./_components/syllabus-accordion";
import StickyEnrollCard from "./_components/sticky-enroll-card";
import { CourseDetailDTO } from "@/lib/schemas/course-detail";

// 1. KHỞI TẠO MOCK DATA CHUẨN KHẮT KHE THEO COURSE_DETAIL_DTO
const mockCourseDetailData: CourseDetailDTO = {
  id: "course-toeic-750",
  title: "Chinh phục Đột phá TOEIC Luyện nghe 750+ Cùng VocaSpace",
  slug: "chinh-phuc-dot-pha-toeic-750",
  description:
    "Khóa học tập trung giải mã chuyên sâu phương pháp xử lý bẫy Part 1-4, tối ưu hóa điểm số nghe hiểu tối đa chỉ sau 30 ngày luyện tập thực tế.",
  thumbnail_url:
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=60",
  price: 299000,
  original_price: 599000,
  badges: ["Best Seller", "Mới"],
  is_enrolled: false,
  stats: {
    total_chapters: 4,
    total_topics: 12,
    total_cards: 240,
    total_exercises: 45,
    total_enrollments: 1420,
  },
  owner: {
    id: "teacher-xiu-do",
    full_name: "Đỗ Nguyễn Xiêu",
    // Thay null bằng link ảnh thật (VD: ảnh chân dung xịn xò)
    avatar_url: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&h=150&fit=crop&q=80",
    bio: "Chuyên gia huấn luyện cấu trúc đề thi TOEIC thế hệ mới, Cựu kỹ sư giải pháp phần mềm giáo dục trực tuyến.",
    experience_years: 5,
    certifications: "TOEIC 945 | TESOL Quốc tế",
  },
  collaborators: [
    {
      id: "collab-1",
      full_name: "Trần Minh Hoàng",
      avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&q=80",
      bio: "Giảng viên thỉnh giảng ngôn ngữ Anh",
      experience_years: 3,
      certifications: "IELTS 8.0",
    },
    {
      id: "collab-2",
      full_name: "Lê Thị Hồng",
      avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&q=80",
      bio: "Trợ lý học thuật nội dung",
      experience_years: 2,
      certifications: "TOEIC 850",
    },
  ],
  syllabus: [
    {
      id: "chap-1",
      title: "Chương 1: Khởi động - Giải mã ngữ âm nền tảng",
      order_index: 1,
      topics: [
        {
          id: "topic-1-1",
          title: "1.1 Giới thiệu từ vựng cốt lõi thường gặp",
          slug: "tu-vung-cot-loi",
          status: "published",
          topic_type: "vocabulary",
          is_free_preview: true,
          order_index: 1,
        },
        {
          id: "topic-1-2",
          title: "1.2 Cách phát âm chuẩn IPA tránh bẫy nuốt âm",
          slug: "phat-am-ipa",
          status: "published",
          topic_type: "video",
          is_free_preview: true,
          order_index: 2,
        },
        {
          id: "topic-1-3",
          title: "1.3 Bài tập thực hành phản xạ nghe âm đôi",
          slug: "thuc-hanh-phan-xa",
          status: "published",
          topic_type: "exercise",
          is_free_preview: false,
          order_index: 3,
        },
      ],
    },
    {
      id: "chap-2",
      title: "Chương 2: Vượt chướng ngại vật - Chinh phục Part 1 & Part 2",
      order_index: 2,
      topics: [
        {
          id: "topic-2-1",
          title: "2.1 Bẫy mô tả tranh vật và tranh người phổ biến",
          slug: "bay-mo-ta-tranh",
          status: "published",
          topic_type: "video",
          is_free_preview: false,
          order_index: 1,
        },
        {
          id: "topic-2-2",
          title: "2.2 Từ vựng hành động chủ đề công sở văn phòng",
          slug: "tu-vung-cong-so",
          status: "published",
          topic_type: "vocabulary",
          is_free_preview: false,
          order_index: 2,
        },
      ],
    },
  ],
};

interface PageProps {
  params: Promise<{ "course-slug": string }>;
}

export default function CourseDetailPage(props: PageProps) {
  const params = use(props.params);
  const courseSlug = params["course-slug"];
  const data = mockCourseDetailData;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      {/* Container chung quy chuẩn ép lề thở 2 bên */}
      <div className="max-w-7xl mx-auto px-4 pt-6 md:pt-10">
        {/* Breadcrumb điều hướng phân cấp chuẩn UX */}
        <nav className="flex items-center gap-2 text-xs md:text-sm text-slate-500 mb-6 font-medium">
          <span className="hover:text-emerald-600 cursor-pointer">
            Trang chủ
          </span>
          <span>/</span>
          <span className="hover:text-emerald-600 cursor-pointer">
            Khóa học
          </span>
          <span>/</span>
          <span className="text-slate-800 font-semibold truncate max-w-[180px] sm:max-w-xs">
            {data.title}
          </span>
        </nav>

        {/* LƯỚI BỐ CỤC 2 CỘT BẤT ĐỐI XỨNG (Grid 3 cột: Trái chiếm 2, Phải chiếm 1) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* CỘT TRÁI (65% - 70%): TRỌNG TÂM THÔNG TIN */}
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
              <p className="text-sm md:text-base text-slate-500 font-medium leading-relaxed max-w-3xl">
                {data.description}
              </p>
            </div>

            {/* Thống kê quy mô khóa học */}
            <CourseStats stats={data.stats} />

            {/* Đội ngũ giảng viên */}
            <TeacherCollabGroup
              owner={data.owner}
              collaborators={data.collaborators}
            />

            {/* Đề cương Syllabus Accordion */}
            <SyllabusAccordion syllabus={data.syllabus} />
          </div>

          {/* CỘT PHẢI (30% - 35%): KHUNG NỔI ĐĂNG KÝ STICKY */}
          <div className="lg:col-span-1">
            <StickyEnrollCard
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
