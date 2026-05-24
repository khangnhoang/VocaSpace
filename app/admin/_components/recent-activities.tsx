import { Trophy, CheckCircle2, Clock } from "lucide-react";

interface TopCourse {
  id: string;
  title: string;
  enrollmentCount: number;
  revenue: number;
}

interface RecentEnrollment {
  id: string;
  studentName: string | null;
  studentEmail: string;
  studentAvatar: string | null;
  courseTitle: string;
  price: number;
  enrolledAt: string;
}

interface RecentActivitiesProps {
  topCourses: TopCourse[];
  enrollments: RecentEnrollment[];
}

export default function RecentActivities({
  topCourses,
  enrollments,
}: RecentActivitiesProps) {
  // Tìm khóa học có lượng học viên cao nhất để làm mốc 100% cho thanh Progress Bar
  const maxEnrollment = Math.max(...topCourses.map((c) => c.enrollmentCount));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. BÊN TRÁI: BẢNG XẾP HẠNG KHÓA HỌC (HORIZONTAL BAR CHART) */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-slate-400 tracking-wide">
            Top 5 Khóa học phổ biến nhất
          </h3>
          <Trophy size={18} className="text-amber-400" />
        </div>

        <div className="space-y-6 flex-1">
          {topCourses.map((course, index) => {
            // Tính toán % chiều dài của thanh Bar
            const percentage = Math.round(
              (course.enrollmentCount / maxEnrollment) * 100,
            );

            return (
              <div key={course.id} className="relative group">
                {/* Thông tin Text nằm trên thanh Bar */}
                <div className="flex justify-between items-end mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 w-4">
                      {index + 1}.
                    </span>
                    <span className="text-sm font-medium text-white line-clamp-1 pr-4">
                      {course.title}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-300 shrink-0">
                    {course.enrollmentCount.toLocaleString()}{" "}
                    <span className="font-normal text-slate-500">học viên</span>
                  </span>
                </div>

                {/* Thanh Cột ngang (Bar) */}
                <div className="h-2 w-full bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-1000 ease-out relative"
                    style={{ width: `${percentage}%` }}
                  >
                    {/* Hiệu ứng sáng lướt qua khi hover */}
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. BÊN PHẢI: FEED HOẠT ĐỘNG / GIAO DỊCH GẦN ĐÂY */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-slate-400 tracking-wide">
            Ghi danh mới nhất
          </h3>
          <button className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors">
            Xem tất cả
          </button>
        </div>

        <div className="space-y-3 flex-1">
          {enrollments.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-700/30 transition-colors border border-transparent hover:border-slate-700/50 group cursor-pointer"
            >
              {/* Cột 1 & 2: Avatar, Tên Học viên, Tên Khóa học */}
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-10 w-10 rounded-full bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-400 border border-slate-600 shadow-inner">
                  {record.studentAvatar ? (
                    <img
                      src={record.studentAvatar}
                      alt={record.studentName || ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // Fallback UX khi thiếu ảnh
                    record.studentName?.charAt(0) || "U"
                  )}
                </div>
                <div className="truncate pr-4">
                  <h4 className="text-sm font-bold text-white truncate">
                    {record.studentName || "Học viên ẩn danh"}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {record.courseTitle}
                  </p>
                </div>
              </div>

              {/* Cột 3 & 4: Giá tiền, Trạng thái và Thời gian */}
              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <span className="text-sm font-bold text-white">
                    {record.price === 0
                      ? "Miễn phí"
                      : `${record.price.toLocaleString()}đ`}
                  </span>
                  <CheckCircle2 size={14} className="text-emerald-400" />
                </div>
                <span className="text-[10px] font-medium text-slate-500 flex items-center justify-end gap-1 group-hover:text-slate-400 transition-colors">
                  <Clock size={10} /> {record.enrolledAt}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
