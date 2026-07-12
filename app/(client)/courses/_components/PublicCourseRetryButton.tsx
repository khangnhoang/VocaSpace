"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PublicCourseRetryButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function retry() {
    // refresh giữ việc đọc dữ liệu ở Server Component thay vì kéo cả view sang client.
    startTransition(() => router.refresh());
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="mt-6 min-h-10 px-4"
      onClick={retry}
      disabled={isPending}
    >
      {isPending ? "Đang thử lại..." : "Thử lại"}
    </Button>
  );
}
