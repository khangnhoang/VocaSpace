import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ProgressionRailProps = {
  label: string;
  steps: readonly string[];
  // Bước hiện tại tính từ 1; bằng steps.length + 1 nghĩa là đã xong hết.
  current: number;
};

// U3 AC8/AC11: thanh tiến trình chỉ dùng cho thứ tự thật của luồng; chữ "Bước k/N", aria-current và nhãn
// "đã xong" giữ nguyên ý nghĩa khi không nhìn thấy màu hay đường nối.
export function ProgressionRail({ label, steps, current }: ProgressionRailProps) {
  const currentName = steps[current - 1];
  return (
    <div className="mb-6">
      <p className="mb-3 flex justify-between gap-3 font-[family-name:var(--font-geist-sans)] text-xs leading-4 font-semibold tracking-[0.04em] text-slate-600">
        <span>{current > steps.length ? `Đã xong ${steps.length}/${steps.length}` : `Bước ${current}/${steps.length}`}</span>
        {currentName ? <span className="text-route">{currentName}</span> : null}
      </p>
      <ol aria-label={label} className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const position = index + 1;
          const done = position < current;
          const isCurrent = position === current;
          return (
            <li
              key={step}
              aria-current={isCurrent ? "step" : undefined}
              className="relative flex flex-col items-center gap-2 text-center"
            >
              {index > 0 ? (
                // Đoạn nối tới bước này tô xanh dần từ trái khi đã tới (AC13); giảm chuyển động thì đổi ngay.
                <span aria-hidden="true" className="absolute top-[11px] right-1/2 h-0.5 w-full bg-slate-300">
                  <span
                    className={cn(
                      "block size-full origin-left bg-growth transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
                      done || isCurrent ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </span>
              ) : null}
              <span className="relative z-10 grid size-6 place-items-center">
                {done ? (
                  <span className="grid size-5 place-items-center rounded-full bg-growth text-white">
                    <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                  </span>
                ) : isCurrent ? (
                  <span className="grid size-4 place-items-center rounded-full border-2 border-route bg-white shadow-[0_0_0_4px_var(--route-quiet)]">
                    <span className="size-1.5 rounded-full bg-route" />
                  </span>
                ) : (
                  <span className="size-3 rounded-full border-2 border-slate-500 bg-white" />
                )}
              </span>
              <span
                className={cn(
                  "font-[family-name:var(--font-geist-sans)] text-xs leading-4 font-semibold",
                  isCurrent ? "text-route" : done ? "text-slate-700" : "text-slate-600",
                )}
              >
                {step}
                {done ? <span className="sr-only">, đã xong</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
