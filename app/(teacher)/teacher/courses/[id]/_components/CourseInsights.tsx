"use client";

import { use, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Loader2, Sprout, Table2, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatInsightMonthLong,
  formatInsightMonthShort,
  progressCategories,
  toWholePercentages,
} from "@/lib/course-authoring/insights";
import type {
  TeacherCourseInsights,
  TeacherCourseInsightsResult,
} from "@/lib/schemas/teacher-course-insights";

const numberFormat = new Intl.NumberFormat("vi-VN");

function Panel({ id, title, subtitle, children, busy }: { id: string; title: string; subtitle: string; children: React.ReactNode; busy?: boolean }) {
  return (
    <section aria-labelledby={id} aria-busy={busy} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 id={id} className="text-lg font-bold leading-7">{title}</h2>
      <p className="text-xs font-medium leading-5 text-slate-600">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const enrollmentSubtitle = "Ghi danh mới · 6 tháng gần nhất";
const progressSubtitle = "Toàn bộ học viên đã ghi danh · hiện tại";

function NoEnrollments() {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-route"><Sprout className="size-5" aria-hidden="true" /></span>
      <div>
        <p className="font-semibold">Chưa có học viên ghi danh</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Khi có người ghi danh, số ghi danh mới theo tháng sẽ xuất hiện ở đây.</p>
        <p className="mt-2 text-xs font-semibold text-slate-700">0 học viên đã ghi danh</p>
      </div>
    </div>
  );
}

function EnrollmentChart({ insights }: { insights: TeacherCourseInsights }) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const months = insights.enrollments_by_month;
  const current = months[months.length - 1];
  const previous = months[months.length - 2];
  const delta = current.count - previous.count;
  const max = Math.max(1, ...months.map((month) => month.count));
  const width = 600;
  const height = 200;
  const top = 24;
  const bottom = 28;
  const gap = 24;
  const barWidth = (width - gap * (months.length + 1)) / months.length;
  const first = months[0];
  const summary = `Ghi danh mới từ ${formatInsightMonthLong(first.month)} đến ${formatInsightMonthLong(current.month)}: ${months.map((month) => `${formatInsightMonthLong(month.month)} ${month.count}`).join(", ")}. Tổng ${numberFormat.format(insights.enrollment_total)} học viên đã ghi danh.`;

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-[28px] font-extrabold leading-[34px] tabular-nums">{numberFormat.format(insights.enrollment_total)}</p>
        <p className="text-sm text-slate-600">học viên đã ghi danh</p>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-700">
        <span>{formatInsightMonthLong(current.month)} (tính đến hôm nay): <strong className="tabular-nums">{current.count}</strong> ghi danh mới</span>
        <span className={`inline-flex items-center gap-1 font-semibold ${delta >= 0 ? "text-growth" : "text-slate-600"}`}>
          {delta >= 0 ? <TrendingUp className="size-4" aria-hidden="true" /> : <TrendingDown className="size-4" aria-hidden="true" />}
          {delta >= 0 ? "+" : "−"}{Math.abs(delta)} so với {formatInsightMonthLong(previous.month).toLocaleLowerCase("vi")}
        </span>
      </p>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[320px]" role="img" aria-label={summary}>
          <line x1="0" x2={width} y1={height - bottom} y2={height - bottom} className="stroke-slate-200" />
          {months.map((month, index) => {
            const barHeight = Math.round((month.count / max) * (height - top - bottom));
            const x = gap + index * (barWidth + gap);
            const y = height - bottom - barHeight;
            const isCurrent = index === months.length - 1;
            return (
              <g key={month.month}>
                <rect x={x} y={y} width={barWidth} height={barHeight} rx="6" className={isCurrent ? "fill-route" : "fill-route-line"} />
                <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" className="fill-slate-900 text-[13px] font-semibold tabular-nums">{month.count}</text>
                <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="fill-slate-600 text-[12px]">{formatInsightMonthShort(month.month)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-slate-600">Tháng hiện tại chưa kết thúc nên số liệu còn thay đổi.</p>
        <Button type="button" variant="link" className="px-0 coarse-input:h-11" aria-expanded={showTable} aria-controls={tableId} onClick={() => setShowTable((value) => !value)}>
          <Table2 aria-hidden="true" />{showTable ? "Ẩn bảng số liệu" : "Xem bảng số liệu"}
        </Button>
      </div>
      <div id={tableId} hidden={!showTable}>
        <table className="mt-2 w-full border-collapse text-sm">
          <caption className="sr-only">Ghi danh mới theo tháng</caption>
          <thead><tr className="border-b border-slate-200 text-left text-slate-600"><th scope="col" className="py-2 font-medium">Tháng</th><th scope="col" className="py-2 text-right font-medium">Ghi danh mới</th></tr></thead>
          <tbody>{months.map((month) => <tr key={month.month} className="border-b border-slate-100"><td className="py-2">{formatInsightMonthLong(month.month)}</td><td className="py-2 text-right tabular-nums">{month.count}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

const categoryStyles = {
  not_started: { bar: "bg-slate-300", rail: "border-slate-300" },
  in_progress: { bar: "bg-recall", rail: "border-recall" },
  completed: { bar: "bg-growth", rail: "border-growth" },
} as const;

function ProgressDistribution({ insights }: { insights: TeacherCourseInsights }) {
  if (insights.enrollment_total === 0) {
    return <p className="text-sm leading-6 text-slate-600">Tiến độ sẽ xuất hiện khi có học viên ghi danh và bắt đầu học.</p>;
  }
  if (!insights.progress) {
    return <p className="text-sm leading-6 text-slate-600"><strong className="font-semibold text-slate-900">Chưa có bài học đã xuất bản.</strong> Tiến độ học viên được tính trên các bài đã xuất bản, nên chưa có phân bố để hiển thị.</p>;
  }
  const progress = insights.progress;
  const percentages = toWholePercentages(progress);
  const label = progressCategories.map(({ key, label: name }) => `${name} ${percentages[key]}% (${progress[key]} học viên)`).join(", ");
  return (
    <>
      <div className="flex h-3.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={label}>
        {progressCategories.map(({ key }) => <span key={key} className={`h-full ${categoryStyles[key].bar}`} style={{ width: `${percentages[key]}%` }} />)}
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {progressCategories.map(({ key, label: name }) => (
          <li key={key} className={`border-l-[3px] pl-3 ${categoryStyles[key].rail}`}>
            <p className="text-xl font-bold leading-7 tabular-nums">{percentages[key]}%</p>
            <p className="text-sm leading-5 text-slate-600">{name} · {numberFormat.format(progress[key])} học viên</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-5 text-slate-600">Hoàn thành nghĩa là đã xong mọi bài học đã xuất bản hiện có.</p>
    </>
  );
}

export function CourseInsightsFallback() {
  return (
    <>
      <Panel id="enrollment-insight-title" title="Ghi danh" subtitle={enrollmentSubtitle} busy>
        <div role="status" aria-label="Đang tải số liệu ghi danh">
          <div className="h-9 w-40 rounded-lg bg-slate-100 motion-safe:animate-pulse" />
          <div className="mt-4 h-44 rounded-lg bg-slate-100 motion-safe:animate-pulse" />
        </div>
      </Panel>
      <Panel id="progress-insight-title" title="Tiến độ học viên" subtitle={progressSubtitle} busy>
        <div role="status" aria-label="Đang tải tiến độ học viên">
          <div className="h-3.5 rounded-full bg-slate-100 motion-safe:animate-pulse" />
          <div className="mt-4 h-14 rounded-lg bg-slate-100 motion-safe:animate-pulse" />
        </div>
      </Panel>
    </>
  );
}

function InsightsUnavailable({ message }: { message: string }) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();
  return (
    <section aria-labelledby="insights-unavailable-title" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div role="alert" className="flex items-start gap-3">
        <CloudOff className="mt-0.5 size-5 shrink-0 text-correction" aria-hidden="true" />
        <div>
          <h2 id="insights-unavailable-title" className="font-semibold">Chưa tải được số liệu học viên</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{message} Phần soạn nội dung và cấu trúc vẫn dùng bình thường.</p>
          <Button type="button" variant="outline" className="mt-3 coarse-input:h-11" disabled={isRetrying} onClick={() => startRetry(() => router.refresh())}>
            {isRetrying ? <Loader2 className="motion-safe:animate-spin" aria-hidden="true" /> : null}Thử lại
          </Button>
        </div>
      </div>
    </section>
  );
}

// Số liệu chỉ là đếm tổng hợp từ get_teacher_course_insights; lỗi tải không bao giờ hiển thị thành 0 (AC10).
export default function CourseInsights({ insights }: { insights: Promise<TeacherCourseInsightsResult> }) {
  const result = use(insights);
  if (!result.success) return <InsightsUnavailable message={result.error} />;
  const data = result.data;
  return (
    <>
      <Panel id="enrollment-insight-title" title="Ghi danh" subtitle={enrollmentSubtitle}>
        {data.enrollment_total === 0 ? <NoEnrollments /> : <EnrollmentChart insights={data} />}
      </Panel>
      <Panel id="progress-insight-title" title="Tiến độ học viên" subtitle={progressSubtitle}>
        <ProgressDistribution insights={data} />
      </Panel>
    </>
  );
}
