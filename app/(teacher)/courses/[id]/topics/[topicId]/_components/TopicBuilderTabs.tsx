"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, ClipboardList, Settings } from "lucide-react";
import ExerciseTab from "./ExerciseTab";
import FlashcardTab from "./FlashcardTab";
import SettingsTab from "./SettingsTab";
import {
  getCourseOverviewPath,
  getTopicBuilderTab,
  TOPIC_BUILDER_TABS,
  type TopicBuilderTab,
} from "@/lib/course-authoring/routes";
import DashboardIssueNotice from "@/app/(teacher)/courses/[id]/_components/DashboardIssueNotice";
import DashboardReturnFeedback from "@/app/(teacher)/courses/[id]/_components/DashboardReturnFeedback";
import {
  getCourseStructureIssueUnavailablePath,
  parseCourseAuthoringIssueDestination,
  removeDashboardIssueContextParams,
  type TopicBuilderIssueContext,
} from "@/lib/course-authoring/issue-context";
import {
  getInvalidDashboardIssueGuidance,
  resolveTopicBuilderTopIssueGuidance,
} from "@/lib/course-authoring/issue-guidance";
import {
  getDashboardIssueReturnFeedback,
  type CourseAuthoringReturnFeedback,
  type CourseAuthoringSuccessEvent,
} from "@/lib/course-authoring/issue-success";

interface TopicBuilderTabsProps {
  courseId: string;
  topicId: string;
  parentChapterId: string | null;
  initialSearch: string;
}

