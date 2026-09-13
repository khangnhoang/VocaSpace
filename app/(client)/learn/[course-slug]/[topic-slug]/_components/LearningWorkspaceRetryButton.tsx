"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LearningWorkspaceRetryButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className="min-h-11 rounded-xl bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700"
    >
      <RotateCcw aria-hidden="true" className="size-4" />
      {isPending ? "Đang tải lại..." : "Thử lại"}
    </Button>
  );
}
