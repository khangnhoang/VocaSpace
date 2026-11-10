"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CURVE_VIEWBOX,
  PLOT_BOUNDS,
  REVIEW_THRESHOLD,
  REVIEW_X,
  TICK_LABELS,
  curveGeometry,
  yForRecall,
  type CurveVariant,
} from "@/lib/auth/memory-curve";
import type { AuthPanelCopy } from "./auth-shell-context";

const CHART_SUMMARY: Record<CurveVariant["kind"], string> = {
  login:
    "Minh hoạ: mỗi lần ôn đúng lúc sắp quên kéo mức nhớ về gần 100%, khoảng cách giữa các lần ôn dài dần; nếu không ôn lại, mức nhớ tụt dần.",
  register: "Minh hoạ: đường cong ghi nhớ thêm một lần ôn sau mỗi chặng đăng ký.",
  settled: "Minh hoạ: sau nhiều lần ôn đúng lúc, mức nhớ giữ ổn định ở gần 100%.",
  forgot: "Minh hoạ: lâu không ôn thì mức nhớ tụt dần; một lần ôn lại kéo nó về 100%.",
};

const UTILITY = "font-[family-name:var(--font-geist-sans)] text-xs font-semibold leading-4";

type MemoryCurvePanelProps = {
  variant: CurveVariant;
  copy: AuthPanelCopy;
  showFlashcard: boolean;
  flashcardFlipped: boolean;
};

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

