import { formatCount, formatPercent } from "@/lib/admin/dashboard-format";
import type { AdminDashboardDTO } from "@/lib/schemas/admin-dashboard";
import { HorizontalDataBar } from "./data-bar";
import { RevealScope } from "./reveal-scope";

const ROLES = [
  { key: "students", label: "Học viên" },
  { key: "teachers", label: "Giáo viên" },
  { key: "admins", label: "Quản trị viên" },
] as const;

// Cơ cấu vai trò là danh sách thanh ngang có nhãn, số lượng và tỷ lệ trên tổng ba vai trò; không dùng biểu đồ tròn (AC6).
export function UserComposition({ distribution }: { distribution: AdminDashboardDTO["userDistribution"] }) {
  const total = distribution.students + distribution.teachers + distribution.admins;
  const max = Math.max(distribution.students, distribution.teachers, distribution.admins);

  return (
    <section
      aria-labelledby="admin-composition-heading"
      className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-slate-700 bg-[#111827] p-4 sm:p-6"
    >
      <div className="space-y-1">
        <h2 id="admin-composition-heading" className="text-lg leading-[26px] font-bold text-slate-50">
          Cơ cấu người dùng
        </h2>
        <p className="text-sm leading-[22px] text-slate-300">
          Tài khoản đang hoạt động theo vai trò: {formatCount(total)} tài khoản.
        </p>
      </div>
      <RevealScope>
      <ul className="flex flex-col gap-4">
        {ROLES.map((role, index) => {
          const count = distribution[role.key];
          const share = total > 0 ? (count / total) * 100 : 0;
          return (
            <li key={role.key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 text-sm leading-[22px]">
                <span className="font-semibold text-slate-50">{role.label}</span>
                <span className="text-slate-300 tabular-nums">
                  <span className="font-bold text-slate-50">{formatCount(count)}</span> · {formatPercent(share)}
                </span>
              </div>
              <HorizontalDataBar percent={share} value={count} max={max} index={index} count={ROLES.length} />
            </li>
          );
        })}
      </ul>
      </RevealScope>
    </section>
  );
}
