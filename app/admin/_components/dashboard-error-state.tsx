"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Trạng thái lỗi của dashboard: không hiện con số nào và không có văn bản lỗi thô; "Thử lại" tải lại dữ liệu từ server (AC11, Admin design mục 13).
export function DashboardErrorState({ message }: { message: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <section
      aria-labelledby="admin-dashboard-error-heading"
      className="flex flex-col items-center justify-center rounded-2xl border border-slate-700 bg-[#111827] px-6 py-16 text-center"
    >
      <div role="alert" className="flex flex-col items-center">
        <TriangleAlert className="mb-3 size-8 text-[#F87171]" aria-hidden="true" />
        <h2 id="admin-dashboard-error-heading" className="text-sm font-semibold text-slate-50">
          Không thể tải số liệu tổng quan.
        </h2>
        <p className="mt-2 max-w-md text-sm text-slate-300">{message ?? "Vui lòng thử lại."}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
        className="mt-5 min-w-28 border-slate-500 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white"
      >
        {isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
        {isPending ? "Đang tải lại" : "Thử lại"}
      </Button>
    </section>
  );
}
