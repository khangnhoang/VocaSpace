"use client";

import { use, useId, useRef, useState, useTransition, type CSSProperties, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ChartColumn, CloudOff, Loader2, Minus, Sprout, Table2, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { RevealScope } from "@/app/admin/_components/reveal-scope";
import { Button } from "@/components/ui/button";
import {
  formatInsightMonthLong,
  formatInsightMonthShort,
  progressCategories,
  toWholePercentages,
} from "@/lib/course-authoring/insights";
import styles from "./course-insights-motion.module.css";
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

type EnrollmentMonth = TeacherCourseInsights["enrollments_by_month"][number];
type ViewId = "columns" | "trend" | "table";

const VIEWS: { id: ViewId; label: string; icon: LucideIcon }[] = [
  { id: "columns", label: "Cột", icon: ChartColumn },
  { id: "trend", label: "Xu hướng", icon: TrendingUp },
  { id: "table", label: "Bảng", icon: Table2 },
];

// Chiều cao vùng xem cố định để đổi cách xem không làm trang nhảy; vùng vẽ chừa 28px trên cho nhãn số, 28px dưới cho tháng.
const BODY_HEIGHT_CLASS = "h-[272px]";
const PLOT_CLASS = "absolute inset-x-0 top-7 bottom-7";

function ratioOf(value: number, max: number) {
  return max > 0 ? value / max : 0;
}

// Cột lộ trong 1000ms + 600ms × (giá trị ÷ lớn nhất), lệch nhau tối đa 600ms cho cả chuỗi (Owner 2026-10-24: chậm hơn /admin).
function columnRevealStyle(value: number, max: number, index: number, count: number): CSSProperties {
  const stagger = count > 1 ? Math.min(120, 600 / (count - 1)) : 0;
  return {
    "--reveal-duration": `${Math.round(1000 + 600 * ratioOf(value, max))}ms`,
    "--reveal-delay": `${Math.round(index * stagger)}ms`,
  } as CSSProperties;
}

function chartSummary(months: EnrollmentMonth[], total: number, form: string) {
  return `Ghi danh mới theo tháng, dạng ${form}: ${months.map((month) => `${formatInsightMonthLong(month.month)} ${month.count}`).join(", ")}. Tổng ${numberFormat.format(total)} học viên đã ghi danh.`;
}

function PlotGrid() {
  return (
    <div className={PLOT_CLASS} aria-hidden="true">
      {[25, 50, 75].map((percent) => (
        <div key={percent} className="absolute inset-x-0 border-t border-dashed border-slate-200" style={{ bottom: `${percent}%` }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 border-t border-slate-300" />
    </div>
  );
}

function MonthAxis({ months }: { months: EnrollmentMonth[] }) {
  return (
    <div className="absolute inset-x-0 bottom-0 grid h-7 items-center" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }} aria-hidden="true">
      {months.map((month, index) => (
        <span key={month.month} className={`text-center text-xs leading-4 ${index === months.length - 1 ? "font-semibold text-route" : "font-medium text-slate-600"}`}>
          {formatInsightMonthShort(month.month)}
        </span>
      ))}
    </div>
  );
}

function ColumnsView({ months, max, total, active }: { months: EnrollmentMonth[]; max: number; total: number; active: boolean }) {
  return (
    <RevealScope active={active} role="img" aria-label={chartSummary(months, total, "cột")} className="relative h-full">
      <PlotGrid />
      <div className={`${PLOT_CLASS} grid`} style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
        {months.map((month, index) => {
          const percent = ratioOf(month.count, max) * 100;
          const isCurrent = index === months.length - 1;
          return (
            <div key={month.month} className="relative flex h-full justify-center">
              {month.count > 0 ? (
                <div
                  data-testid="enrollment-column"
                  className={`absolute bottom-0 w-[min(56%,48px)] rounded-t-md ${isCurrent ? "bg-route" : "bg-route-line"} ${styles.revealUp}`}
                  style={{ height: `${percent}%`, minHeight: 4, ...columnRevealStyle(month.count, max, index, months.length) }}
                />
              ) : null}
              <span
                className="absolute w-full text-center text-xs leading-4 font-semibold text-slate-900 tabular-nums"
                style={{ bottom: month.count > 0 ? `calc(max(${percent}%, 4px) + 4px)` : "4px" }}
              >
                {month.count}
              </span>
            </div>
          );
        })}
      </div>
      <MonthAxis months={months} />
    </RevealScope>
  );
}

function TrendView({ months, max, total, active }: { months: EnrollmentMonth[]; max: number; total: number; active: boolean }) {
  const fadeId = `${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-fade`;
  const last = months.length - 1;
  const slotCenter = (index: number) => ((index + 0.5) / months.length) * 100;
  // Trục giá trị bắt đầu từ 0 nên độ cao của điểm tỷ lệ với số ghi danh.
  const pointTop = (month: EnrollmentMonth) => 100 - ratioOf(month.count, max) * 100;
  const linePath = `M ${months.map((month, index) => `${slotCenter(index)},${pointTop(month)}`).join(" L ")}`;
  const areaPath = `${linePath} L ${slotCenter(last)},100 L ${slotCenter(0)},100 Z`;

  return (
    <RevealScope active={active} role="img" aria-label={chartSummary(months, total, "xu hướng")} className="relative h-full">
      <PlotGrid />
      <div className={`${PLOT_CLASS} ${styles.trendReveal}`} aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="size-full overflow-visible">
          <defs>
            <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--route)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--route)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${fadeId})`} />
          <path d={linePath} fill="none" stroke="var(--route)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className={PLOT_CLASS} aria-hidden="true">
        {months.map((month, index) => {
          const top = pointTop(month);
          return (
            <div key={month.month} className="absolute top-0 h-full" style={{ left: `${(index / months.length) * 100}%`, width: `${100 / months.length}%` }}>
              <span className="absolute w-full text-center text-xs leading-4 font-semibold text-slate-900 tabular-nums" style={{ bottom: `calc(${100 - top}% + 10px)` }}>
                {month.count}
              </span>
              <span
                data-testid="trend-point"
                className={`absolute size-3 rounded-full ring-2 ring-white ${index === last ? "bg-route" : "bg-route-line"} ${styles.markerFade}`}
                style={{ left: "50%", top: `${top}%`, transform: "translate(-50%, -50%)", "--reveal-delay": `${Math.round(1600 * (slotCenter(index) / 100))}ms` } as CSSProperties}
              />
            </div>
          );
        })}
      </div>
      <MonthAxis months={months} />
    </RevealScope>
  );
}

function TableView({ months }: { months: EnrollmentMonth[] }) {
  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Ghi danh mới theo tháng</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-600">
            <th scope="col" className="py-2 font-medium">Tháng</th>
            <th scope="col" className="py-2 text-right font-medium">Ghi danh mới</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month} className="border-b border-slate-100">
              <th scope="row" className="py-2 text-left font-normal">{formatInsightMonthLong(month.month)}</th>
              <td className="py-2 text-right font-semibold tabular-nums">{month.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EnrollmentChart({ insights }: { insights: TeacherCourseInsights }) {
  const baseId = useId();
  const [selected, setSelected] = useState<ViewId>("columns");
  const tabRefs = useRef<Record<ViewId, HTMLButtonElement | null>>({ columns: null, trend: null, table: null });
  const selectedIndex = VIEWS.findIndex((view) => view.id === selected);
  const months = insights.enrollments_by_month;
  const current = months[months.length - 1];
  const previous = months[months.length - 2];
  const delta = current.count - previous.count;
  const max = Math.max(1, ...months.map((month) => month.count));

  const select = (index: number, moveFocus: boolean) => {
    const view = VIEWS[(index + VIEWS.length) % VIEWS.length];
    setSelected(view.id);
    if (moveFocus) tabRefs.current[view.id]?.focus();
  };

  // Mẫu tab chuẩn: một tab stop, mũi tên trái/phải, Home/End.
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight") select(selectedIndex + 1, true);
    else if (event.key === "ArrowLeft") select(selectedIndex - 1, true);
    else if (event.key === "Home") select(0, true);
    else if (event.key === "End") select(VIEWS.length - 1, true);
    else return;
    event.preventDefault();
  };

  const tabId = (view: ViewId) => `${baseId}-tab-${view}`;
  const panelId = (view: ViewId) => `${baseId}-panel-${view}`;

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-[28px] font-extrabold leading-[34px] tabular-nums">{numberFormat.format(insights.enrollment_total)}</p>
        <p className="text-sm text-slate-600">học viên đã ghi danh</p>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-700">
        <span>{formatInsightMonthLong(current.month)} (tính đến hôm nay): <strong className="tabular-nums">{current.count}</strong> ghi danh mới</span>
        <span className={`inline-flex items-center gap-1 font-semibold ${delta > 0 ? "text-growth" : "text-slate-600"}`}>
          {delta > 0 ? <TrendingUp className="size-4" aria-hidden="true" /> : delta < 0 ? <TrendingDown className="size-4" aria-hidden="true" /> : <Minus className="size-4" aria-hidden="true" />}
          {delta === 0 ? "Không đổi" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`} so với {formatInsightMonthLong(previous.month).toLocaleLowerCase("vi")}
        </span>
      </p>

      <div className="relative mt-4">
        <div role="tablist" aria-label="Cách xem ghi danh theo tháng" className="grid grid-cols-3 border-b border-slate-200">
          {VIEWS.map((view, index) => {
            const isSelected = view.id === selected;
            return (
              <button
                key={view.id}
                ref={(node) => { tabRefs.current[view.id] = node; }}
                id={tabId(view.id)}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={panelId(view.id)}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => select(index, false)}
                onKeyDown={handleKeyDown}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-t-lg px-1 text-sm whitespace-nowrap outline-none transition-colors duration-[120ms] focus-visible:ring-2 focus-visible:ring-route motion-reduce:transition-none ${
                  isSelected ? "font-bold text-route" : "font-semibold text-slate-600 hover:bg-route-quiet hover:text-slate-900"
                }`}
              >
                <view.icon className="hidden size-[18px] shrink-0 min-[360px]:block" aria-hidden="true" />
                {view.label}
              </button>
            );
          })}
        </div>
        {/* Một chỉ báo duy nhất trượt giữa ba vị trí (tab grammar của Product Language). */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-0 left-0 h-[3px] w-1/3 rounded-t-[3px] bg-route ${styles.tabIndicator}`}
          style={{ transform: `translateX(${selectedIndex * 100}%)` }}
        />
      </div>

      {/* Ba panel trên một dải ngang; panel không được chọn là inert nên không nhận focus và bị ẩn khỏi trình đọc màn hình. */}
      <div className={`mt-3 overflow-hidden ${BODY_HEIGHT_CLASS}`}>
        <div className={`flex h-full w-[300%] ${styles.slideTrack}`} style={{ transform: `translateX(-${(selectedIndex * 100) / VIEWS.length}%)` }}>
          {VIEWS.map((view) => {
            const isSelected = view.id === selected;
            return (
              <div
                key={view.id}
                role="tabpanel"
                id={panelId(view.id)}
                aria-labelledby={tabId(view.id)}
                inert={!isSelected}
                tabIndex={isSelected ? 0 : undefined}
                className="h-full w-1/3 shrink-0 rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-route"
              >
                {view.id === "columns" ? <ColumnsView months={months} max={max} total={insights.enrollment_total} active={isSelected} /> : null}
                {view.id === "trend" ? <TrendView months={months} max={max} total={insights.enrollment_total} active={isSelected} /> : null}
                {view.id === "table" ? <TableView months={months} /> : null}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">Tháng hiện tại chưa kết thúc nên số liệu còn thay đổi.</p>
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
