import Image from "next/image";
import { formatRelativeTime } from "@/lib/admin/dashboard-format";
import type { AdminDashboardDTO } from "@/lib/schemas/admin-dashboard";

type RecentEnrollmentsProps = {
  enrollments: AdminDashboardDTO["recentEnrollments"];
  // Mốc thời gian của database: thời gian tương đối tính từ đây nên không đổi giữa server và client.
  generatedAt: string;
};

function initialOf(name: string) {
  return Array.from(name.trim())[0]?.toUpperCase() ?? "?";
}

// Chỉ ảnh có URL tuyệt đối mới đi qua next/image; đường dẫn khác rơi về chữ cái đầu thay vì làm hỏng cả danh sách.
function isImageUrl(value: string | null): value is string {
  return value !== null && /^https?:\/\//.test(value);
}

// Năm lượt ghi danh mới nhất: tên, email (chỉ khi có), khóa học và thời gian; không có cột giá (AC8).
export function RecentEnrollments({ enrollments, generatedAt }: RecentEnrollmentsProps) {
  return (
    <section
      aria-labelledby="admin-recent-enrollments-heading"
      className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-slate-700 bg-[#111827] p-4 sm:p-6"
    >
      <div className="space-y-1">
        <h2 id="admin-recent-enrollments-heading" className="text-lg leading-[26px] font-bold text-slate-50">
          Ghi danh mới nhất
        </h2>
        <p className="text-sm leading-[22px] text-slate-300">Năm lượt ghi danh gần đây nhất trên toàn hệ thống.</p>
      </div>
      {enrollments.length === 0 ? (
        <p className="text-sm text-slate-300">Chưa có lượt ghi danh nào.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-700">
          {enrollments.map((enrollment) => (
            <li key={enrollment.id} className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[40px_minmax(0,1fr)_auto]">
              <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#172554] text-sm font-bold text-[#60A5FA] ring-2 ring-[#60A5FA]">
                {isImageUrl(enrollment.studentAvatar) ? (
                  <Image src={enrollment.studentAvatar} alt="" fill sizes="40px" unoptimized className="object-cover" />
                ) : (
                  <span aria-hidden="true">{initialOf(enrollment.studentName)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm leading-[22px] font-bold break-words text-slate-50">{enrollment.studentName}</p>
                {enrollment.studentEmail ? (
                  <p className="text-xs leading-4 font-medium break-all text-slate-300">{enrollment.studentEmail}</p>
                ) : null}
                <p className="mt-1 text-sm leading-[22px] break-words text-slate-300">{enrollment.courseTitle}</p>
              </div>
              <time dateTime={enrollment.enrolledAt} className="col-start-2 text-xs leading-4 font-medium text-slate-400 sm:col-start-3 sm:row-start-1">
                {formatRelativeTime(enrollment.enrolledAt, generatedAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
