import type { LucideIcon } from "lucide-react";
import { BookOpen, Banknote, Layers, Users } from "lucide-react";
import { formatCount, formatVnd } from "@/lib/admin/dashboard-format";
import type { AdminDashboardDTO } from "@/lib/schemas/admin-dashboard";

type Metric = {
  id: string;
  label: string;
  value: string;
  basis: string;
  icon: LucideIcon;
  // Màu ô icon chỉ nói "đo cái gì", không nói trạng thái (Admin design mục 4.5).
  tile: "route" | "recall";
};

const tileClass = {
  route: "bg-[#172554] text-[#60A5FA]",
  recall: "bg-[#083344] text-[#22D3EE]",
} as const;

// Đường kẻ ngăn giữa các chỉ số: một cột (kẻ ngang), hai cột ở màn trung bình, bốn cột ở màn rộng.
const dividerClass = [
  "",
  "border-t sm:border-t-0 sm:border-l",
  "border-t sm:border-l-0 lg:border-t-0 lg:border-l",
  "border-t sm:border-l lg:border-t-0",
] as const;

// Một dải bốn chỉ số trong một panel, mỗi chỉ số kèm một dòng nêu cơ sở tính; không có chữ xu hướng hay so sánh kỳ trước (AC3, AC11).
export function MetricBand({ metrics }: { metrics: AdminDashboardDTO["metrics"] }) {
  const items: Metric[] = [
    {
      id: "revenue",
      label: "Doanh thu",
      value: formatVnd(metrics.revenue),
      basis: "Thanh toán thành công theo thời điểm tạo đơn, 6 tháng gần nhất",
      icon: Banknote,
      tile: "route",
    },
    {
      id: "students",
      label: "Học viên",
      value: formatCount(metrics.students),
      basis: "Tài khoản học viên đang hoạt động",
      icon: Users,
      tile: "recall",
    },
    {
      id: "courses",
      label: "Khóa học đã xuất bản",
      value: formatCount(metrics.publishedCourses),
      basis: "Khóa học đã xuất bản và chưa bị gỡ",
      icon: BookOpen,
      tile: "route",
    },
    {
      id: "cards",
      label: "Thẻ đang học",
      value: formatCount(metrics.learningCards),
      basis: "Thẻ mà học viên đã bắt đầu học, mọi khóa học",
      icon: Layers,
      tile: "recall",
    },
  ];

  return (
    <section aria-label="Chỉ số chính" className="rounded-2xl border border-slate-700 bg-[#111827]">
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((metric, index) => (
          <li
            key={metric.id}
            className={`flex flex-col gap-3 border-slate-700 p-4 sm:p-5 ${dividerClass[index]}`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tileClass[metric.tile]}`}>
                <metric.icon className="size-5" aria-hidden="true" />
              </div>
              <p className="text-sm leading-5 font-semibold text-slate-300">{metric.label}</p>
            </div>
            <p className="text-[28px] leading-[34px] font-extrabold tracking-tight text-slate-50 tabular-nums break-words">
              {metric.value}
            </p>
            <p className="text-xs leading-4 font-medium text-slate-400">{metric.basis}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
