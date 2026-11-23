import type { Translate } from "@/lib/i18n/translate";
import { viAuthText } from "./vi-auth-text";

// U3 AC12: hình minh hoạ đường cong ghi nhớ trên panel các trang auth. Đây là minh hoạ, không đọc dữ liệu người dùng.
// Công thức là đường cong quên dạng luỹ thừa của FSRS: R(t) = (1 + 19/81 · t/S)^-0.5, nên R(S) = 0,9. Mỗi lần ôn
// đặt đúng lúc mức nhớ chạm ngưỡng 90% bằng cách cho độ ổn định S bằng khoảng cách tới lần ôn sau.

export const CURVE_VIEWBOX = { width: 560, height: 270 } as const;

const PLOT = { x0: 58, x1: 530, yTop: 22, yBottom: 232, minRecall: 0.25, horizonDays: 45 } as const;
const REVIEW_DAYS = [0, 1, 3, 7, 30] as const;
const STABILITY_DAYS = [1, 2, 4, 23, 60] as const;
const SAMPLES_PER_SEGMENT = 56;
// Ở màn quên mật khẩu, mức nhớ tụt từ lần ôn "3 ngày" tới mốc "1 tháng" mà không được ôn lại.
const LAPSE_START_INDEX = 2;
const LAPSE_END_DAY = 30;

export const REVIEW_THRESHOLD = 0.9;
// Nhãn trục thời gian là khóa trong catalog `auth.curve`.
export const TICK_LABEL_KEYS = ["curve.tick0", "curve.tick1", "curve.tick2", "curve.tick3", "curve.tick4"] as const;

export type CurveVariant =
  | { kind: "login" }
  | { kind: "register"; stage: 1 | 2 | 3 | 4 | 5 }
  | { kind: "settled" }
  | { kind: "forgot"; sent: boolean };

export type CurvePath = { key: string; d: string; area?: string; tone: "recall" | "lapse" | "jump" };
export type CurveNode = {
  key: string;
  x: number;
  y: number;
  tone: "recall" | "current" | "low" | "relearn";
  label?: string;
};
export type CurveGeometry = {
  paths: CurvePath[];
  nodes: CurveNode[];
  ghost: string | null;
  preview: string | null;
  // Mốc thời gian cuối cùng đã chạm tới, để in đậm nhãn trục.
  reachedTick: number;
};

export function recallAt(elapsedDays: number, stabilityDays: number): number {
  return Math.pow(1 + ((19 / 81) * elapsedDays) / stabilityDays, -0.5);
}

export function xForDay(day: number): number {
  return PLOT.x0 + (Math.log1p(2 * day) / Math.log1p(2 * PLOT.horizonDays)) * (PLOT.x1 - PLOT.x0);
}

export function yForRecall(recall: number): number {
  return PLOT.yBottom - ((recall - PLOT.minRecall) / (1 - PLOT.minRecall)) * (PLOT.yBottom - PLOT.yTop);
}

export const PLOT_BOUNDS = PLOT;
export const REVIEW_X = REVIEW_DAYS.map(xForDay);

const round = (value: number) => Math.round(value * 10) / 10;

function decayPath(fromDay: number, toDay: number, stability: number): string {
  let d = "";
  for (let i = 0; i <= SAMPLES_PER_SEGMENT; i += 1) {
    const day = fromDay + ((toDay - fromDay) * i) / SAMPLES_PER_SEGMENT;
    d += `${i === 0 ? "M" : " L"}${round(xForDay(day))},${round(yForRecall(recallAt(day - fromDay, stability)))}`;
  }
  return d;
}

function reviewSegment(index: number): CurvePath {
  const from = REVIEW_DAYS[index];
  const isLast = index === REVIEW_DAYS.length - 1;
  const to = isLast ? PLOT.horizonDays : REVIEW_DAYS[index + 1];
  const decay = decayPath(from, to, STABILITY_DAYS[index]);
  // Mỗi đoạn gồm phần tụt dần rồi bước nhảy về 100% ở lần ôn kế tiếp.
  const d = isLast ? decay : `${decay} L${round(xForDay(to))},${round(yForRecall(1))}`;
  const floor = round(yForRecall(PLOT.minRecall));
  const area = `${decay} L${round(xForDay(to))},${floor} L${round(xForDay(from))},${floor} Z`;
  return { key: `segment-${index}`, d, area, tone: "recall" };
}

function reviewNode(index: number, tone: CurveNode["tone"]): CurveNode {
  return { key: `node-${index}`, x: round(xForDay(REVIEW_DAYS[index])), y: round(yForRecall(1)), tone };
}

// `t` dịch nhãn mốc; thiếu thì dùng tiếng Việt từ catalog (test và code không có provider).
export function curveGeometry(variant: CurveVariant, t: Translate = viAuthText): CurveGeometry {
  if (variant.kind === "login" || variant.kind === "settled") {
    const paths = REVIEW_DAYS.map((_, index) => reviewSegment(index));
    const nodes = REVIEW_DAYS.map((_, index) => reviewNode(index, index === REVIEW_DAYS.length - 1 ? "current" : "recall"));
    return {
      paths,
      nodes,
      ghost: variant.kind === "login" ? decayPath(0, PLOT.horizonDays, STABILITY_DAYS[0]) : null,
      preview: null,
      reachedTick: REVIEW_DAYS.length - 1,
    };
  }

  if (variant.kind === "register") {
    const current = variant.stage - 1;
    const paths = Array.from({ length: current }, (_, index) => reviewSegment(index));
    const nodes = Array.from({ length: variant.stage }, (_, index) => reviewNode(index, index === current ? "current" : "recall"));
    const nextDay = current < REVIEW_DAYS.length - 1 ? REVIEW_DAYS[current + 1] : PLOT.horizonDays;
    return {
      paths,
      nodes,
      ghost: null,
      preview: decayPath(REVIEW_DAYS[current], nextDay, STABILITY_DAYS[current]),
      reachedTick: current,
    };
  }

  const paths = Array.from({ length: LAPSE_START_INDEX }, (_, index) => reviewSegment(index));
  const nodes = Array.from({ length: LAPSE_START_INDEX + 1 }, (_, index) => reviewNode(index, "recall"));
  const lapseStart = REVIEW_DAYS[LAPSE_START_INDEX];
  const lapseStability = STABILITY_DAYS[LAPSE_START_INDEX];
  const lowRecall = recallAt(LAPSE_END_DAY - lapseStart, lapseStability);
  const lowX = round(xForDay(LAPSE_END_DAY));
  const lowY = round(yForRecall(lowRecall));
  paths.push({ key: "lapse", d: decayPath(lapseStart, LAPSE_END_DAY, lapseStability), tone: "lapse" });
  nodes.push({ key: "low", x: lowX, y: lowY, tone: "low", label: t("curve.lapsing") });
  if (variant.sent) {
    const topY = round(yForRecall(1));
    paths.push({ key: "relearn-jump", d: `M${lowX},${lowY} L${lowX},${topY}`, tone: "jump" });
    nodes.push({ key: "relearn", x: lowX, y: topY, tone: "relearn", label: t("curve.relearn") });
    paths.push({ key: "after-relearn", d: decayPath(LAPSE_END_DAY, PLOT.horizonDays, STABILITY_DAYS[4]), tone: "recall" });
  }
  return { paths, nodes, ghost: null, preview: null, reachedTick: LAPSE_START_INDEX };
}
