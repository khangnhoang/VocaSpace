"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Brain, ClipboardList, Eye, Settings } from "lucide-react";
import ExerciseWorkbench from "./ExerciseWorkbench";
import MemoryCheckWorkbench from "./MemoryCheckWorkbench";
import FlashcardWorkbench from "./FlashcardWorkbench";
import SettingsTab from "./SettingsTab";
import {
  getCourseOverviewPath,
  getTopicBuilderTab,
  TOPIC_BUILDER_TABS,
  type TopicBuilderTab,
} from "@/lib/course-authoring/routes";
import DashboardIssueNotice from "@/app/(teacher)/teacher/courses/[id]/_components/DashboardIssueNotice";
import DashboardReturnFeedback from "@/app/(teacher)/teacher/courses/[id]/_components/DashboardReturnFeedback";
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
import TopicWorkflowPanel from "./TopicWorkflowPanel";
import type { TopicWorkflow } from "@/lib/schemas/topic-workflow";
import { AuthoringGuardProvider, useAuthoringGuard } from "./authoring-guard";

interface TopicBuilderTabsProps {
  courseId: string;
  topicId: string;
  parentChapterId: string | null;
  initialSearch: string;
  workflow: TopicWorkflow;
}

const TAB_ITEMS: { value: TopicBuilderTab; label: string; Icon: typeof BookOpen }[] = [
  { value: "flashcards", label: "Từ vựng", Icon: BookOpen },
  { value: "memory-check", label: "Memory check", Icon: Brain },
  { value: "exercises", label: "Bài tập", Icon: ClipboardList },
  { value: "settings", label: "Cài đặt", Icon: Settings },
];

export default function TopicBuilderTabs(props: TopicBuilderTabsProps) {
  return (
    <AuthoringGuardProvider>
      <TopicBuilderShell {...props} />
    </AuthoringGuardProvider>
  );
}

