"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const topicUnavailableMessage =
  "Bài học không còn khả dụng trong cấu trúc hiện tại của khóa học.";

function removeConsumedTopicUnavailableParam(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  params.delete("topic_unavailable");
  const nextSearch = params.toString();

  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
}

export default function CourseStructureRouteFeedback() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const topicUnavailable = searchParams.get("topic_unavailable");
  const consumedSearchRef = useRef<string | null>(null);

  useEffect(() => {
    if (topicUnavailable !== "1") {
      if (consumedSearchRef.current !== search) {
        consumedSearchRef.current = null;
      }
      return;
    }

    if (consumedSearchRef.current === search) return;

    consumedSearchRef.current = search;
    toast.error(topicUnavailableMessage);
    queueMicrotask(() => {
      router.replace(removeConsumedTopicUnavailableParam(pathname, search), {
        scroll: false,
      });
    });
  }, [pathname, router, search, topicUnavailable]);

  return null;
}