export function MemoryCurvePanel({ variant, copy, showFlashcard, flashcardFlipped }: MemoryCurvePanelProps) {
  const geometry = curveGeometry(variant);
  const { width, height } = CURVE_VIEWBOX;
  const thresholdY = yForRecall(REVIEW_THRESHOLD);
  const lastNodeX = REVIEW_X[REVIEW_X.length - 1];

  return (
    <aside
      aria-label="Minh hoạ cách VocaSpace xếp lịch ôn"
      className="order-first flex flex-col gap-1.5 rounded-[16px] bg-slate-100 px-4 pt-3.5 pb-3 min-[960px]:order-none min-[960px]:gap-3 min-[960px]:px-7 min-[960px]:pt-7 min-[960px]:pb-6"
    >
      <div className="flex items-center justify-between gap-3">
        <p className={cn(UTILITY, "tracking-[0.04em] text-recall uppercase")}>Đường cong ghi nhớ</p>
        <span className={cn(UTILITY, "hidden rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-slate-600 min-[960px]:inline")}>
          Minh hoạ
        </span>
      </div>

      <div className="relative flex flex-1 flex-col justify-center">
        {showFlashcard ? (
          // Thẻ đậu phía trên mốc "1 tháng", có vạch nét đứt nối xuống mốc đó.
          <div aria-hidden="true" className="relative mb-3 hidden h-[120px] min-[960px]:block">
            <span
              className="absolute top-full h-[22px] border-l-2 border-dashed border-slate-400"
              style={{ left: pct(lastNodeX, width) }}
            />
            <div
              className="absolute top-0 h-[120px] w-[196px] [perspective:900px]"
              style={{ left: `min(calc(${pct(lastNodeX, width)} - 98px), calc(100% - 196px))` }}
            >
            <div
              className={cn(
                "relative size-full transition-transform duration-[640ms] ease-[cubic-bezier(0.2,0,0,1)] [transform-style:preserve-3d] motion-reduce:transition-none",
                flashcardFlipped && "[transform:rotateY(180deg)]",
              )}
            >
              <div className="absolute inset-0 flex flex-col justify-between rounded-[16px] border border-slate-300 bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.10)] [backface-visibility:hidden]">
                <span className={cn(UTILITY, "tracking-[0.04em] text-recall")}>THẺ TỪ</span>
                <span>
                  <span className="block text-[22px] leading-7 font-extrabold tracking-[-0.01em] text-slate-900">remember</span>
                  <span className="font-[family-name:var(--font-geist-sans)] text-[13px] leading-4 font-medium text-slate-600">
                    /rɪˈmem.bər/ · ghi nhớ
                  </span>
                </span>
              </div>
              <div className="absolute inset-0 flex flex-col justify-between rounded-[16px] bg-slate-900 px-4 py-3.5 text-white shadow-[0_8px_24px_rgba(15,23,42,0.10)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <span className="flex items-center gap-2 text-sm leading-5 font-bold">
                  <Lock aria-hidden="true" className="size-4" />
                  Không nhìn trộm đâu
                </span>
                <span className="text-xs leading-[18px] text-slate-300">Thẻ quay mặt đi khi bạn gõ mật khẩu.</span>
              </div>
            </div>
            </div>
          </div>
        ) : null}

        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height - 30}`}
            role="img"
            aria-label={CHART_SUMMARY[variant.kind]}
            className="block h-auto w-full overflow-visible"
          >
            <line x1={PLOT_BOUNDS.x0} x2={PLOT_BOUNDS.x1} y1={yForRecall(1)} y2={yForRecall(1)} stroke="#E2E8F0" />
            <line x1={PLOT_BOUNDS.x0} x2={PLOT_BOUNDS.x1} y1={thresholdY} y2={thresholdY} stroke="#94A3B8" strokeDasharray="4 4" />
            <line x1={PLOT_BOUNDS.x0} x2={PLOT_BOUNDS.x1} y1={yForRecall(0.6)} y2={yForRecall(0.6)} stroke="#E2E8F0" />
            <line x1={PLOT_BOUNDS.x0} x2={PLOT_BOUNDS.x1} y1={PLOT_BOUNDS.yBottom} y2={PLOT_BOUNDS.yBottom} stroke="#CBD5E1" />
            {REVIEW_X.map((x) => (
              <line key={x} x1={x} x2={x} y1={PLOT_BOUNDS.yBottom} y2={PLOT_BOUNDS.yBottom + 6} stroke="#CBD5E1" />
            ))}
            {geometry.paths.map((path) =>
              path.area ? <path key={`${path.key}-area`} d={path.area} fill="rgba(14,116,144,0.08)" /> : null,
            )}
            {geometry.ghost ? (
              <path d={geometry.ghost} fill="none" stroke="#64748B" strokeWidth={1.75} strokeDasharray="4 5" />
            ) : null}
            {geometry.preview ? (
              <path d={geometry.preview} fill="none" stroke="#94A3B8" strokeWidth={2} strokeDasharray="2 6" strokeLinecap="round" />
            ) : null}
            {geometry.paths.map((path) => (
              <path
                key={path.key}
                d={path.d}
                fill="none"
                stroke={path.tone === "lapse" ? "#A16207" : path.tone === "jump" ? "#2563EB" : "#0E7490"}
                strokeWidth={2.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {geometry.nodes.map((node) => (
              <g key={node.key}>
                {node.tone === "current" || node.tone === "relearn" ? (
                  <circle cx={node.x} cy={node.y} r={13} fill="#EFF6FF" stroke="#93C5FD" />
                ) : null}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.tone === "recall" ? 5 : 7}
                  fill="#FFFFFF"
                  stroke={node.tone === "low" ? "#A16207" : node.tone === "recall" ? "#0E7490" : "#2563EB"}
                  strokeWidth={2.5}
                />
              </g>
            ))}
          </svg>
          {/* Nhãn chữ là HTML để giữ cỡ chữ thật (tối thiểu 12px) dù SVG co giãn theo chiều rộng panel. */}
          <span aria-hidden="true" className={cn(UTILITY, "absolute left-0 text-slate-600 max-[959px]:hidden")} style={{ top: `calc(${pct(yForRecall(1), height - 30)} - 8px)` }}>
            100%
          </span>
          <span aria-hidden="true" className={cn(UTILITY, "absolute left-1.5 text-slate-600 max-[959px]:hidden")} style={{ top: `calc(${pct(yForRecall(0.6), height - 30)} - 8px)` }}>
            60%
          </span>
          {geometry.nodes
            .filter((node) => node.label)
            .map((node) => (
              <span
                key={`${node.key}-label`}
                aria-hidden="true"
                className={cn(
                  UTILITY,
                  "absolute -translate-x-[calc(100%+12px)] whitespace-nowrap rounded-[4px] bg-white px-1",
                  node.tone === "low" ? "text-attention" : "text-route",
                )}
                style={{
                  left: pct(node.x, width),
                  top: node.tone === "low" ? `calc(${pct(node.y, height - 30)} + 6px)` : `calc(${pct(node.y, height - 30)} - 24px)`,
                }}
              >
                {node.label}
              </span>
            ))}
          <div aria-hidden="true" className="relative mt-1 h-4">
            {TICK_LABELS.map((label, index) => (
              <span
                key={label}
                className={cn(
                  UTILITY,
                  "absolute whitespace-nowrap",
                  index === 0 ? "" : "-translate-x-1/2",
                  (index === 1 || index === 2) && "max-[479px]:hidden",
                  index <= geometry.reachedTick ? "text-slate-900" : "text-slate-600",
                )}
                style={{ left: pct(REVIEW_X[index], width) }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ul className={cn(UTILITY, "hidden flex-wrap gap-x-4 gap-y-1.5 text-slate-600 min-[960px]:flex")} aria-hidden="true">
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-recall" />
          Ôn theo lịch FSRS
        </li>
        {variant.kind === "login" ? (
          <li className="flex items-center gap-2">
            <span className="w-5 border-t-2 border-dotted border-slate-500" />
            Không ôn lại
          </li>
        ) : null}
        {variant.kind === "forgot" ? (
          <li className="flex items-center gap-2">
            <span className="h-0.5 w-5 rounded-full bg-attention" />
            Lâu không ôn
          </li>
        ) : null}
        <li className="flex items-center gap-2">
          <span className="w-5 border-t border-dashed border-slate-400" />
          Ngưỡng ôn 90%
        </li>
      </ul>

      <div aria-live="polite">
        {copy.stage ? (
          <p className={cn(UTILITY, "mb-1.5 hidden tracking-[0.04em] text-route min-[960px]:block")}>{copy.stage}</p>
        ) : null}
        <p className="text-base leading-6 font-bold text-slate-900 min-[960px]:text-2xl min-[960px]:leading-8 min-[960px]:tracking-[-0.01em]">
          {copy.title}
        </p>
        <p className="mt-1.5 hidden max-w-[46ch] text-base leading-[26px] text-slate-600 min-[960px]:block">{copy.text}</p>
      </div>
    </aside>
  );
}