function TopicBuilderShell({
  courseId,
  topicId,
  parentChapterId,
  initialSearch,
  workflow,
}: TopicBuilderTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const guard = useAuthoringGuard();
  const [returnFeedback, setReturnFeedback] =
    useState<CourseAuthoringReturnFeedback | null>(null);
  const [hasConsumedDashboardIssue, setHasConsumedDashboardIssue] =
    useState(false);
  const [consumedDashboardIssueContext, setConsumedDashboardIssueContext] =
    useState<TopicBuilderIssueContext | null>(null);
  const [manualActiveTab, setManualActiveTab] =
    useState<TopicBuilderTab | null>(null);
  const latestUrlWriteRef = useRef<string | null>(null);
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
  // Tab chỉ mount khi được mở lần đầu rồi giữ nguyên: đổi tab không tải lại danh sách (không
  // phát server action mới) và không làm mất editor đang mở ở tab khác.
  const [visitedTabs, setVisitedTabs] = useState<TopicBuilderTab[]>(() => [activeTab]);
  const mountedTabs = visitedTabs.includes(activeTab) ? visitedTabs : [...visitedTabs, activeTab];
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
  const readOnly = !workflow.canEdit || workflow.status === "pending";
  const isPublished = workflow.status === "published";
  const tabCounts: Partial<Record<TopicBuilderTab, number>> = {
    flashcards: workflow.activeFlashcardCount,
    "memory-check": workflow.activeMemoryCheckQuestionCount,
    exercises: workflow.activeExerciseCount,
  };

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

  // ACTION-QUEUE-001 (G8): URL được ghi qua hàng thao tác router nối tiếp của guard (không chồng lên
  // server action hay refresh); đổi tab liên tiếp trong lúc chờ chỉ ghi lần mới nhất.
  const writeBuilderUrl = (nextHref: string) => {
    latestUrlWriteRef.current = nextHref;
    return guard.replaceUrl(nextHref, () => latestUrlWriteRef.current === nextHref);
  };

  const refreshPage = guard.refresh;

  const handleTabChange = async (value: string) => {
    if (!TOPIC_BUILDER_TABS.includes(value as TopicBuilderTab)) return;
    if (value === activeTab) return;
    // Đổi tab khi editor còn thay đổi chưa lưu phải hỏi trước (AC6).
    if (guard.hasDirtyEditor() && !(await guard.confirmLeave())) return;
    selectTopicBuilderTab(value as TopicBuilderTab);
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

    writeBuilderUrl(nextHref);
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

    if (!feedback) {
      // Readiness và lifecycle nằm trong Server Component DTO; các tab con chỉ
      // refresh danh sách nội dung cục bộ, nên cần revalidate parent state sau
      // mọi mutation thành công kể cả khi không có dashboard issue context.
      refreshPage();
      return false;
    }

    // Sau success liên quan, xóa ngữ cảnh dashboard khỏi URL nhưng giữ tab đang mở.
    // Thông báo quay lại tổng quan chỉ sống trong state của trang hiện tại.
    setReturnFeedback(feedback);
    setHasConsumedDashboardIssue(true);
    clearDashboardIssueUrl();
    refreshPage();
    return true;
  };

  const shouldPreserveDashboardIssueForTab = (tab: TopicBuilderTab) =>
    (issueDestinationState.kind === "valid" ||
      issueDestinationState.kind === "invalid_tab") &&
    topicBuilderIssueContext?.issue === "topic_has_no_learning_content" &&
    (tab === "flashcards" || tab === "exercises");

  const selectTopicBuilderTab = (tab: TopicBuilderTab) => {
    setManualActiveTab(tab);
    setVisitedTabs((current) => (current.includes(tab) ? current : [...current, tab]));

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
      writeBuilderUrl(`${currentPathname}?${params.toString()}`);
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
    writeBuilderUrl(nextHref);
  };

  return (
    <div className="space-y-5">
      <TopicWorkflowPanel workflow={workflow} onRefresh={refreshPage} />
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
        onValueChange={(value) => void handleTabChange(value)}
        activationMode="manual"
        className="w-full gap-4"
      >
        {/* Tab grammar của Product Language: icon + nhãn, tab đang mở có màu Route Blue và vạch
            dưới; hẹp quá thì cuộn ngang (ẩn thanh cuộn), không xuống dòng. */}
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <TabsList
            variant="line"
            aria-label="Nội dung bài học"
            className="flex! h-auto! w-full! min-w-max justify-start gap-1 rounded-none border-b border-slate-200 p-0"
          >
            {TAB_ITEMS.map(({ value, label, Icon }) => {
              const count = tabCounts[value];
              return (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-auto! min-h-11 flex-none gap-2 rounded-t-lg rounded-b-none border-0 px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors duration-[120ms] after:bottom-0! after:h-[3px]! after:rounded-t-[3px] after:bg-route! hover:bg-route-quiet hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-0 data-active:font-bold data-active:text-route motion-reduce:transition-none sm:px-4"
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  {label}
                  {count !== undefined ? (
                    <span className="rounded-md bg-slate-100 px-1.5 text-xs font-bold tabular-nums text-slate-700">
                      <span className="sr-only">: </span>
                      {count}
                    </span>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {!workflow.canEdit ? (
          <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700">
            <Eye className="size-4 shrink-0 text-slate-600" aria-hidden="true" />
            Bạn có quyền xem nhưng không có quyền soạn nội dung bài học này.
          </p>
        ) : null}

        <TabsContent value="flashcards" forceMount className="min-w-0 data-[state=inactive]:hidden">
          {mountedTabs.includes("flashcards") ? (
            <FlashcardWorkbench
              topicId={topicId}
              isActive={activeTab === "flashcards"}
              readOnly={readOnly}
              isPublished={isPublished}
              onAuthoringSuccess={showReturnFeedbackForSuccess}
              onMutationSuccess={refreshPage}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="memory-check" forceMount className="min-w-0 data-[state=inactive]:hidden">
          {mountedTabs.includes("memory-check") ? (
            <MemoryCheckWorkbench
              topicId={topicId}
              isActive={activeTab === "memory-check"}
              readOnly={readOnly}
              isPublished={isPublished}
              onMutationSuccess={refreshPage}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="exercises" forceMount className="min-w-0 data-[state=inactive]:hidden">
          {mountedTabs.includes("exercises") ? (
            <ExerciseWorkbench
              topicId={topicId}
              isActive={activeTab === "exercises"}
              readOnly={readOnly}
              isPublished={isPublished}
              dashboardIssueContext={exerciseIssueContext}
              onDismissDashboardIssue={exitDashboardIssueMode}
              staleTargetRedirectHref={staleTargetRedirectHref}
              onAuthoringSuccess={showReturnFeedbackForSuccess}
              onMutationSuccess={refreshPage}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="settings" forceMount className="min-w-0 data-[state=inactive]:hidden">
          {mountedTabs.includes("settings") ? (
            <SettingsTab
              topicId={topicId}
              courseId={courseId}
              topicStatus={workflow.status}
              canManagePreviewMarkers={workflow.role !== "previewer"}
              readOnly={readOnly}
              isPublished={isPublished}
              onSaved={refreshPage}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function subscribeToNavigationSnapshot() {
  return () => undefined;
}
