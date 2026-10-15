"use client";

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { ChartColumn, Table2, TrendingUp, type LucideIcon } from "lucide-react";
import {
  formatMillions,
  formatVnd,
  monthAxisLabel,
  monthLabel,
  monthLabelWithYear,
} from "@/lib/admin/dashboard-format";
import type { AdminDashboardDTO } from "@/lib/schemas/admin-dashboard";
import { revealStyle } from "./reveal";
import styles from "./dashboard-motion.module.css";

type RevenueMonth = AdminDashboardDTO["revenueMonths"][number];
type ViewId = "columns" | "trend" | "table";

const VIEWS: { id: ViewId; label: string; icon: LucideIcon }[] = [
  { id: "columns", label: "Cột", icon: ChartColumn },
  { id: "trend", label: "Xu hướng", icon: TrendingUp },
  { id: "table", label: "Bảng", icon: Table2 },
];

// Chiều cao thân thẻ không đổi giữa ba cách xem để đổi cách xem không làm trang nhảy (Admin design mục 14).
const BODY_HEIGHT_CLASS = "h-[262px]";
// Vùng vẽ: 52px phía trên cho tooltip và nhãn giá trị, 30px phía dưới cho nhãn tháng.
const PLOT_CLASS = "absolute inset-x-0 top-[52px] bottom-[30px]";

function valueRatio(value: number, max: number) {
  return max > 0 ? value / max : 0;
}

// Cùng một bộ sáu giá trị cho cả ba cách xem; cách xem chỉ là cách trình bày, không phải bộ lọc và không tính xu hướng nào (AC5).
export function RevenueCard({ months }: { months: RevenueMonth[] }) {
  const baseId = useId();
  const [selected, setSelected] = useState<ViewId>("trend");
  const tabRefs = useRef<Record<ViewId, HTMLButtonElement | null>>({ columns: null, trend: null, table: null });
  const selectedIndex = VIEWS.findIndex((view) => view.id === selected);
  const max = Math.max(...months.map((month) => month.revenue), 0);

  const select = (index: number, moveFocus: boolean) => {
    const view = VIEWS[(index + VIEWS.length) % VIEWS.length];
    setSelected(view.id);
    if (moveFocus) tabRefs.current[view.id]?.focus();
  };

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
    <section
      aria-labelledby={`${baseId}-title`}
      className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-slate-700 bg-[#111827] p-4 sm:p-6"
    >
      <div className="space-y-1">
        <h2 id={`${baseId}-title`} className="text-lg leading-[26px] font-bold text-slate-50">
          Doanh thu theo tháng
        </h2>
        <p className="text-sm leading-[22px] text-slate-300">
          Thanh toán thành công theo thời điểm tạo đơn, 6 tháng gần nhất. Đơn vị: triệu đồng.
        </p>
      </div>

      <div className="relative">
        <div role="tablist" aria-label="Cách xem doanh thu theo tháng" className="grid grid-cols-3 border-b border-slate-700">
          {VIEWS.map((view) => {
            const isSelected = view.id === selected;
            return (
              <button
                key={view.id}
                ref={(node) => {
                  tabRefs.current[view.id] = node;
                }}
                id={tabId(view.id)}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={panelId(view.id)}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => select(VIEWS.findIndex((item) => item.id === view.id), false)}
                onKeyDown={handleKeyDown}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-t-lg px-2 text-sm font-semibold transition-colors duration-[120ms] outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] motion-reduce:transition-none ${
                  isSelected ? "font-bold text-[#60A5FA]" : "text-slate-300 hover:bg-[#1E293B] hover:text-slate-50"
                }`}
              >
                <view.icon className="size-[18px] shrink-0" aria-hidden="true" />
                {view.label}
              </button>
            );
          })}
        </div>
        {/* Chỉ báo trượt chỉ trang trí: nằm trên đường kẻ, rộng một phần ba, chỉ dịch bằng transform. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-1/3 rounded-t-[3px] bg-[#60A5FA] transition-transform duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${selectedIndex * 100}%)` }}
        />
      </div>

      <div
        role="tabpanel"
        id={panelId("columns")}
        aria-labelledby={tabId("columns")}
        hidden={selected !== "columns"}
        className={BODY_HEIGHT_CLASS}
      >
        <ColumnsView months={months} max={max} />
      </div>
      <div
        role="tabpanel"
        id={panelId("trend")}
        aria-labelledby={tabId("trend")}
        hidden={selected !== "trend"}
        className={BODY_HEIGHT_CLASS}
      >
        <TrendView months={months} max={max} />
      </div>
      <div
        role="tabpanel"
        id={panelId("table")}
        aria-labelledby={tabId("table")}
        hidden={selected !== "table"}
        className={BODY_HEIGHT_CLASS}
      >
        <TableView months={months} />
      </div>
    </section>
  );
}

