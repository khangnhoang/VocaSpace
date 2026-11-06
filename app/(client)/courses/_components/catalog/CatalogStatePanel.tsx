import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CatalogStatePanelProps = {
  art: "deck" | "search" | "error";
  eyebrow: string;
  title: string;
  description: ReactNode;
  role: "status" | "alert";
  children?: ReactNode;
};

function StateArt({ art }: { art: CatalogStatePanelProps["art"] }) {
  if (art === "error") {
    return (
      <svg viewBox="0 0 200 160" aria-hidden="true" className="h-32 w-40 sm:h-40 sm:w-50">
        <rect x="36" y="38" width="128" height="90" rx="12" className="fill-white stroke-correction-line" strokeWidth="2" />
        <circle cx="100" cy="83" r="22" className="fill-correction-quiet stroke-correction" strokeWidth="2" />
        <path d="M100 72v13M100 93v.5" className="stroke-correction" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (art === "search") {
    return (
      <svg viewBox="0 0 200 160" aria-hidden="true" className="h-32 w-40 sm:h-40 sm:w-50">
        <rect x="30" y="40" width="120" height="86" rx="12" className="fill-white stroke-slate-300" strokeWidth="2" />
        <path d="M52 70h56M52 86h76M52 102h36" className="stroke-slate-200" strokeWidth="6" strokeLinecap="round" />
        <circle cx="140" cy="96" r="26" className="fill-route-quiet stroke-route" strokeWidth="3" />
        <path d="m159 115 18 18" className="stroke-route" strokeWidth="5" strokeLinecap="round" />
        <path d="M131 96h18" className="stroke-route" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  // Bộ thẻ trống: cùng hình ảnh flashcard của sản phẩm, viền nét đứt cho phần chưa có nội dung.
  return (
    <svg viewBox="0 0 200 160" aria-hidden="true" className="h-32 w-40 sm:h-40 sm:w-50">
      <rect x="44" y="34" width="116" height="84" rx="12" transform="rotate(-8 102 76)" className="fill-slate-100 stroke-slate-300" strokeDasharray="6 5" />
      <rect x="40" y="38" width="116" height="84" rx="12" transform="rotate(4 98 80)" className="fill-slate-50 stroke-slate-300" strokeDasharray="6 5" />
      <rect x="36" y="44" width="120" height="86" rx="12" className="fill-white stroke-route-line" strokeWidth="2" />
      <path d="M58 76h52M58 92h76M58 108h40" className="stroke-slate-200" strokeWidth="6" strokeLinecap="round" />
      <circle cx="146" cy="56" r="14" className="fill-recall-quiet stroke-recall" strokeWidth="2" />
      <path d="M146 50v12M140 56h12" className="stroke-recall" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CatalogStatePanel({ art, eyebrow, title, description, role, children }: CatalogStatePanelProps) {
  return (
    <div
      role={role}
      className={cn(
        "grid items-center gap-6 rounded-3xl border bg-white px-6 py-8 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-10 sm:px-12 sm:py-10",
        art === "error" ? "border-correction-line" : "border-slate-200",
      )}
    >
      <StateArt art={art} />
      <div>
        <p
          className={cn(
            "font-[family-name:var(--font-geist-sans)] text-xs font-semibold uppercase leading-4 tracking-[0.04em]",
            art === "error" ? "text-correction" : "text-recall",
          )}
        >
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-bold leading-8 tracking-[-0.01em] text-balance text-slate-900">{title}</h2>
        <div className="mt-2 max-w-[36em] text-[15px] leading-6 text-slate-600">{description}</div>
        {children ? <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">{children}</div> : null}
      </div>
    </div>
  );
}
