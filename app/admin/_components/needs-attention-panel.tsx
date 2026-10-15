import Link from "next/link";
import { ArrowRight, CircleCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ADMIN_COURSES_PATH } from "@/lib/admin/routes";
import { elapsedMinutes, formatCount, formatWait } from "@/lib/admin/dashboard-format";

type NeedsAttentionPanelProps = {
  pending: { count: number; oldestSubmittedAt: string | null };
  generatedAt: string;
};

// Vùng đầu tiên của dashboard: duy nhất một vùng được phép "gấp" (Admin design mục 2, 14).
// Có khóa học chờ duyệt thì dùng cặp Amber quiet; không có thì nói rõ bằng chữ trong kiểu trung tính và không hiện thời gian chờ.
export function NeedsAttentionPanel({ pending, generatedAt }: NeedsAttentionPanelProps) {
  if (pending.count === 0) {
    return (
      <section
        aria-labelledby="admin-attention-heading"
        className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-[#111827] p-4 sm:p-5"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#1E293B] text-slate-300">
          <CircleCheck className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 id="admin-attention-heading" className="text-xs font-semibold tracking-[0.02em] text-slate-400">
            Cần xử lý
          </h2>
          <p className="mt-0.5 text-sm text-slate-300">Không có khóa học nào đang chờ duyệt.</p>
        </div>
      </section>
    );
  }

  // Khóa học pending cũ không có submitted_at thì chỉ hiện số lượng, không bịa thời gian chờ.
  const waitMinutes = elapsedMinutes(pending.oldestSubmittedAt, generatedAt);

  return (
    <section
      aria-labelledby="admin-attention-heading"
      className="flex flex-col gap-4 rounded-2xl border border-[#92400E] bg-[#451A03] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#92400E] text-[#FBBF24]">
          <Clock className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 id="admin-attention-heading" className="text-xs font-semibold tracking-[0.02em] text-[#FBBF24]">
            Cần xử lý
          </h2>
          <p className="mt-0.5 text-lg leading-[26px] font-bold text-slate-50">
            <span className="tabular-nums">{formatCount(pending.count)}</span> khóa học đang chờ duyệt
          </p>
          {waitMinutes !== null ? (
            <p className="mt-0.5 text-sm text-[#FBBF24]">
              Khóa học chờ lâu nhất đã chờ <span className="font-semibold tabular-nums">{formatWait(waitMinutes)}</span>.
            </p>
          ) : null}
        </div>
      </div>
      <Button asChild size="lg" className="w-full sm:w-auto">
        <Link href={`${ADMIN_COURSES_PATH}?status=pending`}>
          Xem hàng đợi duyệt
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