function PlotGrid() {
  return (
    <div className={PLOT_CLASS} aria-hidden="true">
      {[0, 25, 50, 75].map((percent) => (
        <div key={percent} className="absolute inset-x-0 border-t border-slate-700" style={{ bottom: `${percent}%` }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 border-t border-slate-500" />
    </div>
  );
}

function MonthLabels({ months }: { months: RevenueMonth[] }) {
  return (
    <div className="absolute inset-x-0 bottom-0 grid h-[30px] grid-cols-6 items-center" aria-hidden="true">
      {months.map((month) => (
        <span key={month.month} className="text-center text-xs leading-4 font-medium text-slate-300">
          {monthAxisLabel(month.month)}
        </span>
      ))}
    </div>
  );
}

function columnsAlternative(months: RevenueMonth[]) {
  return `Doanh thu theo tháng, dạng cột, triệu đồng: ${months
    .map((month) => `${monthLabel(month.month)}: ${formatMillions(month.revenue)}`)
    .join("; ")}.`;
}

function ColumnsView({ months, max }: { months: RevenueMonth[]; max: number }) {
  return (
    // role="img" kèm văn bản thay thế đủ sáu giá trị; phần vẽ bên trong chỉ để nhìn.
    <div role="img" aria-label={columnsAlternative(months)} className="relative h-full">
      <PlotGrid />
      <div className={`${PLOT_CLASS} grid grid-cols-6`}>
        {months.map((month, index) => {
          const percent = valueRatio(month.revenue, max) * 100;
          return (
            <div key={month.month} className="relative flex h-full justify-center">
              {/* Cột khác 0 giữ chiều cao tối thiểu 4px; nhãn giá trị nằm trên cột, không bao giờ đè lên gradient. */}
              {month.revenue > 0 ? (
                <div
                  data-testid="revenue-column"
                  className={`absolute bottom-0 w-[min(60%,44px)] rounded-t-md bg-gradient-to-t from-[#2B6CED] to-[#60A5FA] ${styles.revealUp}`}
                  style={{ height: `${percent}%`, minHeight: 4, ...revealStyle(month.revenue, max, index, months.length) }}
                />
              ) : null}
              <span
                className="absolute w-full text-center text-xs leading-4 font-bold text-slate-50 tabular-nums"
                style={{ bottom: month.revenue > 0 ? `calc(max(${percent}%, 4px) + 4px)` : "4px" }}
              >
                {formatMillions(month.revenue)}
              </span>
            </div>
          );
        })}
      </div>
      <MonthLabels months={months} />
    </div>
  );
}

function TrendView({ months, max }: { months: RevenueMonth[]; max: number }) {
  const fadeId = `${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-fade`;
  const [active, setActive] = useState<number | null>(null);
  const focusedRef = useRef(false);
  const last = months.length - 1;

  const slotCenter = (index: number) => ((index + 0.5) / months.length) * 100;
  // Vị trí dọc theo phần trăm từ đỉnh vùng vẽ; trục giá trị bắt đầu từ 0 nên độ cao tỷ lệ với giá trị.
  const pointTop = (month: RevenueMonth) => 100 - valueRatio(month.revenue, max) * 100;

  // Đường nối các điểm trong hệ 0-100 của vùng vẽ; stroke không co giãn nên nét luôn 3px.
  const linePath = `M ${months.map((month, index) => `${slotCenter(index)},${pointTop(month)}`).join(" L ")}`;
  const areaPath = `${linePath} L ${slotCenter(last)},100 L ${slotCenter(0)},100 Z`;

  const activeMonth = active === null ? null : months[active];
  const activeText = activeMonth ? `${monthLabel(activeMonth.month)} · ${formatVnd(activeMonth.revenue)}` : "";
  const tooltipShift = active === 0 ? "-15%" : active === last ? "-85%" : "-50%";

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") setActive((current) => (current === null ? last : Math.min(last, current + 1)));
    else if (event.key === "ArrowLeft") setActive((current) => (current === null ? last : Math.max(0, current - 1)));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(last);
    else if (event.key === "Escape") setActive(null);
    else return;
    event.preventDefault();
  };

  return (
    <div className="relative h-full">
      {/* Cả đồ thị là một nhóm focus được: mũi tên trái/phải đổi điểm, vùng thông báo đọc đúng chữ của tooltip. */}
      <div
        role="group"
        tabIndex={0}
        aria-label="Doanh thu theo tháng, dạng xu hướng"
        onKeyDown={handleKeyDown}
        onFocus={() => {
          focusedRef.current = true;
          setActive((current) => current ?? last);
        }}
        onBlur={() => {
          focusedRef.current = false;
          setActive(null);
        }}
        onMouseLeave={() => {
          if (!focusedRef.current) setActive(null);
        }}
        className="absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
      >
        <PlotGrid />

        {/* Đường và vùng mờ dưới đường lộ dần từ trái sang phải bằng clip-path; nhãn và số luôn hiện từ khung đầu. */}
        <div className={`${PLOT_CLASS} ${styles.trendReveal}`} aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="size-full overflow-visible">
            <defs>
              <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${fadeId})`} />
            <path
              d={linePath}
              fill="none"
              stroke="#60A5FA"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        <div className={PLOT_CLASS}>
          {months.map((month, index) => {
            const top = pointTop(month);
            return (
              <div
                key={month.month}
                data-testid="trend-slot"
                onMouseEnter={() => setActive(index)}
                className="absolute top-0 h-full"
                style={{ left: `${(index / months.length) * 100}%`, width: `${100 / months.length}%` }}
              >
                <span
                  className="absolute w-full text-center text-xs leading-4 font-bold text-slate-50 tabular-nums"
                  style={{ bottom: `calc(${100 - top}% + 10px)` }}
                >
                  {formatMillions(month.revenue)}
                </span>
                <span
                  className={`absolute size-3 rounded-full bg-[#60A5FA] ring-2 ring-[#111827] ${styles.markerFade}`}
                  style={{
                    left: "50%",
                    top: `${top}%`,
                    transform: "translate(-50%, -50%)",
                    "--reveal-delay": `${Math.round(900 * (slotCenter(index) / 100))}ms`,
                  } as CSSProperties}
                />
              </div>
            );
          })}
        </div>

        <MonthLabels months={months} />

        {activeMonth ? (
          <div
            data-testid="trend-tooltip"
            aria-hidden="true"
            className="pointer-events-none absolute top-0 z-10 rounded-md border border-slate-500 bg-[#1E293B] px-2 py-1 text-xs leading-4 font-semibold whitespace-nowrap text-slate-50"
            style={{ left: `${slotCenter(active!)}%`, transform: `translateX(${tooltipShift})` }}
          >
            {monthLabel(activeMonth.month)} · <span className="text-[#60A5FA] tabular-nums">{formatVnd(activeMonth.revenue)}</span>
          </div>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {activeText}
      </p>
    </div>
  );
}

function TableView({ months }: { months: RevenueMonth[] }) {
  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Doanh thu theo tháng, triệu đồng, thanh toán thành công theo thời điểm tạo đơn</caption>
        <thead>
          <tr>
            <th scope="col" className="py-2 text-left text-xs leading-4 font-semibold tracking-[0.02em] text-slate-300">
              Tháng
            </th>
            <th scope="col" className="py-2 text-right text-xs leading-4 font-semibold tracking-[0.02em] text-slate-300">
              Doanh thu (triệu ₫)
            </th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month} className="border-t border-slate-700 transition-colors duration-[120ms] hover:bg-[#1E293B]">
              <th scope="row" className="h-9 text-left text-sm leading-[22px] font-normal text-slate-300">
                {monthLabelWithYear(month.month)}
              </th>
              <td className="h-9 text-right text-sm leading-[22px] font-semibold text-slate-50 tabular-nums">
                {formatMillions(month.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