export default function TopicBuilderTabs({
  courseId,
  topicId,
  parentChapterId,
  initialSearch,
}: TopicBuilderTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [returnFeedback, setReturnFeedback] =
    useState<CourseAuthoringReturnFeedback | null>(null);
  const [hasConsumedDashboardIssue, setHasConsumedDashboardIssue] =
    useState(false);
  const [consumedDashboardIssueContext, setConsumedDashboardIssueContext] =
    useState<TopicBuilderIssueContext | null>(null);
  const [manualActiveTab, setManualActiveTab] =
    useState<TopicBuilderTab | null>(null);
  // Dùng search ban đầu từ Server Component cho lần render đầu để tránh lệch hydration
  // khi URL có tham số dashboard nhưng client chưa đồng bộ search params.
  const search = useSyncExternalStore(
    subscribeToNavigationSnapshot,
    () => searchParams.toString(),
    () => initialSearch,
  );
  const issueDestinationState = useMemo(
    () => parseCourseAuthoringIssueDestination(search),
    [search],
  );
  const activeTab = manualActiveTab
    ? manualActiveTab
    : (issueDestinationState.kind === "valid" ||
        issueDestinationState.kind === "invalid_tab") &&
      !hasConsumedDashboardIssue
      ? getTopicBuilderTab(issueDestinationState.context.tab ?? null)
      : getTopicBuilderTab(new URLSearchParams(search).get("tab"));
  const dashboardIssueContext =
    issueDestinationState.kind === "valid" ||
    issueDestinationState.kind === "invalid_tab"
      ? issueDestinationState.context
      : null;
  const topicBuilderIssueContext =
    dashboardIssueContext?.issue === "topic_has_no_learning_content" ||
    dashboardIssueContext?.issue === "exercise_requires_group" ||
    dashboardIssueContext?.issue === "question_group_has_no_active_questions" ||
    dashboardIssueContext?.issue === "exercise_requires_standalone_question" ||
    dashboardIssueContext?.issue === "exercise_has_orphan_questions" ||
    dashboardIssueContext?.issue === "exercise_group_missing_context" ||
    dashboardIssueContext?.issue === "question_missing_content" ||
    dashboardIssueContext?.issue === "question_has_too_few_options" ||
    dashboardIssueContext?.issue === "question_has_no_correct_option"
      ? (dashboardIssueContext as TopicBuilderIssueContext)
      : null;
  const topGuidance = useMemo(() => {
    if (hasConsumedDashboardIssue) return null;

    if (issueDestinationState.kind === "invalid_tab") {
      return {
        ...getInvalidDashboardIssueGuidance(),
        title: "Tab trong đường dẫn không còn hợp lệ",
        description:
          "Tab được yêu cầu không dùng được cho vấn đề này. Bạn đã được đưa về tab an toàn để tiếp tục chỉnh sửa.",
      };
    }

    if (!topicBuilderIssueContext) return null;

    return resolveTopicBuilderTopIssueGuidance({
      topicId,
      context: topicBuilderIssueContext,
    });
  }, [
    hasConsumedDashboardIssue,
    issueDestinationState.kind,
    topicBuilderIssueContext,
    topicId,
  ]);
  const exerciseIssueContext =
    hasConsumedDashboardIssue ||
    topicBuilderIssueContext?.issue === "topic_has_no_learning_content"
      ? null
      : topicBuilderIssueContext;
  const staleTargetRedirectHref = getCourseStructureIssueUnavailablePath(
    courseId,
    parentChapterId,
  );

  useEffect(() => {
    if (issueDestinationState.kind === "invalid_context") {
      // URL hỏng hoặc target không đúng loại không nên ở lại topic builder,
      // vì màn này không thể biết mục nào cần đánh dấu.
      router.replace(staleTargetRedirectHref, { scroll: false });
      return;
    }

    if (
      (issueDestinationState.kind === "valid" ||
        issueDestinationState.kind === "invalid_tab") &&
      issueDestinationState.context.issue === "topic_has_no_learning_content" &&
      issueDestinationState.context.target !== topicId
    ) {
      router.replace(staleTargetRedirectHref, { scroll: false });
      return;
    }
  }, [issueDestinationState, router, staleTargetRedirectHref, topicId]);

  const handleTabChange = (value: string) => {
    if (TOPIC_BUILDER_TABS.includes(value as TopicBuilderTab)) {
      selectTopicBuilderTab(value as TopicBuilderTab);
    }
  };

  const clearDashboardIssueUrl = () => {
    const currentPathname =
      typeof window === "undefined" ? pathname : window.location.pathname;
    const currentSearch =
      typeof window === "undefined"
        ? search
        : window.location.search.replace(/^\?/, "");
    const cleanedPath = removeDashboardIssueContextParams(
      currentPathname,
      currentSearch,
    );
    const [cleanPathname, cleanSearch = ""] = cleanedPath.split("?");
    const params = new URLSearchParams(cleanSearch);
    // Đóng lời nhắc chỉ xóa ngữ cảnh dashboard; tab hiện tại vẫn được giữ để giáo viên tiếp tục soạn.
    params.set("tab", activeTab);
    const nextSearch = params.toString();
    const nextHref = nextSearch ? `${cleanPathname}?${nextSearch}` : cleanPathname;

    // Khi giáo viên đổi tab rồi lưu rất nhanh, URL trình duyệt có thể mới hơn
    // snapshot của Next router. Cập nhật history trực tiếp để refresh không làm hiện lại lời nhắc cũ.
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", nextHref);
    }

    router.replace(nextHref, { scroll: false });
  };

  const exitDashboardIssueMode = () => {
    setHasConsumedDashboardIssue(true);
    setConsumedDashboardIssueContext(null);
    clearDashboardIssueUrl();
  };

  const showReturnFeedbackForSuccess = (
    event: CourseAuthoringSuccessEvent,
  ) => {
    const feedback = getDashboardIssueReturnFeedback(
      dashboardIssueContext ?? consumedDashboardIssueContext,
      event,
    );

    if (!feedback) return false;

    // Sau success liên quan, xóa ngữ cảnh dashboard khỏi URL nhưng giữ tab đang mở.
    // Thông báo quay lại tổng quan chỉ sống trong state của trang hiện tại.
    setReturnFeedback(feedback);
    setHasConsumedDashboardIssue(true);
    clearDashboardIssueUrl();
    return true;
  };

  const shouldPreserveDashboardIssueForTab = (tab: TopicBuilderTab) =>
    (issueDestinationState.kind === "valid" ||
      issueDestinationState.kind === "invalid_tab") &&
    topicBuilderIssueContext?.issue === "topic_has_no_learning_content" &&
    (tab === "flashcards" || tab === "exercises");

  const selectTopicBuilderTab = (tab: TopicBuilderTab) => {
    setManualActiveTab(tab);

    if (shouldPreserveDashboardIssueForTab(tab)) {
      setConsumedDashboardIssueContext(topicBuilderIssueContext);
      const currentPathname =
        typeof window === "undefined" ? pathname : window.location.pathname;
      const currentSearch =
        typeof window === "undefined"
          ? search
          : window.location.search.replace(/^\?/, "");
      const params = new URLSearchParams(currentSearch);
      params.set("tab", tab);
      const nextHref = `${currentPathname}?${params.toString()}`;

      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", nextHref);
      }

      router.replace(nextHref, { scroll: false });
      return;
    }

    const currentPathname =
      typeof window === "undefined" ? pathname : window.location.pathname;
    const currentSearch =
      typeof window === "undefined"
        ? search
        : window.location.search.replace(/^\?/, "");
    const cleanedPath = removeDashboardIssueContextParams(
      currentPathname,
      currentSearch,
    );
    const [cleanPathname, cleanSearch = ""] = cleanedPath.split("?");
    const params = new URLSearchParams(cleanSearch);
    params.set("tab", tab);
    const nextSearch = params.toString();
    const nextHref = nextSearch ? `${cleanPathname}?${nextSearch}` : cleanPathname;

    if (
      issueDestinationState.kind === "valid" ||
      issueDestinationState.kind === "invalid_tab"
    ) {
      setHasConsumedDashboardIssue(true);
      setConsumedDashboardIssueContext(null);
    }
    router.replace(nextHref, { scroll: false });
  };

  return (
    <>
      {topGuidance ? (
        <DashboardIssueNotice
          guidance={topGuidance}
          onDismiss={exitDashboardIssueMode}
          contextLabel="Đang sửa vấn đề từ dashboard"
          dismissLabel="Thoát chế độ sửa"
          overviewHref={getCourseOverviewPath(courseId)}
          overviewLabel="Quay lại tổng quan"
        />
      ) : null}

      {returnFeedback ? (
        <DashboardReturnFeedback
          courseId={courseId}
          feedback={returnFeedback}
          onDismiss={() => setReturnFeedback(null)}
        />
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full gap-5"
      >
        <TabsList className="!flex !h-auto !w-full flex-col items-stretch gap-2 rounded-lg border bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:gap-1">
          <TabsTrigger
            value="flashcards"
            className="!h-auto min-h-11 w-full whitespace-normal rounded-md px-3 py-3 text-center text-sm font-bold after:hidden data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 sm:min-h-12 sm:px-6 sm:py-3"
          >
            <BookOpen size={18} /> Từ vựng
          </TabsTrigger>
          <TabsTrigger
            value="exercises"
            className="!h-auto min-h-11 w-full whitespace-normal rounded-md px-3 py-3 text-center text-sm font-bold after:hidden data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 sm:min-h-12 sm:px-6 sm:py-3"
          >
            <ClipboardList size={18} /> Bài tập TOEIC
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="!h-auto min-h-11 w-full whitespace-normal rounded-md px-3 py-3 text-center text-sm font-bold after:hidden data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 sm:min-h-12 sm:px-6 sm:py-3"
          >
            <Settings size={18} /> Cài đặt bài học
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flashcards" className="min-w-0">
          <FlashcardTab
            topicId={topicId}
            onAuthoringSuccess={showReturnFeedbackForSuccess}
          />
        </TabsContent>

        <TabsContent value="exercises" className="min-w-0">
          <ExerciseTab
            topicId={topicId}
            dashboardIssueContext={exerciseIssueContext}
            onDismissDashboardIssue={exitDashboardIssueMode}
            staleTargetRedirectHref={staleTargetRedirectHref}
            onAuthoringSuccess={showReturnFeedbackForSuccess}
          />
        </TabsContent>

        <TabsContent value="settings" className="min-w-0">
          <SettingsTab courseId={courseId} topicId={topicId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function subscribeToNavigationSnapshot() {
  return () => undefined;
}
